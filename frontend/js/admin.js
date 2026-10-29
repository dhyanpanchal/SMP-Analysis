/* ═══════════════════════════════════════════════════════
   Admin Panel JS — SMP Admin Dashboard
   ═══════════════════════════════════════════════════════ */

// Smart API_BASE — works with Live Server (5500) AND direct access
const API_BASE_ORIGIN =
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
    ? 'http://localhost:5000'
    : window.location.origin;
const API = API_BASE_ORIGIN + '/api/admin';

let adminToken = localStorage.getItem('adminToken') || '';
let currentTradesPage = 1;

// ── Auth guard ─────────────────────────────────────────
if (!adminToken) {
  window.location.href = 'admin-login.html';
}

// ── Helpers ────────────────────────────────────────────
const headers = () => ({ 'Content-Type': 'application/json', 'X-Admin-Token': adminToken });

async function apiFetch(path, opts = {}) {
  try {
    const res = await fetch(API + path, { headers: headers(), ...opts });
    if (res.status === 403) { logout(); return null; }
    return res.json();
  } catch (err) {
    console.error('API Error:', err);
    return null;
  }
}

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + 'Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(2) + 'L';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function avatar(name, size = 32) {
  const colors = ['#4f7cff','#f23d5c','#00c870','#f5a623','#c84bff','#00bcd4','#ff6f61','#43a047'];
  const idx = (name || 'U').charCodeAt(0) % colors.length;
  const initial = (name || 'U')[0].toUpperCase();
  return `<div class="user-avatar" style="background:${colors[idx]};width:${size}px;height:${size}px;font-size:${size*0.4}px">${initial}</div>`;
}

function colorForValue(v, max) {
  const pct = Math.min(100, (v / (max || 1)) * 100);
  return `<div class="port-bar-wrap"><div class="port-bar"><div class="port-bar-fill" style="width:${pct}%"></div></div></div>`;
}

// Skeleton rows for loading states
function skeletonRows(cols, rows = 5) {
  const cells = Array(cols).fill('<td><div style="height:14px;border-radius:6px;background:var(--surface-high);animation:shimmer 1.2s infinite alternate;width:80%;"></div></td>').join('');
  return Array(rows).fill(`<tr>${cells}</tr>`).join('');
}

// Inject shimmer CSS once
(function injectShimmer() {
  if (document.getElementById('shimmer-style')) return;
  const s = document.createElement('style');
  s.id = 'shimmer-style';
  s.textContent = `@keyframes shimmer { from { opacity:.4 } to { opacity:1 } }`;
  document.head.appendChild(s);
})();

// ── Theme ──────────────────────────────────────────────
const saved = localStorage.getItem('theme');
if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.setAttribute('data-theme', 'dark');
}

// ── Cursor blob ────────────────────────────────────────
const blob = document.getElementById('cursorBlob');
if (blob) {
  let bx = window.innerWidth / 2, by = window.innerHeight / 2, cx = bx, cy = by;
  document.addEventListener('mousemove', e => { bx = e.clientX; by = e.clientY; });
  (function animBlob() {
    cx += (bx - cx) * 0.08; cy += (by - cy) * 0.08;
    blob.style.left = cx + 'px'; blob.style.top = cy + 'px';
    requestAnimationFrame(animBlob);
  })();
}

// ── Tab switching ──────────────────────────────────────
window.switchTab = function(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const btn = document.getElementById('tab-' + tab);
  const panel = document.getElementById('panel-' + tab);
  if (btn) btn.classList.add('active');
  if (panel) panel.classList.add('active');

  if (tab === 'users') loadUsers();
  if (tab === 'watchlists') loadWatchlists();
  if (tab === 'portfolios') loadPortfolios();
  if (tab === 'trades') loadTrades(1);
  if (tab === 'feedback') loadFeedbacks();
};

