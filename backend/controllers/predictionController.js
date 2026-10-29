const { validationResult } = require('express-validator');
const { spawn } = require('child_process');
const path = require('path');
const Stock = require('../models/Stock');

const normalizeSymbol = (symbol) => String(symbol || '').trim().toUpperCase();

// Use absolute Python path to ensure it resolves correctly from Node.js spawn context
const PYTHON_PATH = process.env.PYTHON_PATH || 'C:\\Users\\Dhyan\\AppData\\Local\\Programs\\Python\\Python311\\python.exe';

// In-memory cache for ultra-fast repeated prediction requests (10 min TTL)
const predictionCache = new Map();
const inFlightRequests = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

const runPythonPrediction = (pythonScript, symbol) => {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn(PYTHON_PATH, [pythonScript, symbol], {
      env: {
        ...process.env,
        TF_ENABLE_ONEDNN_OPTS: '0',
        TF_CPP_MIN_LOG_LEVEL: '3',
        PYTHONUNBUFFERED: '1'
      }
    });

    let dataString = '';
    let errorString = '';

    // Safety timeout: abort if Python takes more than 42s
    const timeout = setTimeout(() => {
      try { pythonProcess.kill('SIGKILL'); } catch (_) {}
      reject(new Error('Model execution timeout (exceeded 42s)'));
    }, 42000);

    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
    });

    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);

      // Parse JSON from stdout if available
      let parsed = null;
      if (dataString.trim()) {
        try {
          parsed = JSON.parse(dataString);
        } catch (_) {
          // Sometimes stdout has trailing warnings before JSON
          const jsonStart = dataString.indexOf('{');
          const jsonEnd = dataString.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            try {
              parsed = JSON.parse(dataString.slice(jsonStart, jsonEnd + 1));
            } catch (_) {}
          }
        }
      }

      if (parsed) {
        if (parsed.error) {
          reject(new Error(parsed.message || parsed.error));
        } else {
          resolve(parsed);
        }
        return;
      }

      if (code !== 0) {
        reject(new Error(errorString.trim().slice(0, 300) || `Process exited with code ${code}`));
      } else {
        reject(new Error('Empty prediction output returned from model script'));
      }
    });

    pythonProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
};

exports.predictNextDay = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation error', errors: errors.array() });
    }

    const symbol = normalizeSymbol(req.params.symbol);
    const model = (req.query.model || 'lstm').toLowerCase();
    const cacheKey = `${symbol}:${model}`;

    // 1. Check in-memory cache for instant response (< 5ms)
    const cached = predictionCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return res.json({
        message: 'Prediction generated (cached)',
        cached: true,
        ...cached.data
      });
    }

    // 2. Select python script
    let pythonScript;
    if (model === 'finbert' || model === 'finbert+price' || model === 'finbert_price') {
      pythonScript = path.join(__dirname, '..', 'finbert_price_predict.py');
    } else if (model === 'random_forest' || model === 'random forest' || model === 'rf') {
      pythonScript = path.join(__dirname, '..', 'random_forest_predict.py');
    } else {
      pythonScript = path.join(__dirname, '..', 'lstm_predict.py');
    }

    // 3. Deduplicate in-flight requests for the same symbol + model
    let promise = inFlightRequests.get(cacheKey);
    if (!promise) {
      promise = runPythonPrediction(pythonScript, symbol)
        .then((result) => {
          inFlightRequests.delete(cacheKey);
          // Store in cache
          predictionCache.set(cacheKey, { timestamp: Date.now(), data: result });
          
          // Background DB update (don't block HTTP response)
          Stock.findOneAndUpdate(
            { symbol: result.symbol },
            {
              symbol: result.symbol,
              name: result.name,
              currentPrice: result.currentPrice,
              currency: result.currency
            },
            { upsert: true }
          ).catch((e) => console.warn('Background stock save note:', e.message));

          return result;
        })
        .catch((err) => {
          inFlightRequests.delete(cacheKey);
          throw err;
        });

      inFlightRequests.set(cacheKey, promise);
    }

    const result = await promise;

    return res.json({
      message: 'Prediction generated',
      ...result
    });

  } catch (err) {
    console.error('Prediction controller error:', err.message);
    return res.status(502).json({
      message: 'Failed to generate prediction',
      details: err.message
    });
  }
};
