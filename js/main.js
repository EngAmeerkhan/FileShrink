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
  window.downloadBlob = function (blob, filename, mimeType) {
    const targetType = mimeType || blob.type;
    const finalBlob = (targetType && blob.type !== targetType) ? new Blob([blob], { type: targetType }) : blob;
    const url = URL.createObjectURL(finalBlob);
    const a = document.createElement('a');
    a.style.position = 'fixed';
    a.style.left = '-9999px';
    a.style.top = '-9999px';
    a.style.opacity = '0';
    a.href = url;
    a.setAttribute('download', filename);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 4000);
  };

  // Cookie Consent Banner Handler (safe against blocked localStorage)
  function initCookieBanner() {
    const banner = document.getElementById('cookieBanner');
    const acceptBtn = document.getElementById('cookieAcceptBtn');
    if (!banner || !acceptBtn) return;

    let consent = null;
    try {
      consent = localStorage.getItem('fileshrink_cookie_consent');
    } catch (e) {
      // Storage blocked in strict privacy mode
    }

    if (!consent) {
      banner.classList.remove('is-hidden');
    }

    acceptBtn.addEventListener('click', function () {
      try {
        localStorage.setItem('fileshrink_cookie_consent', 'accepted');
      } catch (e) {
        // Storage blocked
      }
      banner.classList.add('is-hidden');
    });
  }

  // Mobile Dropdown Navigation Toggle & Mobile Accordion
  function initNavDropdowns() {
    const navToggleBtn = document.getElementById('navToggleBtn');
    const headerNav = document.querySelector('.site-header nav');

    if (navToggleBtn && headerNav) {
      navToggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = headerNav.classList.toggle('is-open');
        navToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    }

    const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
    dropdownToggles.forEach(toggle => {
      toggle.addEventListener('click', function (e) {
        const parent = this.closest('.nav-item-dropdown');
        if (!parent) return;

        // If screen width is <= 768px, handle accordion toggle
        if (window.innerWidth <= 768) {
          e.preventDefault();
          const isOpen = parent.classList.contains('is-open');
          document.querySelectorAll('.nav-item-dropdown.is-open').forEach(item => {
            if (item !== parent) item.classList.remove('is-open');
          });

          if (!isOpen) {
            parent.classList.add('is-open');
          } else {
            parent.classList.remove('is-open');
          }
        }
      });
    });

    // Close dropdowns on click outside
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav-item-dropdown') && !e.target.closest('#navToggleBtn')) {
        document.querySelectorAll('.nav-item-dropdown.is-open').forEach(item => {
          item.classList.remove('is-open');
        });
        if (headerNav && headerNav.classList.contains('is-open')) {
          headerNav.classList.remove('is-open');
          if (navToggleBtn) navToggleBtn.setAttribute('aria-expanded', 'false');
        }
      }
    });

    // Close mobile nav when clicking a dropdown link
    document.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', function () {
        if (headerNav && headerNav.classList.contains('is-open')) {
          headerNav.classList.remove('is-open');
          if (navToggleBtn) navToggleBtn.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  // Homepage Instant Tool Search Filter
  function initToolSearch() {
    const searchInput = document.getElementById('toolSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const noResults = document.getElementById('searchNoResults');
    const querySpan = document.getElementById('searchQueryText');
    if (!searchInput) return;

    const toolCards = document.querySelectorAll('.large-tool-card');
    const sections = document.querySelectorAll('main section[id]');

    function filterTools() {
      const q = searchInput.value.trim().toLowerCase();

      if (clearBtn) {
        if (q.length > 0) {
          clearBtn.classList.remove('is-hidden');
        } else {
          clearBtn.classList.add('is-hidden');
        }
      }

      if (q === '') {
        toolCards.forEach(c => c.style.display = '');
        sections.forEach(s => s.style.display = '');
        if (noResults) noResults.classList.add('is-hidden');
        return;
      }

      let totalVisible = 0;
      toolCards.forEach(card => {
        const text = (card.textContent || '').toLowerCase();
        if (text.includes(q)) {
          card.style.display = 'flex';
          totalVisible++;
        } else {
          card.style.display = 'none';
        }
      });

      // Show/hide sections based on child visibility
      sections.forEach(sec => {
        const visibleInSec = sec.querySelectorAll('.large-tool-card[style*="display: flex"], .large-tool-card:not([style*="display: none"])');
        if (visibleInSec.length === 0) {
          sec.style.display = 'none';
        } else {
          sec.style.display = '';
        }
      });

      if (noResults) {
        if (totalVisible === 0) {
          if (querySpan) querySpan.textContent = searchInput.value.trim();
          noResults.classList.remove('is-hidden');
        } else {
          noResults.classList.add('is-hidden');
        }
      }
    }

    searchInput.addEventListener('input', filterTools);

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        searchInput.value = '';
        searchInput.focus();
        filterTools();
      });
    }
  }

  // Initialize on DOM ready
  function initApp() {
    initCookieBanner();
    initNavDropdowns();
    initToolSearch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
