const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' ? 'http://localhost:5000/api' : window.location.origin + '/api';

const getToken = () => localStorage.getItem('token');
const getUser = () => {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
};
const requireAuth = () => {
  const token = getToken();
  if (!token) {
    setMsg(portMsg, 'Please login to view portfolio', 'error');
    return null;
  }
  return token;
};

const setMsg = (el, text, type) => {
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('error', 'success');
  if (type) el.classList.add(type);
};

const fmtMoney = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
};

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  // Update UI to show non-logged-in state instead of redirecting
  updateAuthUI();
  // Clear portfolio data and show login prompt
  if (balanceEl) balanceEl.textContent = '—';
  holdingsBody.innerHTML = '<tr><td colspan="4" class="muted">Please login to view portfolio</td></tr>';
  txBody.innerHTML = '<tr><td colspan="6" class="muted">Please login to view transactions</td></tr>';
  setMsg(portMsg, 'Logged out successfully', 'success');
  setTimeout(() => setMsg(portMsg, 'Please login to view portfolio', 'error'), 2000);
});

const balanceEl = document.getElementById('balance');
const holdingsBody = document.querySelector('#holdingsTable tbody');
const txBody = document.querySelector('#txTable tbody');
const portMsg = document.getElementById('portMsg');
const authButtons = document.getElementById('authButtons');
const profileBtn = document.getElementById('profileBtn');
const logoutBtn = document.getElementById('logoutBtn');

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

const loadPortfolio = async () => {
  const token = requireAuth();
  if (!token) return;
  setMsg(portMsg, 'Loading portfolio...');

  try {
    const res = await fetch(`${API_BASE}/trade/portfolio`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) {
      setMsg(portMsg, data.message || 'Failed to load portfolio', 'error');
      return;
    }

    if (balanceEl) balanceEl.textContent = fmtMoney(data.balance);

    const symbols = data.holdings.map(h => h.stock?.symbol).filter(Boolean);
    let livePrices = {};

    if (symbols.length > 0) {
      try {
        const priceRes = await fetch(`${API_BASE}/stocks/bulk-prices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols })
        });
        const priceData = await priceRes.json();
        if (priceRes.ok && priceData.results) {
          priceData.results.forEach(r => {
            if (!r.error) livePrices[r.symbol] = r.currentPrice;
          });
        }
      } catch (err) {
        console.error('Failed to fetch live prices:', err);
      }
    }

    holdingsBody.innerHTML = '';

    for (const h of data.holdings || []) {
      const symbol = h.stock?.symbol || '—';
      const qty = Number(h.quantity) || 0;
      const dbPrice = Number(h.stock?.currentPrice);
      const livePrice = livePrices[symbol] || dbPrice;
      const value = Number.isFinite(livePrice) ? qty * livePrice : 0;

      const priceDiff = livePrice - dbPrice;
      const priceColorClass = priceDiff > 0 ? 'text-success' : (priceDiff < 0 ? 'text-danger' : '');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${symbol}</td>
        <td>${qty}</td>
        <td>${fmtMoney(dbPrice)}</td>
        <td class="${priceColorClass} font-bold">${fmtMoney(livePrice)}</td>
        <td>${fmtMoney(value)}</td>
        <td>
          <button class="btn btn-sell" onclick="handleSell('${symbol}', ${qty}, ${livePrice})">Sell</button>
        </td>
      `;
      holdingsBody.appendChild(tr);
    }

    if (!data.holdings || data.holdings.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" class="muted">No holdings yet</td>`;
      holdingsBody.appendChild(tr);
    }

    setMsg(portMsg, '');
  } catch (err) {
    console.error(err);
    setMsg(portMsg, 'Network error. Is the backend running?', 'error');
  }
};

const loadTransactions = async () => {
  const token = requireAuth();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/trade/transactions`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    txBody.innerHTML = '';

    if (!res.ok) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" class="muted">${data.message || 'Failed to load transactions'}</td>`;
      txBody.appendChild(tr);
      return;
    }

    const txs = data.transactions || [];
    for (const t of txs) {
      const qty = Number(t.quantity) || 0;
      const px = Number(t.price) || 0;
      const total = qty * px;
      const date = t.date ? new Date(t.date).toLocaleString() : '—';
      const typeClass = t.type === 'BUY' ? 'buy' : 'sell';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${date}</td>
        <td><span class="badge ${typeClass}">${t.type}</span></td>
        <td>${t.stock?.symbol || '—'}</td>
        <td>${qty}</td>
        <td>${fmtMoney(px)}</td>
        <td>${fmtMoney(total)}</td>
      `;
      txBody.appendChild(tr);
    }

    if (txs.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" class="muted">No transactions yet</td>`;
      txBody.appendChild(tr);
    }
  } catch {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="muted">Network error. Is the backend running?</td>`;
    txBody.appendChild(tr);
  }
};

window.handleSell = async (symbol, maxQty, currentPrice) => {
  const qtyStr = prompt(`How many shares of ${symbol} would you like to sell? (Max: ${maxQty})`, maxQty);
  if (qtyStr === null) return;

  const qty = parseInt(qtyStr);
  if (isNaN(qty) || qty <= 0 || qty > maxQty) {
    alert('Invalid quantity');
    return;
  }

  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/trade/sell`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ symbol, quantity: qty, price: currentPrice })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.message || 'Failed to sell stock');
      return;
    }

    alert('Stock sold successfully!');
    loadPortfolio();
    loadTransactions();
  } catch (err) {
    alert('Network error. Failed to sell stock.');
  }
};

document.getElementById('refreshHoldings').addEventListener('click', () => {
  loadPortfolio();
});

document.getElementById('refreshTx').addEventListener('click', () => {
  loadTransactions();
});

// Initialize authentication UI
updateAuthUI();

// Only load portfolio if user is authenticated
const token = getToken();
if (token) {
  loadPortfolio();
  loadTransactions();
} else {
  setMsg(portMsg, 'Please login to view portfolio', 'error');
}

// Theme toggle functionality
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

if (themeToggle && themeIcon) {
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

  // Load saved theme or default to light
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);

  themeToggle.addEventListener('click', toggleTheme);
}
