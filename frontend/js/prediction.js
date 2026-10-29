const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' ? 'http://localhost:5000/api' : window.location.origin + '/api';

const getToken = () => localStorage.getItem('token');
const requireAuth = () => {
  const token = getToken();
  if (!token) {
    setMsg(msg, 'Please login to make predictions', 'error');
    return null;
  }
  return token;
};

const setMsg = (el, text, type) => {
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('error', 'success');
  if (type) el.classList.add(type);
  // Ensure message is shown or hidden explicitly
  if (text) {
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
};

const fmtMoney = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
};

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  updateAuthUI();
  setMsg(msg, 'Logged out successfully', 'success');
  setTimeout(() => setMsg(msg, 'Please login to make predictions', 'error'), 2000);
});

const form = document.getElementById('predictForm');
const msg = document.getElementById('predictMsg');

const allResultsContainer = document.getElementById('allResultsContainer');
const tabContainer = document.getElementById('tabContainer');
const symbolInput = document.getElementById('symbolInput');
const predictBtn = document.getElementById('predictBtn');

let charts = { lstm: null, finbert: null, rf: null, conclusion: null };

// Tab switching logic
document.querySelectorAll('.tab-item').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById(tab.dataset.target);
    if (target) {
        target.classList.add('active');
        
        // Force chart resize when tab becomes visible (fixes zero-width bug for hidden tabs)
        Object.keys(charts).forEach(key => {
            const chartObj = charts[key];
            const container = document.getElementById(`predictionChart_${key}`);
            if (chartObj && container && target.id === `tab_${key}`) {
               chartObj.applyOptions({ width: container.clientWidth || 600 });
               chartObj.timeScale().fitContent();
            }
        });
    }
  });
});


const getChartThemeColors = () => {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    isDark,
    chartBg: isDark ? '#0f121d' : '#ffffff',
    textColor: isDark ? '#94a3b8' : '#475569',
    gridColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.05)',
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'
  };
};

