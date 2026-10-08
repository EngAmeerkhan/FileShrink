/**
 * FileShrink - Shared JavaScript (js/main.js)
 * Lightweight, zero-dependency shared helpers & UI handlers
 */

(function () {
  'use strict';

  // Format bytes to human readable string (e.g. 48.2 KB, 1.2 MB)
  window.formatBytes = function (bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Trigger browser file download with custom filename
  window.downloadBlob = function (blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  };

  // Cookie Consent Banner Handler
  function initCookieBanner() {
    const banner = document.getElementById('cookieBanner');
    const acceptBtn = document.getElementById('cookieAcceptBtn');
    if (!banner || !acceptBtn) return;

    if (!localStorage.getItem('fileshrink_cookie_consent')) {
      banner.classList.remove('is-hidden');
    }

    acceptBtn.addEventListener('click', function () {
      localStorage.setItem('fileshrink_cookie_consent', 'accepted');
      banner.classList.add('is-hidden');
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieBanner);
  } else {
    initCookieBanner();
  }
})();