// ── Logout ─────────────────────────────────────────────
function logout() {
  localStorage.removeItem('adminToken');
  window.location.href = 'admin-login.html';
}
document.getElementById('adminLogoutBtn').addEventListener('click', logout);

// ── Dashboard Stats ────────────────────────────────────
async function loadDashboard() {
  // Show skeleton in stat cards
  ['statTotalUsers','statActive','statTrades','statPortValue'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '…';
  });
  // Show skeleton in recent users table
  document.getElementById('recentUsersTbody').innerHTML = skeletonRows(6, 6);

  const data = await apiFetch('/dashboard');
  if (!data) {
    document.getElementById('recentUsersTbody').innerHTML =
      `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--danger)">Failed to load. Is backend running?</td></tr>`;
    return;
  }

  document.getElementById('adminWelcome').textContent =
    `Last refreshed: ${new Date().toLocaleTimeString('en-IN')}`;
  document.getElementById('statTotalUsers').textContent = data.totalUsers ?? '0';
  document.getElementById('statNewUsers').textContent =
    data.newThisWeek ? `+${data.newThisWeek} this week` : '';
  document.getElementById('statActive').textContent = data.activeNow ?? 0;
  document.getElementById('liveUsersCount').textContent = data.activeNow ?? 0;
  document.getElementById('statTrades').textContent = data.totalTrades ?? '0';
  document.getElementById('statTradesToday').textContent =
    data.tradesToday ? `${data.tradesToday} today` : '';
  document.getElementById('statPortValue').textContent = fmt(data.totalPortValue);

  // Recent users table
  const tbody = document.getElementById('recentUsersTbody');
  if (!data.recentUsers || !data.recentUsers.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><span class="empty-icon">group_off</span>No users yet</td></tr>`;
    return;
  }
  tbody.innerHTML = data.recentUsers.map(u => `
    <tr>
      <td><div class="user-cell">${avatar(u.name)}<span style="font-weight:600">${u.name || '—'}</span></div></td>
      <td style="color:var(--muted);font-size:13px">${u.email}</td>
      <td>${fmt(u.balance)}</td>
      <td><span class="badge buy">${u.holdingCount} stocks</span></td>
      <td style="color:var(--muted);font-size:12px">${fmtDate(u.createdAt)}</td>
      <td><button class="tbl-action" onclick="openUserDetail('${u.id}')">View</button></td>
    </tr>
  `).join('');
}

// ── All Users ──────────────────────────────────────────
async function loadUsers() {
  const q = document.getElementById('userSearch').value.trim();
  const tbody = document.getElementById('usersTbody');
  tbody.innerHTML = skeletonRows(7, 6);
  document.getElementById('userCountBadge').textContent = 'Loading…';

  const data = await apiFetch('/users' + (q ? `?search=${encodeURIComponent(q)}` : ''));
  if (!data) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--danger)">Failed to load users</td></tr>`;
    document.getElementById('userCountBadge').textContent = '';
    return;
  }

  document.getElementById('userCountBadge').textContent = `${data.total} user(s) found`;

  if (!data.users || !data.users.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">search_off</span>No users found</div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.users.map(u => `
    <tr>
      <td><div class="user-cell">${avatar(u.name)}<span style="font-weight:600">${u.name}</span></div></td>
      <td style="color:var(--muted);font-size:13px">${u.email}</td>
      <td>${fmt(u.balance)}</td>
      <td>${u.holdingCount}</td>
      <td>${u.tradeCount}</td>
      <td style="color:var(--muted);font-size:12px">${fmtDate(u.createdAt)}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="tbl-action" onclick="openUserDetail('${u.id}')">View</button>
        <button class="tbl-action danger" onclick="deleteUser('${u.id}','${u.name}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

// ── Watchlists ─────────────────────────────────────────
async function loadWatchlists() {
  const tbody = document.getElementById('watchlistsTbody');
  tbody.innerHTML = skeletonRows(4, 5);

  const data = await apiFetch('/watchlists');
  if (!data) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--danger)">Failed to load watchlists</td></tr>`;
    return;
  }

  if (!data.watchlists || !data.watchlists.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><span class="empty-icon">bookmark_border</span>No watchlists yet</div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.watchlists.map(w => `
    <tr>
      <td><div class="user-cell">${avatar(w.userName)}<span style="font-weight:600">${w.userName}</span></div></td>
      <td style="color:var(--muted);font-size:13px">${w.userEmail}</td>
      <td><span class="badge buy">${w.stocks.length} stock(s)</span></td>
      <td style="font-size:12px;color:var(--muted)">${w.stocks.map(s =>
        `<span style="background:var(--surface-low);border:1px solid var(--border);border-radius:6px;padding:2px 8px;margin:2px;display:inline-block;font-weight:600;color:var(--text)">${s.symbol} ×${s.quantity}</span>`
      ).join('')}</td>
    </tr>
  `).join('');
}