const createPredictionChart = (containerId, data, idSuffix) => {
  const container = document.getElementById(containerId);
  if (!container || !data || !data.history || !data.forecast) return null;

  const { isDark, chartBg, textColor, gridColor, borderColor } = getChartThemeColors();
  container.innerHTML = '';

  const chart = LightweightCharts.createChart(container, {
    width: container.clientWidth || 800,
    height: 400,
    layout: {
      background: { type: 'solid', color: chartBg },
      backgroundColor: chartBg,
      textColor: textColor,
      fontSize: 11,
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    grid: {
      vertLines: { color: gridColor },
      horzLines: { color: gridColor }
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: {
        color: isDark ? 'rgba(96, 165, 250, 0.5)' : 'rgba(37, 99, 235, 0.5)',
        width: 1,
        style: 3,
        labelBackgroundColor: '#2563eb'
      },
      horzLine: {
        color: isDark ? 'rgba(96, 165, 250, 0.5)' : 'rgba(37, 99, 235, 0.5)',
        width: 1,
        style: 3,
        labelBackgroundColor: '#2563eb'
      }
    },
    rightPriceScale: {
      borderColor: borderColor,
      scaleMargins: {
        top: 0.1,
        bottom: 0.22
      }
    },
    timeScale: {
      borderColor: borderColor,
      timeVisible: true,
      secondsVisible: false
    }
  });

  const historyPoints = data.history || [];
  const forecastPoints = data.forecast || [];

  // 1. Candlestick Series (Default primary view)
  const candleSeries = chart.addCandlestickSeries({
    upColor: '#10b981',
    downColor: '#ef4444',
    borderUpColor: '#10b981',
    borderDownColor: '#ef4444',
    wickUpColor: '#10b981',
    wickDownColor: '#ef4444'
  });
  const candleData = historyPoints.map(pt => ({
    time: pt.date,
    open: Number(pt.open),
    high: Number(pt.high),
    low: Number(pt.low),
    close: Number(pt.close)
  }));
  candleSeries.setData(candleData);

  // 2. Area Series (Alternative view)
  const areaSeries = chart.addAreaSeries({
    topColor: 'rgba(56, 189, 248, 0.4)',
    bottomColor: 'rgba(56, 189, 248, 0.01)',
    lineColor: '#38bdf8',
    lineWidth: 2,
    visible: false
  });
  const areaData = historyPoints.map(pt => ({ time: pt.date, value: Number(pt.close) }));
  areaSeries.setData(areaData);

  // 3. Line Series (Alternative view)
  const lineSeries = chart.addLineSeries({
    color: '#38bdf8',
    lineWidth: 2,
    visible: false
  });
  lineSeries.setData(areaData);

  // 4. Volume Histogram Series (tucked cleanly at bottom 20%)
  const volumeSeries = chart.addHistogramSeries({
    priceFormat: { type: 'volume' },
    priceScaleId: 'volume_scale'
  });
  chart.priceScale('volume_scale').applyOptions({
    scaleMargins: {
      top: 0.8,
      bottom: 0
    }
  });
  const volumeData = historyPoints.map(pt => ({
    time: pt.date,
    value: Number(pt.volume || 0),
    color: Number(pt.close) >= Number(pt.open) ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'
  }));
  volumeSeries.setData(volumeData);

  // 5. 20-Day Simple Moving Average (SMA)
  const smaSeries = chart.addLineSeries({
    color: '#a855f7',
    lineWidth: 1.5,
    title: 'SMA 20'
  });
  const smaData = [];
  const period = 20;
  for (let i = 0; i < historyPoints.length; i++) {
    if (i >= period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += Number(historyPoints[i - j].close);
      }
      smaData.push({ time: historyPoints[i].date, value: sum / period });
    }
  }
  smaSeries.setData(smaData);

  // 6. AI Forecast Series (connected from last historical close)
  const forecastSeries = chart.addLineSeries({
    color: '#f59e0b',
    lineWidth: 2.5,
    lineStyle: 2,
    title: 'AI Forecast'
  });
  const lastHist = historyPoints[historyPoints.length - 1];
  const forecastData = [];
  if (lastHist) {
    forecastData.push({ time: lastHist.date, value: Number(lastHist.close) });
  }
  forecastPoints.forEach(pt => {
    forecastData.push({ time: pt.date, value: Number(pt.value) });
  });
  forecastSeries.setData(forecastData);

  // 7. Target marker at end of forecast
  if (forecastPoints.length > 0) {
    const lastF = forecastPoints[forecastPoints.length - 1];
    forecastSeries.setMarkers([
      {
        time: lastF.date,
        position: 'aboveBar',
        color: '#f59e0b',
        shape: 'arrowDown',
        text: 'Target: ₹' + Number(lastF.value).toFixed(2)
      }
    ]);
  }

  // 8. Support and Resistance Price Lines
  const priceLines = [];
  if (data.supportResistance) {
    const resLevels = data.supportResistance.resistanceLevels || [];
    const supLevels = data.supportResistance.supportLevels || [];
    const rVal = resLevels[resLevels.length - 1] || data.supportResistance.recentMax;
    const sVal = supLevels[0] || data.supportResistance.recentMin;
    if (rVal) {
      priceLines.push(candleSeries.createPriceLine({
        price: Number(rVal),
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Resistance ₹' + Number(rVal).toFixed(0)
      }));
    }
    if (sVal) {
      priceLines.push(candleSeries.createPriceLine({
        price: Number(sVal),
        color: '#10b981',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Support ₹' + Number(sVal).toFixed(0)
      }));
    }
  }

  // 9. Interactive Hover Crosshair & Legend
  const legendEl = document.getElementById('chartLegend_' + idSuffix);
  const updateLegend = (pt, isForecast = false) => {
    if (!legendEl) return;
    if (!pt) {
      legendEl.innerHTML = '';
      return;
    }
    if (isForecast) {
      legendEl.innerHTML = `
        <span class="quote-tag">Forecast:</span>
        <span class="quote-val quote-up">₹${Number(pt.value || pt.close).toFixed(2)}</span>
        <span class="quote-tag">Date:</span>
        <span class="quote-val">${pt.date || pt.time}</span>
      `;
      return;
    }
    const o = Number(pt.open);
    const h = Number(pt.high);
    const l = Number(pt.low);
    const c = Number(pt.close);
    const chg = o ? ((c - o) / o) * 100 : 0;
    const isUp = chg >= 0;
    const volStr = pt.volume ? (pt.volume > 1e6 ? (pt.volume / 1e6).toFixed(2) + 'M' : (pt.volume / 1e3).toFixed(1) + 'K') : '—';

    legendEl.innerHTML = `
      <span class="quote-tag">O:</span> <span class="quote-val">₹${o.toFixed(2)}</span>
      <span class="quote-tag">H:</span> <span class="quote-val">₹${h.toFixed(2)}</span>
      <span class="quote-tag">L:</span> <span class="quote-val">₹${l.toFixed(2)}</span>
      <span class="quote-tag">C:</span> <span class="quote-val ${isUp ? 'quote-up' : 'quote-down'}">₹${c.toFixed(2)}</span>
      <span class="quote-tag">Chg:</span> <span class="quote-val ${isUp ? 'quote-up' : 'quote-down'}">${isUp ? '+' : ''}${chg.toFixed(2)}%</span>
      <span class="quote-tag">Vol:</span> <span class="quote-val">${volStr}</span>
    `;
  };

  chart.subscribeCrosshairMove((param) => {
    if (!param.time) {
      if (lastHist) updateLegend(lastHist, false);
      return;
    }
    const dateStr = typeof param.time === 'string' ? param.time : `${param.time.year}-${String(param.time.month).padStart(2, '0')}-${String(param.time.day).padStart(2, '0')}`;
    const hMatch = historyPoints.find(p => p.date === dateStr);
    if (hMatch) {
      updateLegend(hMatch, false);
    } else {
      const fMatch = forecastPoints.find(p => p.date === dateStr);
      if (fMatch) updateLegend(fMatch, true);
    }
  });

  if (lastHist) updateLegend(lastHist, false);

  // 10. Toolbar Controls (Candles / Area / Line, Indicators)
  const wrapper = document.getElementById('chartWrapper_' + idSuffix);
  if (wrapper) {
    const typeBtns = wrapper.querySelectorAll('.chart-type-btn[data-type]');
    typeBtns.forEach(btn => {
      btn.onclick = () => {
        typeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const t = btn.getAttribute('data-type');
        candleSeries.applyOptions({ visible: t === 'candlestick' });
        areaSeries.applyOptions({ visible: t === 'area' });
        lineSeries.applyOptions({ visible: t === 'line' });
      };
    });

    const indBtns = wrapper.querySelectorAll('.chart-type-btn[data-indicator]');
    indBtns.forEach(btn => {
      btn.onclick = () => {
        btn.classList.toggle('active');
        const ind = btn.getAttribute('data-indicator');
        const isActive = btn.classList.contains('active');
        if (ind === 'sma') smaSeries.applyOptions({ visible: isActive });
        if (ind === 'vol') volumeSeries.applyOptions({ visible: isActive });
        if (ind === 'sr') {
          priceLines.forEach(pl => {
            if (isActive) {
              candleSeries.createPriceLine(pl.options());
            } else {
              try { candleSeries.removePriceLine(pl); } catch (_) {}
            }
          });
        }
      };
    });
  }

  chart.timeScale().fitContent();
  return chart;
};

