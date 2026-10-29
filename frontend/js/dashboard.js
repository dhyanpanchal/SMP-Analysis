const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' ? 'http://localhost:5000/api' : window.location.origin + '/api';

const getToken = () => localStorage.getItem('token');
const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
};

const setMsg = (el, text, type) => {
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('error', 'success');
  if (type) el.classList.add(type);
};

/* ══════════════════════════════════════════════════════════
   3D CURSOR BLOB — Smooth RAF Mouse Tracking
   ══════════════════════════════════════════════════════════ */

const cursorState = { x: 0, y: 0, targetX: 0, targetY: 0 };

document.addEventListener('DOMContentLoaded', () => {
  const blob = document.getElementById('cursorBlob');
  if (!blob) return;

  document.addEventListener('mousemove', (e) => {
    cursorState.targetX = e.clientX;
    cursorState.targetY = e.clientY;
  });

  // Smooth interpolation loop
  const lerp = (a, b, t) => a + (b - a) * t;
  const animate = () => {
    cursorState.x = lerp(cursorState.x, cursorState.targetX, 0.08);
    cursorState.y = lerp(cursorState.y, cursorState.targetY, 0.08);
    blob.style.transform = `translate(${cursorState.x - 250}px, ${cursorState.y - 250}px)`;
    requestAnimationFrame(animate);
  };
  animate();

  // Setup tilt for initial cards
  setupTilt();
});

/* ══════════════════════════════════════════════════════════
   3D CARD TILT — Perspective mouse tracking on glass cards
   ══════════════════════════════════════════════════════════ */

