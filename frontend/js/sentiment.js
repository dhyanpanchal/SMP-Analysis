document.addEventListener('DOMContentLoaded', () => {
  const loadingState = document.getElementById('loadingState');
  const sentimentDashboard = document.getElementById('sentimentDashboard');
  
  const marketMood = document.getElementById('marketMood');
  const sentimentScore = document.getElementById('sentimentScore');
  const sentimentSummary = document.getElementById('sentimentSummary');
  
  const barPositive = document.getElementById('barPositive');
  const barNeutral = document.getElementById('barNeutral');
  const barNegative = document.getElementById('barNegative');
  
  const pctPositive = document.getElementById('pctPositive');
  const pctNeutral = document.getElementById('pctNeutral');
  const pctNegative = document.getElementById('pctNegative');
  
  const marketChartTitle = document.getElementById('marketChartTitle');
  const marketChartContainer = document.getElementById('marketChartContainer');
  const newsList = document.getElementById('newsList');

  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' ? 'http://localhost:5000/api' : window.location.origin + '/api';

  // Fetch the sentiment data from backend
  async function fetchSentiment() {
    try {
      const response = await fetch(`${API_BASE}/sentiment/market`);
      
      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
         data = await response.json();
      } else {
         const text = await response.text();
         throw new Error(`Unexpected response: ${text.substring(0, 50)}...`);
      }

      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch sentiment data');
      }

      renderDashboard(data);
    } catch (err) {
      console.error(err);
      loadingState.innerHTML = `<h2 style="color: #ef4444;">Error</h2><p>${err.message}</p>`;
    }
  }

  function renderDashboard(data) {
    loadingState.style.display = 'none';
    sentimentDashboard.style.display = 'block';

    const { sentiment, news, marketGraph } = data;

    // KPI row
    let moodIcon = '➖';
    let moodColor = 'var(--text)';
    if (sentiment.label === 'Positive') { moodIcon = '🟢'; moodColor = '#10b981'; }
    if (sentiment.label === 'Negative') { moodIcon = '🔴'; moodColor = '#ef4444'; }
    
    marketMood.innerHTML = `${moodIcon} <span style="color:${moodColor}; font-weight:700;">${sentiment.label}</span>`;
    
    const scoreVal = parseFloat(sentiment.score);
    sentimentScore.innerHTML = `<span style="color:${moodColor}; font-weight:700;">${scoreVal > 0 ? '+' : ''}${scoreVal.toFixed(3)}</span>`;
    
    sentimentSummary.innerText = sentiment.summary;

    // Breakdown bars
    const positive = sentiment.breakdown.positive;
    const neutral = sentiment.breakdown.neutral;
    const negative = sentiment.breakdown.negative;

    barPositive.style.width = `${positive}%`;
    barNeutral.style.width = `${neutral}%`;
    barNegative.style.width = `${negative}%`;

    pctPositive.innerText = positive;
    pctNeutral.innerText = neutral;
    pctNegative.innerText = negative;

    // News list
    newsList.innerHTML = '';
    news.forEach(item => {
      const el = document.createElement('div');
      el.style.borderBottom = '1px solid var(--border)';
      el.style.paddingBottom = '10px';
      
      const badgeColor = item.category === 'Global' ? '#3b82f6' : '#f59e0b';
      
      el.innerHTML = `
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
          <span>${item.publisher || 'News'}</span>
          <span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 4px;">${item.category}</span>
        </div>
        <a href="${item.link || '#'}" target="_blank" style="color: var(--text); text-decoration: none; font-size: 0.95rem; font-weight: 600; display: block; line-height: 1.4;">${item.title}</a>
      `;
      newsList.appendChild(el);
    });

    if (news.length === 0) {
      newsList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No recent news found.</p>`;
    }

    // Chart
    if (marketGraph && marketGraph.history && marketGraph.history.length > 0) {
      marketChartTitle.innerText = `Entire Market Graph (${marketGraph.symbol})`;
      renderChart(marketGraph.history, marketGraph.forecast);
    } else {
      marketChartContainer.innerHTML = `<p style="color:var(--text-muted); padding:20px;">Chart data not available.</p>`;
    }
  }

  function renderChart(historyData, forecastData) {
    marketChartContainer.innerHTML = '';
    
    // Check if dark mode is active to style the chart
    const isDarkMode = document.body.dataset.theme === 'dark' || document.documentElement.dataset.theme === 'dark';
    
    const chart = LightweightCharts.createChart(marketChartContainer, {
      width: marketChartContainer.clientWidth,
      height: 350,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: isDarkMode ? '#d1d5db' : '#333',
      },
      grid: {
        vertLines: { color: isDarkMode ? '#374151' : '#e5e7eb' },
        horzLines: { color: isDarkMode ? '#374151' : '#e5e7eb' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: isDarkMode ? '#374151' : '#e5e7eb',
      },
      timeScale: {
        borderColor: isDarkMode ? '#374151' : '#e5e7eb',
        timeVisible: true,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444'
    });

    // Format data
    const sortedData = historyData.map(d => ({
      time: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close
    })).sort((a, b) => new Date(a.time) - new Date(b.time));

    candlestickSeries.setData(sortedData);

    // Render Forecast Line
    if (forecastData && forecastData.length > 0) {
      const forecastSeries = chart.addLineSeries({
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: 1 // Dashed
      });
      
      const lastHistory = sortedData[sortedData.length - 1];
      const fd = forecastData.map(d => ({
        time: d.date,
        value: d.value
      })).sort((a, b) => new Date(a.time) - new Date(b.time));
      
      // Connect line to the last candlestick close
      if (lastHistory) {
        fd.unshift({ time: lastHistory.time, value: lastHistory.close });
      }
      
      forecastSeries.setData(fd);
    }

    chart.timeScale().fitContent();

    // Handle resize
    window.addEventListener('resize', () => {
      chart.applyOptions({ width: marketChartContainer.clientWidth });
    });
  }

  // Init
  fetchSentiment();
});

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
  
  // Reload the page to rerender the chart with new colors (quick fix to re-calc chart theme)
  setTimeout(() => window.location.reload(), 100);
};

const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme);

if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
}