const createConclusionChart = (containerId, historyPoints = [], forecasts = {}) => {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const { isDark, chartBg, textColor, gridColor, borderColor } = getChartThemeColors();
  container.innerHTML = '';

  const chart = LightweightCharts.createChart(container, {
    width: container.clientWidth || 800,
    height: 420,
    layout: {
      background: { type: 'solid', color: chartBg },
      backgroundColor: chartBg,
      textColor: textColor,
      fontSize: 11,
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    grid: {
      vertLines: { color: gridColor },
      horzLines: { color: gridColor }
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: {
        color: isDark ? 'rgba(96, 165, 250, 0.5)' : 'rgba(37, 99, 235, 0.5)',
        width: 1,
        style: 3,
        labelBackgroundColor: '#2563eb'
      },
      horzLine: {
        color: isDark ? 'rgba(96, 165, 250, 0.5)' : 'rgba(37, 99, 235, 0.5)',
        width: 1,
        style: 3,
        labelBackgroundColor: '#2563eb'
      }
    },
    rightPriceScale: {
      borderColor: borderColor,
      scaleMargins: {
        top: 0.1,
        bottom: 0.15
      }
    },
    timeScale: {
      borderColor: borderColor,
      timeVisible: true,
      secondsVisible: false
    }
  });

  const historySeries = chart.addAreaSeries({
    topColor: 'rgba(56, 189, 248, 0.25)',
    bottomColor: 'rgba(56, 189, 248, 0.01)',
    lineColor: '#38bdf8',
    lineWidth: 2,
    title: 'Actual Price'
  });
  const lstmSeries = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1.5, lineStyle: 2, title: 'LSTM' });
  const finbertSeries = chart.addLineSeries({ color: '#10b981', lineWidth: 1.5, lineStyle: 2, title: 'FinBERT' });
  const rfSeries = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1.5, lineStyle: 2, title: 'Random Forest' });
  const consensusSeries = chart.addLineSeries({ color: '#d946ef', lineWidth: 3, lineStyle: 0, title: 'Consensus' });

  const historyData = (historyPoints || []).map(pt => ({ time: pt.date, value: Number(pt.close ?? pt.value) }));
  historySeries.setData(historyData);

  const lastHist = historyPoints[historyPoints.length - 1];

  const connectLine = (fList) => {
    if (!fList || !fList.length) return [];
    const res = [];
    if (lastHist) res.push({ time: lastHist.date, value: Number(lastHist.close) });
    fList.forEach(p => res.push({ time: p.date, value: Number(p.value) }));
    return res;
  };

  if (forecasts.lstm?.length) lstmSeries.setData(connectLine(forecasts.lstm));
  if (forecasts.finbert?.length) finbertSeries.setData(connectLine(forecasts.finbert));
  if (forecasts.rf?.length) rfSeries.setData(connectLine(forecasts.rf));
  if (forecasts.consensus?.length) {
    const cData = connectLine(forecasts.consensus);
    consensusSeries.setData(cData);
    const lastC = forecasts.consensus[forecasts.consensus.length - 1];
    if (lastC) {
      consensusSeries.setMarkers([
        {
          time: lastC.date,
          position: 'aboveBar',
          color: '#d946ef',
          shape: 'arrowDown',
          text: 'Consensus Target: ₹' + Number(lastC.value).toFixed(2)
        }
      ]);
    }
  }

  // Crosshair Legend Tracking
  const legendEl = document.getElementById('chartLegend_conclusion');
  chart.subscribeCrosshairMove((param) => {
    if (!legendEl) return;
    if (!param.time) {
      legendEl.innerHTML = '';
      return;
    }
    const dateStr = typeof param.time === 'string' ? param.time : `${param.time.year}-${String(param.time.month).padStart(2, '0')}-${String(param.time.day).padStart(2, '0')}`;
    const hPt = historyPoints.find(p => p.date === dateStr);
    if (hPt) {
      legendEl.innerHTML = `<span class="quote-tag">Actual Close:</span> <span class="quote-val quote-up">₹${Number(hPt.close).toFixed(2)}</span> <span class="quote-tag">(${dateStr})</span>`;
    } else {
      const cPt = forecasts.consensus?.find(p => p.date === dateStr);
      if (cPt) {
        legendEl.innerHTML = `<span class="quote-tag">Consensus:</span> <span class="quote-val" style="color:#d946ef;">₹${Number(cPt.value).toFixed(2)}</span> <span class="quote-tag">(${dateStr})</span>`;
      }
    }
  });

  chart.timeScale().fitContent();
  return chart;
};

