/* ═══════════════════════════════════════════════════════════
   SIDEBAR TOGGLE — Shared across all pages
   Reads/writes 'sidebarCollapsed' in localStorage so the
   collapsed state persists as the user navigates.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var layout     = document.getElementById('layout');
    var toggleBtn  = document.getElementById('sidebarToggle');
    var overlay    = document.getElementById('sidebarOverlay');
    var KEY        = 'sidebarCollapsed';

    if (!layout || !toggleBtn) return; // Guard — page has no sidebar

    var isCollapsed = function () {
      return layout.classList.contains('sidebar-collapsed');
    };

    var setSidebar = function (collapse) {
      layout.classList.toggle('sidebar-collapsed', collapse);
      toggleBtn.setAttribute('aria-expanded', String(!collapse));
      localStorage.setItem(KEY, collapse ? '1' : '0');
    };

    // Restore saved state on load
    if (localStorage.getItem(KEY) === '1') {
      setSidebar(true);
    }

    // Toggle on button click
    toggleBtn.addEventListener('click', function () {
      setSidebar(!isCollapsed());
    });

    // Close via overlay tap (mobile)
    if (overlay) {
      overlay.addEventListener('click', function () {
        setSidebar(true);
      });
    }

    // Auto-collapse on narrow screens
    var mq = window.matchMedia('(max-width: 768px)');
    var handleMQ = function (e) {
      if (e.matches) setSidebar(true);
    };
    if (mq.addEventListener) {
      mq.addEventListener('change', handleMQ);
    } else {
      mq.addListener(handleMQ); // Safari < 14 fallback
    }
    if (mq.matches) setSidebar(true);
  });
})();