// ── Portfolios ─────────────────────────────────────────
async function loadPortfolios() {
  const tbody = document.getElementById('portfoliosTbody');
  tbody.innerHTML = skeletonRows(6, 5);

  const data = await apiFetch('/portfolios');
  if (!data) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--danger)">Failed to load portfolios</td></tr>`;
    return;
  }

  if (!data.portfolios || !data.portfolios.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">account_balance_wallet</span>No portfolios yet</div></td></tr>`;
    return;
  }

  const maxWealth = Math.max(...data.portfolios.map(p => p.totalValue || 0));
  tbody.innerHTML = data.portfolios.map(p => `
    <tr>
      <td><div class="user-cell">${avatar(p.userName)}<span style="font-weight:600">${p.userName}</span></div></td>
      <td style="color:var(--muted);font-size:13px">${p.userEmail}</td>
      <td>${fmt(p.balance)}</td>
      <td style="color:var(--success)">${fmt(p.portfolioValue)}</td>
      <td>
        <span style="font-weight:700">${fmt(p.totalValue)}</span>
        ${colorForValue(p.totalValue, maxWealth)}
      </td>
      <td>${p.holdingsCount}</td>
    </tr>
  `).join('');
}

// ── Trades ─────────────────────────────────────────────
async function loadTrades(page = 1) {
  currentTradesPage = page;
  const tbody = document.getElementById('tradesTbody');
  tbody.innerHTML = skeletonRows(7, 8);

  const data = await apiFetch(`/trades?page=${page}&limit=20`);
  if (!data) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--danger)">Failed to load trades</td></tr>`;
    return;
  }

  document.getElementById('tradeCountBadge').textContent = `${data.total} total trades`;

  if (!data.trades || !data.trades.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">swap_horiz</span>No trades yet</div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.trades.map(t => {
    const isBuy = (t.type || t.side || '').toLowerCase() === 'buy';
    return `
    <tr>
      <td><div class="user-cell">${avatar(t.userId?.name || 'U')}
        <div><div style="font-weight:600;font-size:13px">${t.userId?.name || '—'}</div>
        <div style="font-size:11px;color:var(--muted)">${t.userId?.email || ''}</div></div>
      </div></td>
      <td style="font-weight:700">${t.symbol || '—'}</td>
      <td><span class="badge ${isBuy ? 'buy' : 'sell'}">${isBuy ? 'BUY' : 'SELL'}</span></td>
      <td>${t.quantity ?? '—'}</td>
      <td>${t.price ? '₹' + Number(t.price).toLocaleString('en-IN') : '—'}</td>
      <td style="font-weight:600">${t.price && t.quantity ? fmt(t.price * t.quantity) : '—'}</td>
      <td style="color:var(--muted);font-size:12px">${fmtDate(t.createdAt)}</td>
    </tr>`;
  }).join('');

  // Pagination
  const pag = document.getElementById('tradePagination');
  pag.innerHTML = '';
  for (let i = 1; i <= data.pages; i++) {
    const btn = document.createElement('button');
    btn.className = 'tbl-action' + (i === page ? ' active' : '');
    btn.style.background = i === page ? 'var(--accent)' : '';
    btn.style.color = i === page ? '#fff' : '';
    btn.textContent = i;
    btn.onclick = () => loadTrades(i);
    pag.appendChild(btn);
  }
}