window.addEventListener('resize', () => {
  Object.keys(charts).forEach(key => {
    const chartObj = charts[key];
    const container = document.getElementById(`predictionChart_${key}`);
    if (chartObj && container) {
      chartObj.applyOptions({ width: container.clientWidth });
    }
  });
});

const formatMoneyLocal = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
};

// ---- Download CSV utility ----
const downloadPredictionCSV = (data, modelName) => {
  if (!data || data.error) return;
  const symbol = data.symbol || 'STOCK';
  const rows = [
    ['Stock Symbol', symbol],
    ['Stock Name', data.name || ''],
    ['Current Price (INR)', data.currentPrice || ''],
    ['Model', data.basis?.method || modelName],
    ['Confidence', data.confidence || ''],
    ['Trend', data.basis?.trend || ''],
    ['Sentiment', data.sentiment?.label || ''],
    ['Sentiment Score', data.sentiment?.score ?? ''],
    ['Sentiment Summary', data.sentiment?.summary || ''],
    [],
    ['--- PRICE FORECAST (20 BUSINESS DAYS) ---'],
    ['Date', 'Predicted Price (INR)'],
    ...(data.forecast || []).map(f => [f.date, Number(f.value).toFixed(2)]),
    [],
    ['--- KEY PREDICTIONS ---'],
    ['5-Day Price', data.predictions?.['5'] != null ? Number(data.predictions['5']).toFixed(2) : ''],
    ['10-Day Price', data.predictions?.['10'] != null ? Number(data.predictions['10']).toFixed(2) : ''],
    ['15-Day Price', data.predictions?.['15'] != null ? Number(data.predictions['15']).toFixed(2) : ''],
    ['20-Day Price', data.predictions?.['20'] != null ? Number(data.predictions['20']).toFixed(2) : ''],
    [],
    ['--- HISTORICAL DATA (Last 60 Days) ---'],
    ['Date', 'Open', 'High', 'Low', 'Close', 'Volume'],
    ...(data.history || []).map(h => [h.date, Number(h.open).toFixed(2), Number(h.high).toFixed(2), Number(h.low).toFixed(2), Number(h.close).toFixed(2), h.volume])
  ];

  const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${symbol}_${modelName}_prediction_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Store prediction data keyed by model suffix for download access
const predictionDataStore = {};

const generateTabHtml = (idSuffix, data) => {
  if (!data) return '<p style="padding: 20px; color: var(--text-muted);">Failed to load prediction for this model.</p>';
  if (data.error) return '<p style="padding: 20px; color: #ef4444;">Error: ' + data.error + '</p>';
  
  predictionDataStore[idSuffix] = data;

  const supportLevels = data.supportResistance?.supportLevels || [];
  const resistanceLevels = data.supportResistance?.resistanceLevels || [];
  const sStr = supportLevels.length ? supportLevels.map(x => formatMoneyLocal(x)).join(' / ') : '—';
  const rStr = resistanceLevels.length ? resistanceLevels.map(x => formatMoneyLocal(x)).join(' / ') : '—';
  const trend = data.basis?.trend || 'Neutral';
  const trendIcon = trend === 'Upward' ? '↗' : (trend === 'Downward' ? '↘' : '→');

  const curPrice = Number(data.currentPrice) || 1;
  const target20 = Number(data.predictions?.['20']) || curPrice;
  const targetChange = ((target20 - curPrice) / curPrice) * 100;

  return `
    <div class="kpi-row" style="flex-wrap: wrap;">
      <div class="kpi">
        <div class="kpi-label">Confidence</div>
        <div class="kpi-value">${data.confidence || '—'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Trend</div>
        <div class="kpi-value">${trend} ${trendIcon}</div>
      </div>
    </div>

    <!-- PRO TRADING CHART WRAPPER -->
    <div class="trading-chart-wrapper" id="chartWrapper_${idSuffix}">
      <div class="trading-chart-header">
        <div class="trading-chart-left">
          <span class="stock-badge">NSE : ${data.symbol || 'STOCK'}</span>
          <span class="trading-quote-legend" id="chartLegend_${idSuffix}">
            <span class="quote-tag">Loading quote...</span>
          </span>
        </div>
        <div class="trading-chart-controls">
          <div class="chart-btn-group">
            <button type="button" class="chart-type-btn active" data-type="candlestick">🕯️ Candles</button>
            <button type="button" class="chart-type-btn" data-type="area">📈 Area</button>
            <button type="button" class="chart-type-btn" data-type="line">📉 Line</button>
          </div>
          <div class="chart-btn-group">
            <button type="button" class="chart-type-btn active" data-indicator="sma">SMA 20</button>
            <button type="button" class="chart-type-btn active" data-indicator="sr">S/R</button>
            <button type="button" class="chart-type-btn active" data-indicator="vol">Volume</button>
          </div>
        </div>
      </div>

      <div id="predictionChart_${idSuffix}" class="chart-canvas-box"></div>

      <div class="trading-chart-footer">
        <div class="chart-stat-chip">
          <span class="chip-label">Current:</span>
          <span class="chip-val">${formatMoneyLocal(data.currentPrice)}</span>
        </div>
        <div class="chart-stat-chip">
          <span class="chip-label">20D AI Target:</span>
          <span class="chip-val target-highlight">${formatMoneyLocal(target20)}</span>
          <span class="chip-pill ${targetChange >= 0 ? 'up' : 'down'}">${targetChange >= 0 ? '+' : ''}${targetChange.toFixed(2)}%</span>
        </div>
        <div class="chart-stat-chip">
          <span class="chip-label">Confidence:</span>
          <span class="chip-val">${data.confidence || '—'}</span>
        </div>
        <div class="chart-stat-chip">
          <span class="chip-label">Trend:</span>
          <span class="chip-val">${trend} ${trendIcon}</span>
        </div>
      </div>
    </div>

    <div class="support-resistance" style="margin-top: 16px;">
      <h3 style="margin: 0 0 10px; font-size: 1rem; color: var(--text-muted);">Support / Resistance</h3>
      <div class="kpi-row" style="flex-wrap: wrap; gap: 10px;">
        <div class="kpi-small">
          <div class="kpi-label">Support</div>
          <div class="kpi-value" style="font-size:0.95rem;">${sStr}</div>
        </div>
        <div class="kpi-small">
          <div class="kpi-label">Resistance</div>
          <div class="kpi-value" style="font-size:0.95rem;">${rStr}</div>
        </div>
      </div>
    </div>

    <h3 style="margin: 20px 0 10px; font-size: 1rem; color: var(--text-muted);">Future Price (Forecast Milestones)</h3>
    <div class="kpi-row" style="flex-wrap: wrap; gap: 15px;">
      <div class="kpi-small">
        <div class="kpi-label">5 Days</div>
        <div class="kpi-value predict-val">${formatMoneyLocal(data.predictions?.['5'])}</div>
      </div>
      <div class="kpi-small">
        <div class="kpi-label">10 Days</div>
        <div class="kpi-value predict-val">${formatMoneyLocal(data.predictions?.['10'])}</div>
      </div>
      <div class="kpi-small">
        <div class="kpi-label">15 Days</div>
        <div class="kpi-value predict-val">${formatMoneyLocal(data.predictions?.['15'])}</div>
      </div>
      <div class="kpi-small">
        <div class="kpi-label">20 Days</div>
        <div class="kpi-value predict-val">${formatMoneyLocal(data.predictions?.['20'])}</div>
      </div>
    </div>
    <p class="muted">${data.basis?.method || ''} | ${data.basis?.explanation || ''}</p>
    
    ${data.sentiment ? `
    <div class="sentiment-box" style="margin-top: 16px; padding-top: 8px; border-top: 1px solid var(--border);">
      <h3 style="margin: 0 0 10px; font-size: 1rem; color: var(--text-muted);">Sentiment Analysis</h3>
      <p><strong>Sentiment:</strong> <span>${data.sentiment.label || '—'}</span></p>
      <p><strong>Score:</strong> <span>${data.sentiment.score != null ? data.sentiment.score : '—'}</span></p>
      <p><strong>Summary:</strong> <span>${data.sentiment.summary || '—'}</span></p>
    </div>
    ` : ''}

    <div style="margin-top: 18px; display: flex; gap: 12px; flex-wrap: wrap;">
      <button
        onclick="downloadPredictionCSV(predictionDataStore['${idSuffix}'], '${idSuffix}')"
        class="btn btn-sm"
      >
        ⬇ Download CSV
      </button>
      <button
        onclick="downloadPredictionJSON(predictionDataStore['${idSuffix}'], '${idSuffix}')"
        class="btn btn-sm btn-secondary"
      >
        ⬇ Download JSON
      </button>
    </div>
  `;
};

// Download JSON utility
const downloadPredictionJSON = (data, modelName) => {
  if (!data || data.error) return;
  const symbol = data.symbol || 'STOCK';
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${symbol}_${modelName}_prediction_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Download ALL model predictions as separate CSV files
const downloadAllPredictions = () => {
  const modelKeys = Object.keys(predictionDataStore);
  if (modelKeys.length === 0) return;
  modelKeys.forEach((key, idx) => {
    setTimeout(() => {
      downloadPredictionCSV(predictionDataStore[key], key);
    }, idx * 400); // 400ms stagger to prevent browser from blocking multiple downloads
  });
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = requireAuth();
  if (!token) return;

  const symbol = String(symbolInput.value || '').trim().toUpperCase();
  if (!symbol) return;

  setMsg(msg, `Generating predictions for ${symbol} across all 3 AI models in parallel...`, 'info');
  predictBtn.disabled = true;
  allResultsContainer.style.display = 'none';
  tabContainer.innerHTML = '';
  
  // Clean old charts if exist
  Object.keys(charts).forEach(k => {
    if (charts[k]) {
      charts[k].remove();
      charts[k] = null;
    }
  });

  const models = ['lstm', 'finbert', 'rf'];
  
  // Set UI Loading spinners
  models.forEach(m => {
    const el = document.getElementById(`spinner_${m}`);
    if (el) el.innerText = '⏳ (Running...)';
  });
  const conclusionSpinner = document.getElementById('spinner_conclusion');
  if (conclusionSpinner) conclusionSpinner.innerText = '⏳';

  // Pre-create tabs
  if (tabContainer) {
    tabContainer.innerHTML = `
      <div id="tab_lstm" class="tab-content active"><p style="padding: 20px; color: var(--text-muted);">Generating LSTM neural network prediction...</p></div>
      <div id="tab_finbert" class="tab-content"><p style="padding: 20px; color: var(--text-muted);">Generating FinBERT sentiment & price model...</p></div>
      <div id="tab_rf" class="tab-content"><p style="padding: 20px; color: var(--text-muted);">Generating Random Forest regressor...</p></div>
      <div id="tab_conclusion" class="tab-content"><p style="padding: 20px; color: var(--text-muted);">Computing consensus from models...</p></div>
    `;
  }

  let historyPoints = [];
  const allForecasts = { lstm: [], finbert: [], rf: [], consensus: [] };
  
  // Clear overview KPI
  ['current', 'lstm', 'finbert', 'rf'].forEach(key => {
    const el = document.getElementById(`overview_${key}`);
    if (el) el.textContent = '—';
  });

  if (allResultsContainer) allResultsContainer.style.display = 'block';
  
  const renderModel = (mod, data) => {
    // 1. Update Overview KPI
    const kpiEl = document.getElementById(`overview_${mod}`);
    if (kpiEl) kpiEl.textContent = data.predictions ? formatMoneyLocal(data.predictions['20']) : '—';
    
    const currentOverviewNode = document.getElementById('overview_current');
    if (currentOverviewNode && (currentOverviewNode.textContent === '—' || !currentOverviewNode.textContent) && data.currentPrice) {
      currentOverviewNode.textContent = formatMoneyLocal(data.currentPrice);
    }
    
    // Update Stock Symbol/Name header if missing
    const overviewLabel = document.getElementById('overview_stock_label');
    if (overviewLabel && data.symbol && (!overviewLabel.textContent || overviewLabel.textContent === '—')) {
      overviewLabel.textContent = `${data.symbol} - ${data.name || ''}`;
    }
    
    // 2. Render Tab HTML
    const container = document.getElementById(`tab_${mod}`);
    if (container) {
      container.innerHTML = generateTabHtml(mod, data);
      if (!data.error && data.history && data.forecast) {
        charts[mod] = createPredictionChart(`predictionChart_${mod}`, data, mod);
      }
    }
  };

  try {
    // Parallel Fetch across all 3 models with independent controllers
    const fetchPromises = models.map(async (mod) => {
      const spinner = document.getElementById(`spinner_${mod}`);
      const modelController = new AbortController();
      const modelTimeoutId = setTimeout(() => modelController.abort(), 45000); // 45s independent timeout

      try {
        let apiModel = mod;
        if (mod === 'rf') apiModel = 'random_forest';

        const res = await fetch(`${API_BASE}/prediction/${encodeURIComponent(symbol)}?model=${encodeURIComponent(apiModel)}`, {
          signal: modelController.signal
        });
        clearTimeout(modelTimeoutId);

        const data = await res.json();
        if (!res.ok) throw new Error(data.details || data.message || 'API request failed');

        renderModel(mod, data);
        if (data.history?.length > historyPoints.length) historyPoints = data.history;
        if (data.forecast?.length) allForecasts[mod] = data.forecast;
        if (spinner) spinner.innerText = '✅';
        return { mod, success: true, data };
      } catch (err) {
        clearTimeout(modelTimeoutId);
        let errorMsg = err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Failed');
        renderModel(mod, { error: errorMsg });
        if (spinner) spinner.innerText = '❌';
        return { mod, success: false, error: errorMsg };
      }
    });

    const results = await Promise.allSettled(fetchPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    // Compute Consensus
    const conclusionTab = document.getElementById('tab_conclusion');
    const allDates = [...new Set(Object.values(allForecasts).flat().map(v => v.date))].sort();
    allDates.forEach(date => {
      let sum = 0, count = 0;
      ['lstm', 'finbert', 'rf'].forEach(m => {
        const pt = allForecasts[m].find(p => p.date === date);
        if (pt) { sum += Number(pt.value); count++; }
      });
      if (count > 0) allForecasts.consensus.push({ date, value: sum / count });
    });

    if (conclusionTab) {
      if (allForecasts.consensus.length > 0) {
        conclusionTab.innerHTML = `
          <div class="kpi-row" style="flex-wrap: wrap;">
            <div class="kpi">
              <div class="kpi-label">Consensus</div>
              <div class="kpi-value">Averaged from ${successCount} successful model${successCount > 1 ? 's' : ''}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">20-Day Target</div>
              <div class="kpi-value predict-val">${formatMoneyLocal(allForecasts.consensus[allForecasts.consensus.length - 1].value)}</div>
            </div>
          </div>
          
          <div class="trading-chart-wrapper" id="chartWrapper_conclusion">
            <div class="trading-chart-header">
              <div class="trading-chart-left">
                <span class="stock-badge" style="background:rgba(217,70,239,0.15); color:#d946ef; border-color:rgba(217,70,239,0.3);">AI CONSENSUS</span>
                <span class="trading-quote-legend" id="chartLegend_conclusion"></span>
              </div>
              <div style="display:flex; gap:8px; align-items:center; font-size:var(--text-xs); color:var(--text-secondary);">
                <span>🔵 LSTM</span>
                <span>🟢 FinBERT</span>
                <span>🟠 RF</span>
                <span style="font-weight:700; color:#d946ef;">🟣 Consensus</span>
              </div>
            </div>
            <div id="predictionChart_conclusion" class="chart-canvas-box" style="height:420px;"></div>
          </div>

        `;
        charts.conclusion = createConclusionChart('predictionChart_conclusion', historyPoints, allForecasts);
        if (conclusionSpinner) conclusionSpinner.innerText = '✅';
      } else {
        conclusionTab.innerHTML = '<p style="padding: 20px; color: var(--text-muted);">Failed to calculate conclusion. Need at least one model forecast.</p>';
        if (conclusionSpinner) conclusionSpinner.innerText = '❌';
      }
    }

    if (successCount > 0) {
      setMsg(msg, `Predictions gathered successfully (${successCount}/3 models)!`, 'success');
      const dlAllBtn = document.getElementById('downloadAllBtn');
      if (dlAllBtn) dlAllBtn.style.display = 'flex';
    } else {
      setMsg(msg, 'All models failed to generate predictions. Please check the stock symbol or network connection.', 'error');
    }

  } catch (err) {
    setMsg(msg, 'An unexpected error occurred: ' + (err.message || ''), 'error');
  } finally {
    if (predictBtn) predictBtn.disabled = false;
  }
});

const updateAuthUI = () => {
  const token = getToken();
  const user = getUser();

  if (token && user) {
    // User is logged in
    authButtons.style.display = 'none';
    profileBtn.style.display = 'block';
    logoutBtn.style.display = 'block';
    if (user.name) {
      document.getElementById('profileInitial').textContent = user.name.charAt(0).toUpperCase();
    }
  } else {
    // User is not logged in
    authButtons.style.display = 'flex';
    profileBtn.style.display = 'none';
    logoutBtn.style.display = 'none';
  }
};

const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
};

const authButtons = document.getElementById('authButtons');
const profileBtn = document.getElementById('profileBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Initialize authentication UI
updateAuthUI();

const token = getToken();
if (!token) {
  setMsg(msg, 'Please login to make predictions', 'error');
  result.style.display = 'none';
}

// Theme toggle functionality (keep theme persistent across pages)
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

const setTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  if (themeIcon) themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
};

const toggleTheme = () => {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
};

const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme);

if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
}


document.getElementById('themeToggle')?.addEventListener('click', () => {
  setTimeout(() => {
    Object.keys(charts).forEach(key => {
      const chartObj = charts[key];
      if (chartObj) {
        const { chartBg, textColor, gridColor, borderColor } = getChartThemeColors();
        chartObj.applyOptions({
          layout: {
            background: { type: 'solid', color: chartBg },
            backgroundColor: chartBg,
            textColor: textColor
          },
          grid: {
            vertLines: { color: gridColor },
            horzLines: { color: gridColor }
          },
          rightPriceScale: { borderColor: borderColor },
          timeScale: { borderColor: borderColor }
        });
      }
    });
  }, 100);
});
