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

        // If screen width is <= 860px, handle accordion toggle
        if (window.innerWidth <= 860 || window.matchMedia('(max-width: 860px)').matches) {
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

  // Homepage Instant Tool Search Filter & Live Autocomplete
  function initToolSearch() {
    const searchInput = document.getElementById('toolSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const noResults = document.getElementById('searchNoResults');
    const querySpan = document.getElementById('searchQueryText');
    const searchForm = document.getElementById('toolSearchForm');
    const dropdown = document.getElementById('toolSearchResultsDropdown');
    if (!searchInput) return;

    // Collect all tool cards and sections on the page
    const toolCardElements = Array.from(document.querySelectorAll('.large-tool-card'));
    const sections = Array.from(document.querySelectorAll('main section[id]'));
    const nonToolSections = Array.from(document.querySelectorAll('.picker-box, .trust-strip, .info-section, .ad-slot'));

    // Build tool index
    const tools = toolCardElements.map(card => {
      const titleEl = card.querySelector('.tool-title');
      const descEl = card.querySelector('.tool-desc');
      const linkEl = card.querySelector('a[href]');
      const iconEl = card.querySelector('.tool-icon-wrapper');
      const section = card.closest('section');
      const sectionTitle = section ? (section.querySelector('h2')?.textContent || '').trim() : '';

      const title = titleEl ? titleEl.textContent.trim() : '';
      const desc = descEl ? descEl.textContent.trim() : '';
      const href = linkEl ? linkEl.getAttribute('href') : '';
      const iconSvg = iconEl ? iconEl.innerHTML : '';

      // Common keywords and synonyms
      let extraKeywords = '';
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('gpa') || lowerTitle.includes('cgpa')) extraKeywords += ' grades marks percentage calculator academic semester';
      if (lowerTitle.includes('calculator')) extraKeywords += ' calc estimate formula';
      if (lowerTitle.includes('receipt')) extraKeywords += ' invoice bill voucher rent property token payment format pdf';
      if (lowerTitle.includes('compress')) extraKeywords += ' shrink reduce size kb mb optimizer';
      if (lowerTitle.includes('pdf')) extraKeywords += ' document doc adobe';
      if (lowerTitle.includes('image') || lowerTitle.includes('photo')) extraKeywords += ' picture pic photo jpg jpeg png';
      if (lowerTitle.includes('cnic')) extraKeywords += ' id card nadra identity card side';
      if (lowerTitle.includes('handwriting')) extraKeywords += ' handwriting text notes assignment letter generator convert pen paper script';
      if (lowerTitle.includes('youtube') || lowerTitle.includes('thumbnail')) extraKeywords += ' youtube yt thumbnail maker video cover channel 1280x720';
      if (lowerTitle.includes('instagram')) extraKeywords += ' instagram insta ig profile picture avatar post 1080x1080 circular crop';
      if (lowerTitle.includes('whatsapp') || lowerTitle.includes('dp')) extraKeywords += ' whatsapp wa dp profile status story 640x640 no crop maker';
      if (lowerTitle.includes('square')) extraKeywords += ' square make photo square picture 1:1 ratio fit background blur';
      if (lowerTitle.includes('border')) extraKeywords += ' border white border frame photo white frame padding';
      if (lowerTitle.includes('black and white') || lowerTitle.includes('white photo')) extraKeywords += ' black and white bw monochrome grayscale convert photo';
      if (lowerTitle.includes('blur')) extraKeywords += ' blur photo censor privacy hide face license plate pixelate';
      if (lowerTitle.includes('text') && lowerTitle.includes('pdf')) extraKeywords += ' extract text from pdf ocr copy words txt document converter';
      if (lowerTitle.includes('rotate')) extraKeywords += ' rotate pdf pages turn flip orientation landscape portrait upside down';
      if (lowerTitle.includes('reorder')) extraKeywords += ' rearrange pdf pages organize pdf pages sort duplicate delete move sheets';
      if (lowerTitle.includes('crop')) extraKeywords += ' crop pdf pages crop pdf online trim margins cut page bounds white margins';
      if (lowerTitle.includes('signature')) extraKeywords += ' add signature to pdf sign pdf online sign pdf on mobile draw type upload signature';
      if (lowerTitle.includes('watermark')) extraKeywords += ' add watermark to pdf pdf watermark watermark pdf online stamp confidential draft logo opacity';
      if (lowerTitle.includes('loan')) extraKeywords += ' emi calculator loan payment calculator monthly payment calculator interest amortization payoff mortgage bank debt schedule';
      if (lowerTitle.includes('average')) extraKeywords += ' mean median mode calculator average of numbers statistics dataset range sum math central tendency';
      if (lowerTitle.includes('discount')) extraKeywords += ' sale price calculator percentage discount calculator markdown savings shopping retail bargain tax';
      if (lowerTitle.includes('weighted')) extraKeywords += ' weighted grade calculator weighted average calculator grade weight calculator syllabus percent points category assignment';
      if (lowerTitle.includes('final')) extraKeywords += ' final grade calculator final exam grade calculator what do i need on my final passing score required exam target test semester';
      if (lowerTitle.includes('hijri')) extraKeywords += ' hijri date converter islamic date converter english to hijri date umm al qura calendar ramadan eid lunar moon sighting';
      if (lowerTitle.includes('wifi') || lowerTitle.includes('qr')) extraKeywords += ' wifi qr code generator qr code generator wifi password qr code connect router network scan ssid wireless';
      if (lowerTitle.includes('barcode')) extraKeywords += ' barcode generator barcode maker ean 13 barcode generator upc-a code 128 code 39 retail product label check digit';
      if (lowerTitle.includes('whatsapp')) extraKeywords += ' whatsapp link generator whatsapp chat link click to chat link wa.me direct chat message url contact';
      if (lowerTitle.includes('fancy')) extraKeywords += ' fancy text generator stylish name generator stylish text generator aesthetic fonts unicode symbols cool letters nickname';
      if (lowerTitle.includes('case')) extraKeywords += ' case converter uppercase to lowercase title case converter sentence case camelcase pascalcase snake_case capital letters';
      if (lowerTitle.includes('duplicate')) extraKeywords += ' remove duplicate lines remove duplicate lines online delete duplicate lines clean list trim deduplicate sort unique';
      if (lowerTitle.includes('quotation')) extraKeywords += ' quotation maker quotation format price quotation template estimate quote pricing proposal billing';
      if (lowerTitle.includes('invoice')) extraKeywords += ' invoice generator free invoice generator invoice maker billing receipt payment bill client tax gst vat balance';



      return {
        card,
        section,
        title,
        desc,
        href,
        category: sectionTitle,
        iconSvg,
        searchString: (title + ' ' + desc + ' ' + sectionTitle + ' ' + href + ' ' + extraKeywords).toLowerCase()
      };
    });

    let selectedIndex = -1;
    let currentMatches = [];

    function escapeHtml(str) {
      return (str || '').replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag));
    }

    function renderDropdown(matches, query) {
      if (!dropdown) return;

      if (!query) {
        dropdown.classList.add('is-hidden');
        dropdown.innerHTML = '';
        selectedIndex = -1;
        return;
      }

      currentMatches = matches;
      selectedIndex = -1;

      if (matches.length === 0) {
        dropdown.innerHTML = '<div class="search-dropdown-empty">No tools found matching "<strong>' + escapeHtml(query) + '</strong>". Try searching for <em>GPA</em>, <em>PDF</em>, <em>Compress</em>, or <em>Receipt</em>.</div>';
        dropdown.classList.remove('is-hidden');
        return;
      }

      let html = '<div class="search-dropdown-header">';
      html += '<span>Tools Found (' + matches.length + ')</span>';
      html += '<span style="font-weight:400; text-transform:none; font-size:0.75rem;">Press Enter to open</span>';
      html += '</div>';

      matches.forEach((tool, idx) => {
        html += '<a href="' + tool.href + '" class="search-dropdown-item" data-index="' + idx + '" role="option">';
        html += '<div class="dropdown-item-icon">' + tool.iconSvg + '</div>';
        html += '<div class="dropdown-item-info">';
        html += '<div class="dropdown-item-title-row">';
        html += '<span class="dropdown-item-title">' + escapeHtml(tool.title) + '</span>';
        if (tool.category) {
          html += '<span class="dropdown-item-badge">' + escapeHtml(tool.category) + '</span>';
        }
        html += '</div>';
        html += '<p class="dropdown-item-desc">' + escapeHtml(tool.desc) + '</p>';
        html += '</div>';
        html += '<svg class="dropdown-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
        html += '</a>';
      });

      dropdown.innerHTML = html;
      dropdown.classList.remove('is-hidden');
    }

    function filterTools() {
      const rawQuery = searchInput.value;
      const q = rawQuery.trim().toLowerCase();

      if (clearBtn) {
        if (q.length > 0) {
          clearBtn.classList.remove('is-hidden');
        } else {
          clearBtn.classList.add('is-hidden');
        }
      }

      if (q === '') {
        // Reset everything to default homepage view
        toolCardElements.forEach(c => c.style.display = '');
        sections.forEach(s => s.style.display = '');
        nonToolSections.forEach(s => s.style.display = '');
        if (noResults) noResults.classList.add('is-hidden');
        renderDropdown([], '');
        return;
      }

      const terms = q.split(/\s+/).filter(Boolean);
      const matched = tools.filter(tool => {
        return terms.every(term => tool.searchString.includes(term));
      });

      // Update instant dropdown
      renderDropdown(matched, rawQuery.trim());

      // Update on-page layout: hide clutter so user immediately sees results
      nonToolSections.forEach(s => s.style.display = 'none');

      // Update card display
      tools.forEach(tool => {
        if (matched.includes(tool)) {
          tool.card.style.display = 'flex';
        } else {
          tool.card.style.display = 'none';
        }
      });

      // Show/hide sections based on whether they contain any visible cards
      sections.forEach(sec => {
        const hasVisible = Array.from(sec.querySelectorAll('.large-tool-card')).some(c => c.style.display !== 'none');
        sec.style.display = hasVisible ? '' : 'none';
      });

      // No results message on the page
      if (noResults) {
        if (matched.length === 0) {
          if (querySpan) querySpan.textContent = rawQuery.trim();
          noResults.classList.remove('is-hidden');
        } else {
          noResults.classList.add('is-hidden');
        }
      }
    }

    searchInput.addEventListener('input', filterTools);

    searchInput.addEventListener('focus', function () {
      if (searchInput.value.trim().length > 0 && currentMatches.length > 0) {
        if (dropdown) dropdown.classList.remove('is-hidden');
      }
    });

    // Keyboard navigation (Arrow keys, Enter, Escape)
    searchInput.addEventListener('keydown', function (e) {
      if (!dropdown || dropdown.classList.contains('is-hidden')) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (currentMatches.length > 0) {
            window.location.href = currentMatches[0].href;
          }
        }
        return;
      }

      const items = dropdown.querySelectorAll('.search-dropdown-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        updateSelected(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        updateSelected(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && items[selectedIndex]) {
          window.location.href = items[selectedIndex].getAttribute('href');
        } else if (currentMatches.length > 0) {
          window.location.href = currentMatches[0].href;
        }
      } else if (e.key === 'Escape') {
        dropdown.classList.add('is-hidden');
      }
    });

    function updateSelected(items) {
      items.forEach((item, idx) => {
        if (idx === selectedIndex) {
          item.classList.add('is-selected');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('is-selected');
        }
      });
    }

    // Close dropdown on click outside
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.tool-search-box')) {
        if (dropdown) dropdown.classList.add('is-hidden');
      }
    });

    if (searchForm) {
      searchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (currentMatches.length > 0) {
          window.location.href = currentMatches[0].href;
        }
      });
    }

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