// ── Feedbacks & Help ───────────────────────────────────
async function loadFeedbacks() {
  const tbody = document.getElementById('feedbackTbody');
  tbody.innerHTML = skeletonRows(8, 5);

  const data = await apiFetch(`/feedbacks`);
  if (!data) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--danger)">Failed to load feedbacks</td></tr>`;
    return;
  }

  document.getElementById('feedbackCountBadge').textContent = `${data.total} total messages`;

  if (!data.feedbacks || !data.feedbacks.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span class="empty-icon">mark_email_read</span>No feedbacks or help requests yet</div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.feedbacks.map(f => {
    let typeBadge = f.type === 'help' 
      ? '<span class="badge" style="background:rgba(242,61,92,0.1);color:#f23d5c;border-color:rgba(242,61,92,0.3)">HELP</span>'
      : '<span class="badge" style="background:rgba(0,200,112,0.1);color:#00c870;border-color:rgba(0,200,112,0.3)">FEEDBACK</span>';
      
    let ratingStars = f.type === 'feedback' && f.rating 
      ? '<span style="color:#f5a623;">' + '★'.repeat(f.rating) + '☆'.repeat(5-f.rating) + '</span>'
      : '—';
      
    let statusColor = f.status === 'unread' ? 'var(--danger)' : (f.status === 'resolved' ? 'var(--success)' : 'var(--muted)');

    return `
    <tr>
      <td><div class="user-cell">
        <div><div style="font-weight:600;font-size:13px">${f.name || '—'}</div>
        <div style="font-size:11px;color:var(--muted)">${f.email || ''}</div></div>
      </div></td>
      <td>${typeBadge}</td>
      <td>${ratingStars}</td>
      <td style="font-weight:600">${f.subject || '—'}</td>
      <td style="max-width:250px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${f.message}">${f.message}</td>
      <td style="font-weight:700;color:${statusColor}">${f.status.toUpperCase()}</td>
      <td style="color:var(--muted);font-size:12px">${fmtDate(f.createdAt)}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="tbl-action" onclick="viewFeedbackDetail('${f._id}')">View</button>
      </td>
    </tr>`;
  }).join('');
}

