/* ═══════════════════════════════════════════════════════
   Help & Feedback JS
   ═══════════════════════════════════════════════════════ */

const API_BASE_ORIGIN =
(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
  ? 'http://localhost:5000'
  : window.location.origin;

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

// ── Theme & User Init ────────────────────────────────────────
const saved = localStorage.getItem('theme');
if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.setAttribute('data-theme', 'dark');
}

const token = localStorage.getItem('token');
let currentUser = null;

// Populate fields if logged in
if (token) {
  fetch(API_BASE_ORIGIN + '/api/user/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(data => {
    if (data.user) {
      currentUser = data.user;
      document.getElementById('fbName').value = currentUser.name || '';
      document.getElementById('fbEmail').value = currentUser.email || '';
    }
  })
  .catch(err => console.error('Failed to load profile for feedback forms:', err));
}

// ── UI Logic ──────────────────────────────────────────
const typeSelect = document.getElementById('fbType');
const ratingContainer = document.getElementById('ratingContainer');

typeSelect.addEventListener('change', (e) => {
  if (e.target.value === 'feedback') {
    ratingContainer.style.display = 'block';
  } else {
    ratingContainer.style.display = 'none';
    // Clear rating
    document.querySelectorAll('input[name="rating"]').forEach(r => r.checked = false);
  }
});

// ── Form Submission ────────────────────────────────────
document.getElementById('feedbackForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('fbMsg');
  msgEl.textContent = 'Submitting...';
  msgEl.className = 'msg';
  msgEl.style.color = 'var(--text)';

  const name = document.getElementById('fbName').value.trim();
  const email = document.getElementById('fbEmail').value.trim();
  const type = document.getElementById('fbType').value;
  const subject = document.getElementById('fbSubject').value.trim();
  const message = document.getElementById('fbMessage').value.trim();
  
  let rating = null;
  if (type === 'feedback') {
    const checkedStar = document.querySelector('input[name="rating"]:checked');
    if (checkedStar) rating = parseInt(checkedStar.value, 10);
  }

  try {
    const res = await fetch(API_BASE_ORIGIN + '/api/admin/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, type, rating, subject, message })
    });
    
    const data = await res.json();
    
    if (res.ok && data.success) {
      msgEl.textContent = "✅ " + data.message;
      msgEl.style.color = "var(--success)";
      e.target.reset(); // clear form
      if (currentUser) { // keep name and email
        document.getElementById('fbName').value = currentUser.name || '';
        document.getElementById('fbEmail').value = currentUser.email || '';
      }
      typeSelect.dispatchEvent(new Event('change')); // hide star rating again
      setTimeout(() => { msgEl.textContent = ''; }, 5000);
    } else {
      msgEl.textContent = data.message || 'Submission failed.';
      msgEl.style.color = "var(--danger)";
    }
  } catch (err) {
    console.error('Error submitting feedback:', err);
    msgEl.textContent = 'Server error. Please try again later.';
    msgEl.style.color = "var(--danger)";
  }
});

// ── Logout ─────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  window.location.href = 'login.html';
});