const setupTilt = () => {
  const elements = document.querySelectorAll('.card, .portfolio-card, .watchlist-section, .pro-tip-card');
  elements.forEach(el => {
    if (el.dataset.tiltSetup) return;
    el.dataset.tiltSetup = 'true';

    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const rotateX = ((y - cy) / cy) * -3;
      const rotateY = ((x - cx) / cx) * 3;

      el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.008, 1.008, 1.008)`;
      el.style.boxShadow = `0 12px 40px rgba(25, 28, 30, 0.08), ${-rotateY * 0.5}px ${rotateX * 0.5}px 16px rgba(79, 124, 255, 0.04)`;
    });

    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
      el.style.boxShadow = '';
    });
  });
};

/* ══════════════════════════════════════════════════════════
   STOCK ICON COLORS — Deterministic color from symbol
   ══════════════════════════════════════════════════════════ */

const stockColors = {
  'RELIANCE': '#3B82F6', 'TCS': '#8B5CF6', 'INFY': '#06B6D4',
  'HDFCBANK': '#0EA5E9', 'SBIN': '#2563EB', 'ICICIBANK': '#7C3AED',
  'KOTAKBANK': '#EC4899', 'HINDUNILVR': '#10B981', 'ITC': '#F59E0B',
  'BHARTIARTL': '#EF4444', 'AXISBANK': '#8B5CF6', 'MARUTI': '#F97316',
  'ASIANPAINT': '#14B8A6', 'HCLTECH': '#6366F1', 'SUNPHARMA': '#0891B2',
  'WIPRO': '#7C3AED', 'TITAN': '#D946EF', 'BAJFINANCE': '#2DD4BF',
};

const getStockColor = (symbol) => {
  const clean = symbol.replace(/\.(NS|BO)$/i, '');
  if (stockColors[clean]) return stockColors[clean];
  let hash = 0;
  for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 50%)`;
};

/* ══════════════════════════════════════════════════════════
   PORTFOLIO CARDS — Horizontal scrolling stock mini cards
   ══════════════════════════════════════════════════════════ */

const topPortfolioSymbols = [
  'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS',
  'SBIN.NS', 'ICICIBANK.NS', 'KOTAKBANK.NS', 'HINDUNILVR.NS'
];

const renderPortfolioCards = (results) => {
  const container = document.getElementById('portfolioScroll');
  if (!container) return;
  container.innerHTML = '';

  const filtered = results.filter(r => topPortfolioSymbols.includes(r.symbol) && !r.error);
  if (filtered.length === 0) return;

  filtered.forEach(stock => {
    const clean = stock.symbol.replace(/\.(NS|BO)$/i, '');
    const color = getStockColor(stock.symbol);
    const price = stock.currentPrice || 0;
    const prevClose = stock.previousClose || price;
    const rawChange = prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : 0;
    const change = rawChange.toFixed(2);
    const isPositive = rawChange >= 0;

    const card = document.createElement('div');
    card.className = 'portfolio-card';
    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="stock-icon" style="background:${color};">${clean.charAt(0)}</div>
        <span class="stock-name">${clean}</span>
        <span style="font-size:10px; padding:2px 6px; border-radius:4px; background:var(--success-bg); color:var(--success); font-weight:600; margin-left:auto;">NSE</span>
      </div>
      <div class="stock-info">
        <span class="stock-label">Total Shares</span>
        <span class="stock-price">${fmtMoney(price, stock.currency)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="stock-label">Total Return</span>
        <span class="stock-change ${isPositive ? 'positive' : 'negative'}">${isPositive ? '+' : ''}${change}% ${isPositive ? '↑' : '↓'}</span>
      </div>
      <svg class="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
        <polyline fill="none" stroke="${isPositive ? 'var(--success)' : 'var(--danger)'}" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round"
          points="${generateSparkline(stock.symbol)}" />
      </svg>
    `;
    card.addEventListener('click', () => openChartModal(stock.symbol));
    container.appendChild(card);
  });

  // Re-setup tilt for new cards
  setupTilt();
};

const generateSparkline = (symbol) => {
  let hash = 0;
  if(symbol) {
    for (let i = 0; i < symbol.length; i++) hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const seed = Math.abs(hash);
  const random = (i) => ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;
  
  const pts = [];
  let y = 15 + (random(0) - 0.5) * 10;
  for (let i = 0; i <= 20; i++) {
    y += (random(i) - 0.48) * 4;
    y = Math.max(2, Math.min(28, y));
    pts.push(`${(i / 20) * 100},${y}`);
  }
  return pts.join(' ');
};

/* ══════════════════════════════════════════════════════════
   WATCHLIST — Right panel favorites
   ══════════════════════════════════════════════════════════ */

let watchlistSymbols = [
  'INFY.NS', 'TCS.NS', 'SBIN.NS', 'HDFCBANK.NS', 'RELIANCE.NS', 'ITC.NS'
];
try {
  const savedWatchlist = localStorage.getItem('userWatchlist');
  if (savedWatchlist) {
    watchlistSymbols = JSON.parse(savedWatchlist);
  }
} catch(e) {}

const stockFullNames = {
  'RELIANCE': 'Reliance Industries', 'TCS': 'Tata Consultancy',
  'INFY': 'Infosys Ltd', 'HDFCBANK': 'HDFC Bank Ltd',
  'SBIN': 'State Bank of India', 'ICICIBANK': 'ICICI Bank Ltd',
  'KOTAKBANK': 'Kotak Mahindra Bank', 'HINDUNILVR': 'Hindustan Unilever',
  'ITC': 'ITC Limited', 'BHARTIARTL': 'Bharti Airtel',
  'AXISBANK': 'Axis Bank', 'MARUTI': 'Maruti Suzuki',
  'WIPRO': 'Wipro Limited', 'TITAN': 'Titan Company',
  'BAJFINANCE': 'Bajaj Finance', 'SUNPHARMA': 'Sun Pharma',
};

const renderWatchlist = (results) => {
  const container = document.getElementById('watchlistContainer');
  if (!container) return;
  container.innerHTML = '';

  const filtered = results.filter(r => watchlistSymbols.includes(r.symbol) && !r.error);

  filtered.forEach(stock => {
    const clean = stock.symbol.replace(/\.(NS|BO)$/i, '');
    const color = getStockColor(stock.symbol);
    const price = stock.currentPrice || 0;
    const prevClose = stock.previousClose || price;
    const rawChange = prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : 0;
    const change = rawChange.toFixed(2);
    const isPositive = rawChange >= 0;
    const fullName = stockFullNames[clean] || stock.name || clean;

    const item = document.createElement('div');
    item.className = 'watchlist-item';
    item.innerHTML = `
      <div class="watchlist-icon" style="background:${color};">${clean.charAt(0)}</div>
      <div class="watchlist-info">
        <div class="watchlist-symbol">${clean}</div>
        <div class="watchlist-name">${fullName}</div>
      </div>
      <div class="watchlist-price-col">
        <div class="watchlist-price">${fmtMoney(price, stock.currency)}</div>
        <div class="watchlist-change ${isPositive ? 'positive' : 'negative'}">${isPositive ? '+' : ''}${change}%</div>
      </div>
    `;
    item.addEventListener('click', () => openChartModal(stock.symbol));
    container.appendChild(item);
  });
};


const requireAuth = () => {
  const token = getToken();
  if (!token) window.location.href = 'login.html';
  return token;
};

const fmtMoney = (n, currency = 'INR') => {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  try {
    return x.toLocaleString('en-IN', { style: 'currency', currency });
  } catch {
    return x.toFixed(2) + ' ' + currency;
  }
};

let watchlist = [
  // NSE Large Cap Blue Chips — primary market table (issue #1: keep to ≤50 unique symbols)
  'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'SBIN.NS',
  'ICICIBANK.NS', 'KOTAKBANK.NS', 'HINDUNILVR.NS', 'ITC.NS', 'BHARTIARTL.NS',

  // Additional Large Cap
  'AXISBANK.NS', 'MARUTI.NS', 'ASIANPAINT.NS', 'HCLTECH.NS', 'SUNPHARMA.NS',
  'ULTRACEMCO.NS', 'TITAN.NS', 'WIPRO.NS', 'ONGC.NS', 'NTPC.NS',

  // Mid Cap & Sector Leaders
  'POWERGRID.NS', 'COALINDIA.NS', 'BAJFINANCE.NS', 'BAJAJFINSV.NS', 'DIVISLAB.NS',
  'DRREDDY.NS', 'ADANIPORTS.NS', 'GRASIM.NS', 'JSWSTEEL.NS', 'HINDALCO.NS',

  // More Sector Leaders
  'TATASTEEL.NS', 'TECHM.NS', 'CIPLA.NS', 'BPCL.NS', 'GAIL.NS',
  'DABUR.NS', 'BRITANNIA.NS', 'HAVELLS.NS', 'VOLTAS.NS', 'TATACONSUM.NS',

  // Financial & Auto
  'CHOLAFIN.NS', 'MRF.NS', 'EICHERMOT.NS', 'HEROMOTOCO.NS', 'TVSMOTOR.NS',

  // Pharma & Tech
  'LUPIN.NS', 'AUROPHARMA.NS', 'MPHASIS.NS', 'LTIM.NS', 'PERSISTENT.NS'
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const safeReadJson = async (res) => {
  const contentType = String(res.headers.get('content-type') || '');
  if (contentType.includes('application/json')) return res.json();

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: text || 'Unexpected response' };
  }
};

const marketTbody = document.querySelector('#marketTable tbody');
const dashMsg = document.getElementById('dashMsg');
const userInfo = document.getElementById('userInfo');

const modal = document.getElementById('tradeModal');
const tradeForm = document.getElementById('tradeForm');
const tradeMsg = document.getElementById('tradeMsg');
const tradeTitle = document.getElementById('tradeTitle');

const profileModal = document.getElementById('profileModal');
const profileContent = document.getElementById('profileContent');
const authButtons = document.getElementById('authButtons');
const profileBtn = document.getElementById('profileBtn');
const logoutBtn = document.getElementById('logoutBtn');

const openModal = () => {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
};

const closeModal = () => {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  setMsg(tradeMsg, '');
  tradeForm.reset();
};

const openProfileModal = () => {
  profileModal.classList.add('open');
  profileModal.setAttribute('aria-hidden', 'false');
  loadProfile();
};

const closeProfileModal = () => {
  profileModal.classList.remove('open');
  profileModal.setAttribute('aria-hidden', 'true');
};

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  // Update UI to show non-logged-in state instead of redirecting
  updateAuthUI();
  // Clear user info and show welcome message for non-logged-in users
  userInfo.textContent = 'Welcome to Stock Market Dashboard 👋';
  // Show a brief logout message
  setMsg(dashMsg, 'Logged out successfully', 'success');
  setTimeout(() => setMsg(dashMsg, ''), 2000);
});

document.getElementById('profileBtn').addEventListener('click', openProfileModal);

modal.addEventListener('click', (e) => {
  const close = e.target?.dataset?.close;
  if (close) closeModal();
});

profileModal.addEventListener('click', (e) => {
  const close = e.target?.dataset?.close;
  if (close) closeProfileModal();
});

const chartModal = document.getElementById('chartModal');
const chartContainer = document.getElementById('chartContainer');
const chartTitle = document.getElementById('chartTitle');
const chartMsg = document.getElementById('chartMsg');
let chart = null;
let candleSeries = null;
let currentChartSymbol = '';

const openChartModal = (symbol) => {
  chartModal.classList.add('open');
  chartModal.setAttribute('aria-hidden', 'false');
  chartTitle.textContent = `${symbol} - Live Candlestick Chart`;
  currentChartSymbol = symbol;
  loadChartData(symbol);
};

const closeChartModal = () => {
  exitFullscreen();
  chartModal.classList.remove('open');
  chartModal.setAttribute('aria-hidden', 'true');
  if (chart) {
    chart.remove();
    chart = null;
    candleSeries = null;
  }
};

const watchlistAddBtn = document.querySelector('.watchlist-add');
if (watchlistAddBtn) {
  watchlistAddBtn.addEventListener('click', () => {
    const sym = prompt('Enter Stock Symbol to add (e.g., RELIANCE.NS, AAPL):');
    if (sym && sym.trim() !== '') {
      const clean = sym.trim().toUpperCase();
      if (!watchlistSymbols.includes(clean)) {
        watchlistSymbols.push(clean);
        localStorage.setItem('userWatchlist', JSON.stringify(watchlistSymbols));
      }
      if (!watchlist.includes(clean)) {
        watchlist.unshift(clean);
      }
      loadMarket();
    }
  });
}

const syncChartSize = () => {
  if (!chart || !chartContainer) return;
  const width = chartContainer.clientWidth;
  const height = chartContainer.clientHeight;
  chart.applyOptions({ width, height });
  chart.timeScale().fitContent();
};

window.addEventListener('resize', syncChartSize);

chartModal.addEventListener('click', (e) => {
  if (e.target.dataset.closeChart) closeChartModal();
});

const fullscreenBtn = document.getElementById('fullscreenBtn');
let isFullscreen = false;

const exitFullscreen = () => {
  if (!isFullscreen) return;
  isFullscreen = false;
  chartModal.querySelector('.modal-card').classList.remove('chart-fullscreen');
  fullscreenBtn.textContent = '⛶';
  syncChartSize();
};

if (fullscreenBtn) {
  fullscreenBtn.addEventListener('click', () => {
    isFullscreen = !isFullscreen;
    chartModal.querySelector('.modal-card').classList.toggle('chart-fullscreen', isFullscreen);
    fullscreenBtn.textContent = isFullscreen ? '🡼' : '⛶';

    // Call multiple times to ensure we catch the end of any CSS transitions
    setTimeout(syncChartSize, 50);
    setTimeout(syncChartSize, 150);
    setTimeout(syncChartSize, 300);
    setTimeout(syncChartSize, 600);
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') exitFullscreen();
});

// Range button listeners
document.querySelectorAll('[data-range]').forEach(btn => {
  btn.addEventListener('click', () => {
    const range = btn.dataset.range;
    const interval = btn.dataset.interval;

    // Update button styles
    document.querySelectorAll('[data-range]').forEach(b => b.classList.add('btn-secondary'));
    btn.classList.remove('btn-secondary');

    loadChartData(currentChartSymbol, range, interval);
  });
});

const loadChartData = async (symbol, range = '1d', interval = '1m') => {
  chartContainer.innerHTML = '<div class="chart-loading">Loading chart data...</div>';
  setMsg(chartMsg, '');

  try {
    const res = await fetch(`${API_BASE}/stocks/${encodeURIComponent(symbol)}/chart?range=${range}&interval=${interval}`);
    const data = await safeReadJson(res);

    if (!res.ok) throw new Error(data.message || 'Failed to fetch chart data');

    renderChart(data.data, symbol, data.meta);
  } catch (err) {
    chartContainer.innerHTML = `<div class="chart-loading error">Error: ${err.message}</div>`;
  }
};

const ohlcElements = {
  open: document.getElementById('ohlcOpen'),
  close: document.getElementById('ohlcClose'),
  high: document.getElementById('ohlcHigh'),
  low: document.getElementById('ohlcLow'),
  volume: document.getElementById('ohlcVolume'),
  time: document.getElementById('ohlcTime'),
  // Summary elements
  livePrice: document.getElementById('livePrice'),
  liveChange: document.getElementById('liveChange'),
  dayHigh: document.getElementById('dayHigh'),
  dayLow: document.getElementById('dayLow'),
  prevClose: document.getElementById('prevClose')
};

const updateMarketSummary = (meta, lastCandle) => {
  if (!meta) return;

  const ltp = meta.regularMarketPrice || (lastCandle ? lastCandle.close : 0);
  const prevClose = meta.previousClose || meta.chartPreviousClose || 0;
  const change = ltp - prevClose;
  const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

  const currency = window.currentChartCurrency || 'INR';
  ohlcElements.livePrice.textContent = fmtMoney(ltp, currency);

  const color = change >= 0 ? '#26a69a' : '#ef5350';
  const sign = change >= 0 ? '+' : '';
  ohlcElements.liveChange.textContent = `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`;
  ohlcElements.liveChange.style.color = color;

  // Calculate Day High/Low from regular market data if possible, else from chart
  ohlcElements.dayHigh.textContent = meta.regularMarketDayHigh ? meta.regularMarketDayHigh.toFixed(2) : '—';
  ohlcElements.dayLow.textContent = meta.regularMarketDayLow ? meta.regularMarketDayLow.toFixed(2) : '—';
  ohlcElements.prevClose.textContent = prevClose.toFixed(2);
};

const updateOHLC = (hoveredCandle, allData) => {
  if (!hoveredCandle || !allData) return;

  // Identify the 5-minute window containing the hovered candle
  // We align to 5-minute increments (0, 5, 10, etc.)
  const windowSize = 5 * 60; // 5 minutes in seconds
  const windowStart = Math.floor(hoveredCandle.time / windowSize) * windowSize;
  const windowEnd = windowStart + windowSize;

  const windowCandles = allData.filter(d => d.time >= windowStart && d.time < windowEnd);
  if (windowCandles.length === 0) return;

  // Aggregate stats for the 5-minute window
  const open = windowCandles[0].open;
  const close = windowCandles[windowCandles.length - 1].close;
  const high = Math.max(...windowCandles.map(c => c.high));
  const low = Math.min(...windowCandles.map(c => c.low));
  const volume = windowCandles.reduce((sum, c) => sum + c.volume, 0);

  // Update Elements
  ohlcElements.open.textContent = open.toFixed(2);
  ohlcElements.close.textContent = close.toFixed(2);
  ohlcElements.high.textContent = high.toFixed(2);
  ohlcElements.low.textContent = low.toFixed(2);
  ohlcElements.volume.textContent = volume.toLocaleString('en-IN');

  const formatDate = (t) => new Date(t * 1000).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
  const timeRangeStr = `${formatDate(windowStart)} - ${formatDate(windowEnd)}`;
  ohlcElements.time.textContent = timeRangeStr;

  const color = close >= open ? '#26a69a' : '#ef5350';
  ohlcElements.close.style.color = color;
};

const renderChart = (data, symbol, meta) => {
  chartContainer.innerHTML = '';

  const formattedData = data.map(d => ({
    time: d.time,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: d.volume
  })).sort((a, b) => a.time - b.time);

  const getCssVar = (name, fallback) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  };

  const chartOptions = {
    width: chartContainer.clientWidth,
    height: chartContainer.clientHeight || 500,
    layout: {
      background: { color: getCssVar('--panel', '#ffffff') },
      textColor: getCssVar('--text', '#111111'),
    },
    grid: {
      vertLines: { color: getCssVar('--border', 'rgba(0,0,0,0.15)') },
      horzLines: { color: getCssVar('--border', 'rgba(0,0,0,0.15)') },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
    rightPriceScale: {
      borderColor: '#30363d',
    },
    timeScale: {
      borderColor: '#30363d',
      timeVisible: true,
      secondsVisible: false,
      fixLeftEdge: true,
      fixRightEdge: true,
      tickMarkFormatter: (time, tickMarkType, locale) => {
        const date = new Date(time * 1000);
        if (tickMarkType < 2) { // Day or Week
          return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
        }
        return date.toLocaleTimeString(locale, {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }).toUpperCase();
      },
    },
    localization: {
      locale: 'en-IN',
      timeFormatter: (time) => {
        const date = new Date(time * 1000);
        return date.toLocaleTimeString('en-IN', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }).toUpperCase();
      },
      priceFormatter: (price) => fmtMoney(price, window.currentChartCurrency || 'INR'),
    },
  };

  chart = LightweightCharts.createChart(chartContainer, chartOptions);

  chart.applyOptions({
    width: chartContainer.clientWidth,
    height: chartContainer.clientHeight,
  });

  candleSeries = chart.addCandlestickSeries({
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
  });

  candleSeries.setData(formattedData);

  const lastCandle = formattedData[formattedData.length - 1];

  // Set default values
  updateMarketSummary(meta, lastCandle);
  if (lastCandle) {
    updateOHLC(lastCandle, formattedData);
  }

  // Handle crosshair movement
  chart.subscribeCrosshairMove((param) => {
    if (param.time) {
      const candle = formattedData.find(d => d.time === param.time);
      if (candle) updateOHLC(candle, formattedData);
    } else if (lastCandle) {
      // Revert to latest if not hovering over a point
      updateOHLC(lastCandle, formattedData);
    }
  });

  // Store currency for the price formatter
  window.currentChartCurrency = data.currency || 'INR';

  // Fit content
  chart.timeScale().fitContent();

  // Responsive chart
  const handleResize = () => {
    if (chart && chartContainer) {
      chart.applyOptions({
        width: chartContainer.clientWidth,
        height: chartContainer.clientHeight,
      });
      chart.timeScale().fitContent();
    }
  };

  // Resize right after render + on window resize
  setTimeout(handleResize, 50);
  window.addEventListener('resize', handleResize);
};


const loadProfile = async () => {
  const token = requireAuth();

  try {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await safeReadJson(res);

    if (res.ok && data.user) {
      const user = data.user;
      const createdDate = new Date(user.createdAt).toLocaleDateString();
      const updatedDate = new Date(user.updatedAt).toLocaleDateString();

      profileContent.innerHTML = `
        <div class="profile-section">
          <div class="profile-header">
            <div class="profile-avatar">${user.name.charAt(0).toUpperCase()}</div>
            <div class="profile-info">
              <h3 class="profile-name">${user.name}</h3>
              <p class="profile-email">${user.email}</p>
            </div>
          </div>
          
          <div class="profile-details">
            <div class="profile-item profile-balance">
              <span class="profile-label">
                💰 Balance
              </span>
              <span class="profile-value">${fmtMoney(user.balance)}</span>
            </div>
            
            <div class="profile-item">
              <span class="profile-label">
                📅 Member Since
              </span>
              <span class="profile-value">${createdDate}</span>
            </div>
            
            <div class="profile-item">
              <span class="profile-label">
                🔄 Last Updated
              </span>
              <span class="profile-value">${updatedDate}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      profileContent.innerHTML = `<p class="error">Failed to load profile: ${data.message || 'Unknown error'}</p>`;
    }
  } catch (err) {
    profileContent.innerHTML = `<p class="error">Network error. Please try again.</p>`;
  }
};

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
      userInfo.textContent = `Welcome ${user.name} 👋`;
    }
  } else {
    // User is not logged in
    authButtons.style.display = 'flex';
    profileBtn.style.display = 'none';
    logoutBtn.style.display = 'none';
    userInfo.textContent = 'Welcome to Stock Market Prediction 👋';
  }
};