window.viewFeedbackDetail = async function(id) {
  // Try to find the feedback from the list or we would need to fetch it from backend if we had an endpoint.
  // Instead, fetch all and filter since we have it cached (or just refetch).
  const data = await apiFetch('/feedbacks');
  if (!data) return;
  const f = data.feedbacks.find(x => x._id === id);
  if (!f) return;

  document.getElementById('detailOverlay').classList.add('open');
  
  let ratingStars = f.type === 'feedback' && f.rating 
    ? '<span style="color:#f5a623;font-size:20px;">' + '★'.repeat(f.rating) + '☆'.repeat(5-f.rating) + '</span>'
    : '';

  document.getElementById('detailContent').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
      ${avatar(f.name, 52)}
      <div>
        <div style="font-family:'Manrope',sans-serif;font-size:20px;font-weight:800">${f.name}</div>
        <div style="color:var(--muted);font-size:13px">${f.email}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">Received ${new Date(f.createdAt).toLocaleString('en-IN')}</div>
      </div>
    </div>
    
    <div style="margin-bottom:20px;padding:16px;background:var(--surface-low);border:1px solid var(--border);border-radius:var(--radius-lg);">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <div>
          <span style="font-size:12px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:0.05em">Type:</span> 
          <span style="font-weight:700;margin-left:6px">${f.type.toUpperCase()}</span>
        </div>
        ${ratingStars ? `<div>${ratingStars}</div>` : ''}
      </div>
      <div>
        <span style="font-size:12px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:0.05em">Subject:</span>
        <div style="font-weight:700;font-size:16px;margin:4px 0 12px;">${f.subject || 'No Subject'}</div>
      </div>
      <div>
        <span style="font-size:12px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:0.05em">Message:</span>
        <div style="margin-top:6px;line-height:1.5">${f.message.replace(/\n/g, '<br>')}</div>
      </div>
    </div>
    
    <div style="display:flex;gap:10px;margin-bottom:4px;flex-wrap:wrap">
      <div style="flex:1">
        <label style="font-size:12px;gap:4px">
          Update Status
          <select id="statusSelect" style="margin-top:4px;width:100%;padding:8px;border-radius:var(--radius-sm);background:var(--surface-high);color:var(--text);border:1px solid var(--border);">
            <option value="unread" ${f.status === 'unread' ? 'selected' : ''}>Unread</option>
            <option value="read" ${f.status === 'read' ? 'selected' : ''}>Read</option>
            <option value="resolved" ${f.status === 'resolved' ? 'selected' : ''}>Resolved</option>
          </select>
        </label>
      </div>
      <button class="btn btn-sm" style="align-self:flex-end" onclick="updateFeedbackStatus('${f._id}')">Save Status</button>
    </div>
    <div id="statusMsg" style="font-size:12px;color:var(--success);margin-bottom:8px;min-height:16px"></div>
  `;
};

window.updateFeedbackStatus = async function(id) {
  const status = document.getElementById('statusSelect').value;
  const msg = document.getElementById('statusMsg');
  const data = await apiFetch(`/feedbacks/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status })
  });
  if (data) {
    msg.textContent = '✓ Status updated';
    setTimeout(() => { msg.textContent = ''; closeDetail(); loadFeedbacks(); }, 1500);
  }
};

