const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' ? 'http://localhost:5000/api' : window.location.origin + '/api';

const setMsg = (el, text, type) => {
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('error', 'success');
  if (type) el.classList.add(type);
};

const saveAuth = (data) => {
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
};

const redirectIfLoggedIn = () => {
  const token = localStorage.getItem('token');
  if (token) window.location.href = 'dashboard.html';
};

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

let isOtpState = false;
let verifiedEmail = '';

if (loginForm) {
  redirectIfLoggedIn();

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('loginMsg');
    const btn = document.getElementById('loginSubmitBtn');
    
    if (!isOtpState) {
      // 1. Initial Login (Email/Password)
      setMsg(msg, 'Logging in...');
      const formData = new FormData(loginForm);
      const payload = {
        email: formData.get('email'),
        password: formData.get('password')
      };

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          setMsg(msg, data.message || 'Login failed', 'error');
          return;
        }

        if (data.requiresOtp) {
          // Transition to OTP State
          isOtpState = true;
          verifiedEmail = payload.email;
          document.getElementById('credentialsSection').style.display = 'none';
          
          const otpSection = document.getElementById('otpSection');
          otpSection.style.display = 'block';
          const otpInput = document.getElementById('loginOtpInput');
          otpInput.required = true;
          otpInput.focus();
          
          document.getElementById('loginEmail').required = false;
          document.getElementById('loginPassword').required = false;

          btn.textContent = 'Verify OTP';
          
          if (data.devPreviewUrl) {
            console.log('%c✉️ View Email Preview:', 'color: #4CAF50; font-weight: bold; font-size: 14px', data.devPreviewUrl);
          }
          
          setMsg(msg, 'OTP sent! Please check your email.', 'success');
        } else {
          // Fallback if OTP is bypassed for some reason
          saveAuth(data);
          setMsg(msg, 'Login successful. Redirecting...', 'success');
          window.location.href = 'dashboard.html';
        }
      } catch (err) {
        setMsg(msg, 'Network error. Is the backend running?', 'error');
      }
    } else {
      // 2. Verification (OTP)
      setMsg(msg, 'Verifying OTP...');
      const formData = new FormData(loginForm);
      const payload = {
        email: verifiedEmail,
        otp: formData.get('otp')
      };

      try {
        const res = await fetch(`${API_BASE}/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          setMsg(msg, data.message || 'OTP verification failed', 'error');
          return;
        }

        saveAuth(data);
        setMsg(msg, 'Login successful. Redirecting...', 'success');
        window.location.href = 'dashboard.html';
      } catch (err) {
        setMsg(msg, 'Network error. Is the backend running?', 'error');
      }
    }
  });
}

if (registerForm) {
  redirectIfLoggedIn();

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('registerMsg');
    setMsg(msg, 'Creating account...');

    const formData = new FormData(registerForm);
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password')
    };

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg(msg, data.message || 'Registration failed', 'error');
        return;
      }

      setMsg(msg, 'Registered successfully. Please login.', 'success');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 600);
    } catch (err) {
      setMsg(msg, 'Network error. Is the backend running?', 'error');
    }
  });
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

  // Load saved theme or default to dark
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);

  themeToggle.addEventListener('click', toggleTheme);
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