const loadPortfolioBalance = async () => {
  const token = getToken();
  const user = getUser();

  // Update user info based on login status
  if (token && user && user.name) {
    userInfo.textContent = `Welcome ${user.name} 👋`;
  } else {
    userInfo.textContent = 'Welcome to Stock Market Prediction 👋';
  }

  const totalInvestmentEl = document.getElementById('totalInvestment');
  const investmentChangeEl = document.getElementById('investmentChange');

  if (!token) {
    // Not logged in — show dashes
    if (totalInvestmentEl) totalInvestmentEl.textContent = '—';
    if (investmentChangeEl) { investmentChangeEl.textContent = ''; investmentChangeEl.className = 'investment-change'; }
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/trade/portfolio`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (res.ok) {
      const holdings = data.holdings || [];

      // Sum qty × currentPrice for each holding
      let totalValue = 0;
      for (const h of holdings) {
        const qty = Number(h.quantity) || 0;
        const px  = Number(h.stock?.currentPrice) || 0;
        totalValue += qty * px;
      }

      if (totalInvestmentEl) {
        totalInvestmentEl.textContent = holdings.length === 0
          ? '₹0'
          : fmtMoney(totalValue);
      }

      // Hide change indicator when no holdings
      if (investmentChangeEl) {
        if (holdings.length === 0) {
          investmentChangeEl.textContent = 'No holdings yet';
          investmentChangeEl.className = 'investment-change';
          investmentChangeEl.style.color = 'var(--muted)';
          investmentChangeEl.style.fontSize = '11px';
        } else {
          // Clear the change label — no fictitious % shown
          investmentChangeEl.textContent = `${holdings.length} holding${holdings.length !== 1 ? 's' : ''}`;
          investmentChangeEl.className = 'investment-change';
          investmentChangeEl.style.color = 'var(--muted)';
          investmentChangeEl.style.fontSize = '11px';
        }
      }
    }
  } catch {
    // ignore network errors — keep showing previous state
  }
};

const fetchPrice = async (symbol) => {
  const res = await fetch(`${API_BASE}/stocks/${encodeURIComponent(symbol)}/price`);
  const data = await safeReadJson(res);
  if (!res.ok) throw new Error(data.message || 'Failed price');
  return data.stock;
};

const fetchMultiplePrices = async (symbols) => {
  const cacheBuster = `?force=true&_t=${Date.now()}`;
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/stocks/bulk-prices${cacheBuster}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ symbols })
  });
  const data = await safeReadJson(res);
  if (!res.ok) throw new Error(data.message || 'Failed to fetch multiple prices');
  return data.results;
};

const renderRow = (symbol, priceStock) => {
  const tr = document.createElement('tr');

  const price = priceStock?.currentPrice;
  const name = priceStock?.name || symbol;

  // Determine exchange from symbol
  const exchange = symbol.endsWith('.NS') ? 'NSE' : symbol.endsWith('.BO') ? 'BSE' : 'OTHER';
  const exchangeColor = exchange === 'NSE' ? '#28c76f' : exchange === 'BSE' ? '#ff6b35' : '#6c757d';

  const token = getToken();

  tr.innerHTML = `
    <td class="clickable-row" data-symbol="${symbol}">
      <div>
        <strong>${symbol}</strong>
        <div class="muted" style="font-size: 0.85em;">${name}</div>
        <div style="font-size: 0.75em; color: ${exchangeColor}; font-weight: 600;">${exchange}</div>
      </div>
    </td>
    <td>${fmtMoney(price, priceStock?.currency)}</td>
    <td>
      <div class="row">
        ${token ? `
          <button class="btn" data-side="BUY" data-symbol="${symbol}" data-price="${price}">Buy</button>
          <button class="btn btn-sell" data-side="SELL" data-symbol="${symbol}" data-price="${price}">Sell</button>
        ` : `
          <button class="btn" disabled onclick="alert('Please login to trade')">Login to Trade</button>
        `}
      </div>
    </td>
  `;

  tr.querySelector('.clickable-row').addEventListener('click', () => {
    openChartModal(symbol);
  });

  if (token) {

    tr.querySelectorAll('button[data-side]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const side = btn.dataset.side;
        const sym = btn.dataset.symbol;
        const px = Number(btn.dataset.price);

        tradeTitle.textContent = `${side} ${sym}`;
        tradeForm.elements.symbol.value = sym;
        tradeForm.elements.side.value = side;
        tradeForm.elements.price.value = Number.isFinite(px) ? px.toFixed(2) : '';
        tradeForm.elements.quantity.value = 1;
        openModal();
      });
    });
  }

  return tr;
};

let autoUpdateInterval;

const loadMarket = async (isAutoUpdate = false) => {
  if (!isAutoUpdate) {
    setMsg(dashMsg, 'Loading market data...');
    marketTbody.innerHTML = '';
  }

  try {
    // Load all stocks at once with optimized backend
    const freshResults = await fetchMultiplePrices(watchlist);

    // Update the table with fresh data
    marketTbody.innerHTML = '';
    freshResults.forEach((result) => {
      if (result.error) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${result.symbol}</td><td colspan="2" class="muted">Failed to load: ${result.error}</td>`;
        marketTbody.appendChild(tr);
      } else {
        marketTbody.appendChild(renderRow(result.symbol, result));
      }
    });

    if (!isAutoUpdate) {
      setMsg(dashMsg, `Loaded ${freshResults.length} stocks successfully`);
      startAutoUpdate();
    }

    // Render portfolio cards and watchlist with the loaded data
    renderPortfolioCards(freshResults);
    renderWatchlist(freshResults);
  } catch (err) {
    console.log('Loading failed:', err.message);

    // Fallback to parallel individual requests
    const stockPromises = watchlist.map(async (symbol) => {
      try {
        const stock = await fetchPrice(symbol);
        return { symbol, stock, error: null };
      } catch (err) {
        return { symbol, stock: null, error: String(err.message || err) };
      }
    });

    const results = await Promise.all(stockPromises);

    marketTbody.innerHTML = '';
    results.forEach(({ symbol, stock, error }) => {
      if (error) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${symbol}</td><td colspan="2" class="muted">Failed to load: ${error}</td>`;
        marketTbody.appendChild(tr);
      } else {
        marketTbody.appendChild(renderRow(symbol, stock));
      }
    });

    if (!isAutoUpdate) {
      setMsg(dashMsg, `Loaded ${results.length} stocks with fallback method`);
      startAutoUpdate();
    }

    // Render portfolio cards and watchlist with fallback data
    const normalizedResults = results.map(r => r.error ? { symbol: r.symbol, error: r.error } : { symbol: r.symbol, ...r.stock });
    renderPortfolioCards(normalizedResults);
    renderWatchlist(normalizedResults);
  }
};

// Auto-update function
const startAutoUpdate = () => {
  // Clear any existing interval
  if (autoUpdateInterval) {
    clearInterval(autoUpdateInterval);
  }

  // Set up auto-update every 5 seconds for all stocks
  autoUpdateInterval = setInterval(() => {
    loadMarket(true); // true indicates this is an auto-update
  }, 5000);
};

// Stop auto-update when page is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (autoUpdateInterval) {
      clearInterval(autoUpdateInterval);
      autoUpdateInterval = null;
    }
  } else {
    startAutoUpdate();
  }
});

// Stop auto-update when page is unloaded
window.addEventListener('beforeunload', () => {
  if (autoUpdateInterval) {
    clearInterval(autoUpdateInterval);
  }
});

// New function to fetch cached prices instantly
const fetchCachedPrices = async (symbols) => {
  try {
    const headers = {};
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/stocks`, { headers });
    const data = await safeReadJson(response);

    if (response.ok && data.stocks) {
      // Create a map of cached stocks by symbol
      const stockMap = {};
      data.stocks.forEach(stock => {
        stockMap[stock.symbol] = stock;
      });

      // Return cached data for watchlist symbols
      return symbols.map(symbol => stockMap[symbol] || null).filter(Boolean);
    }
  } catch (err) {
    console.log('Failed to fetch cached data:', err);
  }

  return [];
};

tradeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = getToken();

  if (!token) {
    setMsg(tradeMsg, 'Please login to trade', 'error');
    return;
  }

  const symbol = tradeForm.elements.symbol.value;
  const side = tradeForm.elements.side.value;
  const quantity = Number(tradeForm.elements.quantity.value);
  const price = Number(tradeForm.elements.price.value);

  setMsg(tradeMsg, 'Processing...');

  try {
    const endpoint = side === 'SELL' ? 'sell' : 'buy';
    const res = await fetch(`${API_BASE}/trade/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ symbol, quantity, price })
    });

    const data = await res.json();
    if (!res.ok) {
      setMsg(tradeMsg, data.message || 'Trade failed', 'error');
      return;
    }

    setMsg(tradeMsg, data.message || 'Done', 'success');

    setTimeout(() => {
      closeModal();
      loadPortfolioBalance();
    }, 450);
  } catch {
    setMsg(tradeMsg, 'Network error. Is the backend running?', 'error');
  }
});

document.getElementById('refreshBtn').addEventListener('click', () => {
  // Stop current auto-update and restart with fresh data
  if (autoUpdateInterval) {
    clearInterval(autoUpdateInterval);
    autoUpdateInterval = null;
  }
  loadMarket();
});

// Theme toggle functionality
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

const setTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
};

const toggleTheme = () => {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
};

// Load saved theme or default to dark
const savedTheme = localStorage.getItem('theme') || 'dark';
setTheme(savedTheme);

if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
}

// Initialize the page
updateAuthUI();
loadPortfolioBalance();
loadMarket();
