const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' ? 'http://localhost:5000/api' : window.location.origin + '/api';

const setMsg = (el, text, type) => {
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('error', 'success');
  if (type) el.classList.add(type);
};

const forgotForm = document.getElementById('forgotForm');

if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('forgotMsg');
    setMsg(msg, 'Sending reset link...');
    const formData = new FormData(forgotForm);
    const payload = { email: formData.get('email') };
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(msg, data.message || 'Failed to send reset link', 'error');
        return;
      }
      setMsg(msg, 'Reset link sent! Please check your email.', 'success');
    } catch (err) {
      setMsg(msg, 'Network error. Is the backend running?', 'error');
    }
  });
}