// ── User Detail ────────────────────────────────────────
window.openUserDetail = async function(id) {
  document.getElementById('detailOverlay').classList.add('open');
  document.getElementById('detailContent').innerHTML = `
    <div style="padding:24px">
      ${skeletonRows(3, 4)}
    </div>`;

  const data = await apiFetch(`/users/${id}`);
  if (!data) return;

  const u = data.user;
  const holdings = data.holdings || [];
  const txns = data.transactions || [];

  let holdingsHtml = '';
  if (holdings.length) {
    holdingsHtml = `
      <h4 style="font-family:'Manrope',sans-serif;font-size:15px;font-weight:700;margin:20px 0 10px">Portfolio Holdings</h4>
      <div class="admin-table-wrap" style="max-height:200px">
        <table class="table">
          <thead><tr><th>Symbol</th><th>Name</th><th>Qty</th><th>Price</th><th>Value</th></tr></thead>
          <tbody>${holdings.map(h => `
            <tr>
              <td style="font-weight:700">${h.symbol}</td>
              <td style="color:var(--muted);font-size:12px">${h.name}</td>
              <td>${h.quantity}</td>
              <td>₹${Number(h.currentPrice).toLocaleString('en-IN')}</td>
              <td style="color:var(--success);font-weight:600">${fmt(h.value)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  let txnHtml = '';
  if (txns.length) {
    txnHtml = `
      <h4 style="font-family:'Manrope',sans-serif;font-size:15px;font-weight:700;margin:20px 0 10px">Recent Transactions</h4>
      <div class="admin-table-wrap" style="max-height:180px">
        <table class="table">
          <thead><tr><th>Symbol</th><th>Type</th><th>Qty</th><th>Price</th><th>Date</th></tr></thead>
          <tbody>${txns.slice(0, 20).map(t => {
            const isBuy = (t.type || t.side || '').toLowerCase() === 'buy';
            return `<tr>
              <td style="font-weight:700">${t.symbol || '—'}</td>
              <td><span class="badge ${isBuy ? 'buy' : 'sell'}">${isBuy ? 'BUY' : 'SELL'}</span></td>
              <td>${t.quantity ?? '—'}</td>
              <td>${t.price ? '₹' + Number(t.price).toLocaleString('en-IN') : '—'}</td>
              <td style="color:var(--muted);font-size:12px">${fmtDate(t.createdAt)}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  document.getElementById('detailContent').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
      ${avatar(u.name, 52)}
      <div>
        <div style="font-family:'Manrope',sans-serif;font-size:20px;font-weight:800">${u.name}</div>
        <div style="color:var(--muted);font-size:13px">${u.email}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">Joined ${fmtDate(u.createdAt)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px">
      <div class="stat-card" style="--stat-color:#4f7cff;padding:14px">
        <div class="stat-label">Cash Balance</div>
        <div style="font-family:'Manrope',sans-serif;font-size:20px;font-weight:800">${fmt(u.balance)}</div>
      </div>
      <div class="stat-card" style="--stat-color:#00c870;padding:14px">
        <div class="stat-label">Portfolio Value</div>
        <div style="font-family:'Manrope',sans-serif;font-size:20px;font-weight:800;color:var(--success)">
          ${fmt(holdings.reduce((s, h) => s + h.value, 0))}
        </div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:4px;flex-wrap:wrap">
      <div style="flex:1">
        <label style="font-size:12px;gap:4px">
          Update Balance (₹)
          <input type="number" id="newBalanceInput" value="${u.balance}" min="0" style="margin-top:4px" />
        </label>
      </div>
      <button class="btn btn-sm" style="align-self:flex-end" onclick="updateBalance('${u.id}')">Update</button>
    </div>
    <div id="balanceMsg" style="font-size:12px;color:var(--success);margin-bottom:8px;min-height:16px"></div>
    ${holdingsHtml}
    ${txnHtml}
  `;
};

window.closeDetail = function() {
  document.getElementById('detailOverlay').classList.remove('open');
};

window.updateBalance = async function(id) {
  const val = document.getElementById('newBalanceInput').value;
  const msg = document.getElementById('balanceMsg');
  const data = await apiFetch(`/users/${id}/balance`, {
    method: 'PUT',
    body: JSON.stringify({ balance: parseFloat(val) })
  });
  if (data) {
    msg.textContent = '✓ Balance updated successfully';
    setTimeout(() => { msg.textContent = ''; }, 3000);
    loadDashboard();
  }
};

// ── Delete User ────────────────────────────────────────
window.deleteUser = async function(id, name) {
  if (!confirm(`Are you sure you want to delete user "${name}"? This will also delete all their trades and holdings.`)) return;
  const data = await apiFetch(`/users/${id}`, { method: 'DELETE' });
  if (data) { alert('User deleted.'); loadUsers(); loadDashboard(); }
};

// ── Search on Enter ────────────────────────────────────
document.getElementById('userSearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') loadUsers();
});

// ── Refresh All ────────────────────────────────────────
document.getElementById('refreshAllBtn').addEventListener('click', () => {
  loadDashboard();
  const activePanel = document.querySelector('.tab-panel.active')?.id?.replace('panel-', '');
  if (activePanel === 'users') loadUsers();
  if (activePanel === 'watchlists') loadWatchlists();
  if (activePanel === 'portfolios') loadPortfolios();
  if (activePanel === 'trades') loadTrades(currentTradesPage);
  if (activePanel === 'feedback') loadFeedbacks();
});

// Close detail on overlay click
document.getElementById('detailOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('detailOverlay')) closeDetail();
});

// ── Init — load dashboard + users immediately ───────────
loadDashboard();
loadUsers();  // Pre-load users so switching to Users tab is instant
