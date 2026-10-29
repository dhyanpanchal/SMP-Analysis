const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' ? 'http://localhost:5000/api' : window.location.origin + '/api';

const setMsg = (el, text, type) => {
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('error', 'success');
  if (type) el.classList.add(type);
};

const getTokenFromURL = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') || '';
};

const resetForm = document.getElementById('resetForm');
const resetTokenInput = document.getElementById('resetToken');

if (resetForm && resetTokenInput) {
  // Set token from URL
  resetTokenInput.value = getTokenFromURL();

  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('resetMsg');
    setMsg(msg, 'Resetting password...');
    const formData = new FormData(resetForm);
    const payload = {
      token: formData.get('token'),
      password: formData.get('password')
    };
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(msg, data.message || 'Failed to reset password', 'error');
        return;
      }
      setMsg(msg, 'Password reset successful! You can now log in.', 'success');
    } catch (err) {
      setMsg(msg, 'Network error. Is the backend running?', 'error');
    }
  });
}


// ── Password Visibility Toggle ───────────────────────────
function initPasswordToggles() {
  document.querySelectorAll('.password-toggle-btn').forEach((btn) => {
    if (btn.dataset.initialized) return;
    btn.dataset.initialized = 'true';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const wrap = btn.closest('.password-wrapper, .admin-input-wrap') || btn.parentElement;
      const input = wrap ? wrap.querySelector('input') : null;
      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';

      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      btn.setAttribute('title', isPassword ? 'Hide password' : 'Show password');

      const eyeShow = btn.querySelector('.eye-show');
      const eyeHide = btn.querySelector('.eye-hide');
      if (eyeShow && eyeHide) {
        eyeShow.style.display = isPassword ? 'none' : 'block';
        eyeHide.style.display = isPassword ? 'block' : 'none';
      }

      input.focus();
      try {
        const len = input.value.length;
        input.setSelectionRange(len, len);
      } catch (_) {}
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPasswordToggles);
} else {
  initPasswordToggles();
}
