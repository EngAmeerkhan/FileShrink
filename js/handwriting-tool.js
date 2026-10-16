/**
 * FileShrink - Text to Handwriting Engine (js/handwriting-tool.js)
 * High-performance A4 Canvas rendering with seeded natural handwriting variations
 */

(function () {
  'use strict';

  // Constants & Canvas Setup
  const A4_WIDTH = 1654;  // A4 at 200 DPI (px)
  const A4_HEIGHT = 2339; // A4 at 200 DPI (px)

  // Seeded PRNG: Mulberry32
  function createPrng(seed) {
    let s = (seed >>> 0);
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  window.initHandwritingTool = function () {
    // DOM Elements
    const textInput = document.getElementById('handwritingText');
    const charCounter = document.getElementById('charCounter');
    const langWarningBox = document.getElementById('langWarningBox');
    const problemCharsSpan = document.getElementById('problemChars');

    const fontButtons = document.querySelectorAll('.font-option-btn');
    const paperButtons = document.querySelectorAll('.paper-option-btn');
    const inkButtons = document.querySelectorAll('.ink-color-btn');
    const customInkPicker = document.getElementById('customInkPicker');

    const fontSizeSlider = document.getElementById('fontSizeSlider');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const lineSpacingSlider = document.getElementById('lineSpacingSlider');
    const lineSpacingValue = document.getElementById('lineSpacingValue');
    const wordSpacingSlider = document.getElementById('wordSpacingSlider');
    const wordSpacingValue = document.getElementById('wordSpacingValue');
    const letterSpacingSlider = document.getElementById('letterSpacingSlider');
    const letterSpacingValue = document.getElementById('letterSpacingValue');

    const naturalSlider = document.getElementById('naturalSlider');
    const naturalValue = document.getElementById('naturalValue');
    const btnNewLook = document.getElementById('btnNewLook');

    const redMarginCheckbox = document.getElementById('redMarginCheckbox');
    const scannedLookCheckbox = document.getElementById('scannedLookCheckbox');

    const studentNameInput = document.getElementById('studentNameInput');
    const submissionDateInput = document.getElementById('submissionDateInput');

    const previewCanvas = document.getElementById('previewCanvas');
    const previewCtx = previewCanvas ? previewCanvas.getContext('2d') : null;

    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageIndicator = document.getElementById('pageIndicator');

    const downloadJpgBtn = document.getElementById('downloadJpgBtn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const exportProgressArea = document.getElementById('exportProgressArea');
    const exportProgressFill = document.getElementById('exportProgressFill');
    const exportStatusText = document.getElementById('exportStatusText');

    if (!previewCanvas || !previewCtx) return;

    // Set internal canvas resolution
    previewCanvas.width = A4_WIDTH;
    previewCanvas.height = A4_HEIGHT;

    // Tool State
    let currentSeed = 42819;
    let selectedFont = 'Caveat';
    let selectedPaper = 'lined'; // lined, plain, grid, yellow
    let selectedInk = '#1a365d';  // default blue
    let currentPageIndex = 0;
    let computedPages = [];      // Array of page lines and tokens
    let fontsReady = false;

    // Layout configuration
    const config = {
      marginLeft: 180,
      marginRight: 130,
      marginTop: 200,
      marginBottom: 160,
      redMarginX: 150
    };

    // Filter non-Latin characters
    function detectUnsupportedChars(str) {
      const regex = /[^\u0000-\u024F\u2000-\u206F\u20A0-\u20CF\s\d\p{P}]/gu;
      const matches = str.match(regex);
      if (!matches) return [];
      return Array.from(new Set(matches));
    }

    // Clean text by replacing unsupported glyphs with safe spaces to avoid rendering empty boxes
    function sanitizeForDrawing(str) {
      return str.replace(/[^\u0000-\u024F\u2000-\u206F\u20A0-\u20CF\s\d\p{P}]/gu, '');
    }

    // Calculate layout & pagination from text
    function computePages() {
      const text = textInput ? textInput.value : '';
      const fontSize = parseInt(fontSizeSlider.value, 10);
      const lineMultiplier = parseFloat(lineSpacingSlider.value);
      const lineHeight = Math.round(fontSize * lineMultiplier);
      const wordSpacingBonus = parseInt(wordSpacingSlider.value, 10);
      const letterSpacingBonus = parseInt(letterSpacingSlider.value, 10);

      const printableWidth = A4_WIDTH - config.marginLeft - config.marginRight;
      const printableHeight = A4_HEIGHT - config.marginTop - config.marginBottom;
      const maxLinesPerPage = Math.max(1, Math.floor(printableHeight / lineHeight));

      // Use an offscreen canvas to accurately measure words
      const measureCanvas = document.createElement('canvas');
      const mCtx = measureCanvas.getContext('2d');
      mCtx.font = `${fontSize}px "${selectedFont}", cursive`;

      const lines = [];
      const paragraphs = text.split('\n');

      paragraphs.forEach((para) => {
        if (para.length === 0) {
          // Empty blank line
          lines.push({ tokens: [], isBlank: true });
          return;
        }

        const rawWords = para.split(/\s+/);
        let currentLineWords = [];
        let currentLineWidth = 0;

        rawWords.forEach((word) => {
          if (!word) return;
          const cleanWord = sanitizeForDrawing(word);
          if (!cleanWord) return;

          // Account for letter spacing
          let wordWidth = mCtx.measureText(cleanWord).width + (cleanWord.length - 1) * letterSpacingBonus;

          // If a single word is longer than the printable width, break by character
          if (wordWidth > printableWidth) {
            let part = '';
            for (let i = 0; i < cleanWord.length; i++) {
              const char = cleanWord[i];
              const charW = mCtx.measureText(char).width + letterSpacingBonus;
              const partW = mCtx.measureText(part + char).width + (part.length) * letterSpacingBonus;
              if (partW > printableWidth && part.length > 0) {
                if (currentLineWords.length > 0) {
                  lines.push({ tokens: currentLineWords, isBlank: false });
                  currentLineWords = [];
                }
                lines.push({ tokens: [{ text: part, width: mCtx.measureText(part).width }], isBlank: false });
                part = char;
              } else {
                part += char;
              }
            }
            if (part) {
              const pW = mCtx.measureText(part).width;
              currentLineWords.push({ text: part, width: pW });
              currentLineWidth = pW;
            }
            return;
          }

          const spaceWidth = mCtx.measureText(' ').width + wordSpacingBonus;
          const addedWidth = (currentLineWords.length > 0 ? spaceWidth : 0) + wordWidth;

          if (currentLineWidth + addedWidth > printableWidth && currentLineWords.length > 0) {
            lines.push({ tokens: currentLineWords, isBlank: false });
            currentLineWords = [{ text: cleanWord, width: wordWidth }];
            currentLineWidth = wordWidth;
          } else {
            currentLineWords.push({ text: cleanWord, width: wordWidth });
            currentLineWidth += addedWidth;
          }
        });

        if (currentLineWords.length > 0) {
          lines.push({ tokens: currentLineWords, isBlank: false });
        }
      });

      // Split lines into pages
      computedPages = [];
      if (lines.length === 0) {
        computedPages.push([]);
      } else {
        for (let i = 0; i < lines.length; i += maxLinesPerPage) {
          computedPages.push(lines.slice(i, i + maxLinesPerPage));
        }
      }

      if (currentPageIndex >= computedPages.length) {
        currentPageIndex = Math.max(0, computedPages.length - 1);
      }

      updatePagerUI();
    }

    // Update Pagination Toolbar UI
    function updatePagerUI() {
      const total = Math.max(1, computedPages.length);
      const curr = currentPageIndex + 1;
      if (pageIndicator) pageIndicator.textContent = `Page ${curr} of ${total}`;
      if (prevPageBtn) prevPageBtn.disabled = currentPageIndex <= 0;
      if (nextPageBtn) nextPageBtn.disabled = currentPageIndex >= total - 1;
    }

    // Draw Paper Background (Lined, Plain, Grid, Yellow)
    function drawPaperBackground(ctx, width, height, lineHeight) {
      // Base paper color
      let baseColor = '#fcfbfa';
      if (selectedPaper === 'yellow') baseColor = '#fff9c4';
      else if (selectedPaper === 'plain') baseColor = '#fdfbf7';

      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, width, height);

      // Subtle texture grain
      ctx.fillStyle = 'rgba(0, 0, 0, 0.015)';
      for (let i = 0; i < 400; i++) {
        const x = (i * 97) % width;
        const y = (i * 137) % height;
        ctx.fillRect(x, y, 2, 2);
      }

      if (selectedPaper === 'lined' || selectedPaper === 'yellow') {
        const lineRuleColor = selectedPaper === 'yellow' ? 'rgba(180, 150, 80, 0.35)' : 'rgba(147, 197, 253, 0.45)';
        ctx.strokeStyle = lineRuleColor;
        ctx.lineWidth = 1.5;

        const startY = config.marginTop;
        for (let y = startY; y < height - config.marginBottom; y += lineHeight) {
          ctx.beginPath();
          ctx.moveTo(config.marginLeft - 40, y);
          ctx.lineTo(width - config.marginRight + 30, y);
          ctx.stroke();
        }
      } else if (selectedPaper === 'grid') {
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
        ctx.lineWidth = 1;
        const gridSize = 36;
        for (let x = 40; x < width - 40; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 40);
          ctx.lineTo(x, height - 40);
          ctx.stroke();
        }
        for (let y = 40; y < height - 40; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(40, y);
          ctx.lineTo(width - 40, y);
          ctx.stroke();
        }
      }

      // Red Margin Line
      const showRedMargin = redMarginCheckbox ? redMarginCheckbox.checked : true;
      if (showRedMargin && (selectedPaper === 'lined' || selectedPaper === 'yellow')) {
        ctx.strokeStyle = selectedPaper === 'yellow' ? 'rgba(239, 68, 68, 0.65)' : 'rgba(248, 113, 113, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(config.redMarginX, 0);
        ctx.lineTo(config.redMarginX, height);
        ctx.stroke();

        if (selectedPaper === 'yellow') {
          // Double red line on legal pad
          ctx.beginPath();
          ctx.moveTo(config.redMarginX + 5, 0);
          ctx.lineTo(config.redMarginX + 5, height);
          ctx.stroke();
        }
      }
    }

    // Render a single page onto any target canvas context
    function renderPage(ctx, pageIndex, options = {}) {
      const pageLines = computedPages[pageIndex] || [];
      const fontSize = parseInt(fontSizeSlider.value, 10);
      const lineMultiplier = parseFloat(lineSpacingSlider.value);
      const lineHeight = Math.round(fontSize * lineMultiplier);
      const naturalness = parseInt(naturalSlider.value, 10) / 100;
      const wordSpacingBonus = parseInt(wordSpacingSlider.value, 10);
      const letterSpacingBonus = parseInt(letterSpacingSlider.value, 10);

      // Deterministic PRNG seeded per page for 100% reproduction
      const prng = createPrng(currentSeed + (pageIndex * 7919));

      // 1. Draw Paper
      drawPaperBackground(ctx, A4_WIDTH, A4_HEIGHT, lineHeight);

      // 2. Draw Header Line (Name & Date)
      const nameVal = studentNameInput ? studentNameInput.value.trim() : '';
      const dateVal = submissionDateInput ? submissionDateInput.value.trim() : '';
      if (nameVal || dateVal) {
        ctx.save();
        ctx.font = `${Math.round(fontSize * 0.9)}px "${selectedFont}", cursive`;
        ctx.fillStyle = selectedInk;
        if (nameVal) {
          ctx.fillText(`Name: ${nameVal}`, config.marginLeft, config.marginTop - 60);
        }
        if (dateVal) {
          const dWidth = ctx.measureText(`Date: ${dateVal}`).width;
          ctx.fillText(`Date: ${dateVal}`, A4_WIDTH - config.marginRight - dWidth, config.marginTop - 60);
        }
        ctx.restore();
      }

      // 3. Draw Handwriting Text
      let currentY = config.marginTop;

      ctx.save();
      ctx.fillStyle = selectedInk;

      pageLines.forEach((line) => {
        if (line.isBlank) {
          currentY += lineHeight;
          return;
        }

        let currentX = config.marginLeft;

        line.tokens.forEach((token, tIdx) => {
          // Natural variations per word
          const baselineOffset = (prng() * 2 - 1) * (naturalness * 3.5);
          const rotationAngle = (prng() * 2 - 1) * (naturalness * (1.5 * Math.PI / 180));
          const sizeScale = 1.0 + (prng() * 2 - 1) * (naturalness * 0.035);
          const jitterWordSpace = (prng() * 2 - 1) * (naturalness * 3);

          const finalFontSize = Math.round(fontSize * sizeScale);
          ctx.font = `${finalFontSize}px "${selectedFont}", cursive`;

          ctx.save();
          ctx.translate(currentX, currentY + baselineOffset);
          if (Math.abs(rotationAngle) > 0.001) {
            ctx.rotate(rotationAngle);
          }

          // Draw word characters
          if (letterSpacingBonus !== 0) {
            let cx = 0;
            for (let c = 0; c < token.text.length; c++) {
              const ch = token.text[c];
              ctx.fillText(ch, cx, 0);
              cx += ctx.measureText(ch).width + letterSpacingBonus;
            }
          } else {
            ctx.fillText(token.text, 0, 0);
          }

          ctx.restore();

          const spaceW = ctx.measureText(' ').width + wordSpacingBonus + jitterWordSpace;
          currentX += token.width + spaceW;
        });

        currentY += lineHeight;
      });

      ctx.restore();

      // 4. Scanned Look Effect (Slight shadow & procedural noise)
      const isScanned = scannedLookCheckbox ? scannedLookCheckbox.checked : false;
      if (isScanned) {
        ctx.save();
        // Subtle top-left to bottom-right uneven shadow vignette
        const grad = ctx.createLinearGradient(0, 0, A4_WIDTH, A4_HEIGHT);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.02)');
        grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.035)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

        // Sparse noise specs
        ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        for (let n = 0; n < 2500; n++) {
          const nx = (prng() * A4_WIDTH);
          const ny = (prng() * A4_HEIGHT);
          ctx.fillRect(nx, ny, 1.5, 1.5);
        }
        ctx.restore();
      }
    }

    // Render Preview
    function renderPreview() {
      if (!fontsReady) return;
      computePages();
      renderPage(previewCtx, currentPageIndex);
    }

    // Preload all 6 handwriting fonts
    async function preloadFonts() {
      try {
        if (document.fonts) {
          await document.fonts.ready;
          await Promise.all([
            document.fonts.load('32px "Caveat"'),
            document.fonts.load('32px "Kalam"'),
            document.fonts.load('32px "Shadows Into Light"'),
            document.fonts.load('32px "Patrick Hand"'),
            document.fonts.load('32px "Indie Flower"'),
            document.fonts.load('32px "Architects Daughter"')
          ]);
        }
      } catch (e) {
        // Fallback
      }
      fontsReady = true;
      renderPreview();
    }

    // Text Input & Live Char Counter
    if (textInput) {
      textInput.addEventListener('input', function () {
        const val = this.value;
        if (val.length > 20000) {
          this.value = val.slice(0, 20000);
        }
        if (charCounter) {
          charCounter.textContent = `${this.value.length.toLocaleString()} / 20,000 characters`;
        }

        // Validate unsupported characters (non-Latin, Urdu, Arabic)
        const unsupp = detectUnsupportedChars(this.value);
        if (unsupp.length > 0) {
          if (langWarningBox) langWarningBox.classList.remove('is-hidden');
          if (problemCharsSpan) problemCharsSpan.textContent = unsupp.slice(0, 8).join(', ');
        } else {
          if (langWarningBox) langWarningBox.classList.add('is-hidden');
        }

        renderPreview();
      });
    }

    // Font selection buttons
    fontButtons.forEach((btn) => {
      btn.addEventListener('click', function () {
        fontButtons.forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        selectedFont = this.getAttribute('data-font');
        renderPreview();
      });
    });

    // Paper selection buttons
    paperButtons.forEach((btn) => {
      btn.addEventListener('click', function () {
        paperButtons.forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        selectedPaper = this.getAttribute('data-paper');
        renderPreview();
      });
    });

    // Ink selection buttons
    inkButtons.forEach((btn) => {
      btn.addEventListener('click', function () {
        inkButtons.forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        selectedInk = this.getAttribute('data-ink');
        if (customInkPicker) customInkPicker.value = selectedInk;
        renderPreview();
      });
    });

    if (customInkPicker) {
      customInkPicker.addEventListener('input', function () {
        selectedInk = this.value;
        inkButtons.forEach((b) => b.classList.remove('active'));
        renderPreview();
      });
    }

    // Slider inputs with live badges
    function bindSlider(slider, badge, unit = '') {
      if (!slider || !badge) return;
      slider.addEventListener('input', function () {
        badge.textContent = `${this.value}${unit}`;
        renderPreview();
      });
    }

    bindSlider(fontSizeSlider, fontSizeValue, 'px');
    bindSlider(lineSpacingSlider, lineSpacingValue, 'x');
    bindSlider(wordSpacingSlider, wordSpacingValue, 'px');
    bindSlider(letterSpacingSlider, letterSpacingValue, 'px');
    bindSlider(naturalSlider, naturalValue, '%');

    // New look button (picks new random seed)
    if (btnNewLook) {
      btnNewLook.addEventListener('click', function () {
        currentSeed = Math.floor(Math.random() * 900000) + 10000;
        renderPreview();
      });
    }

    // Checkbox toggles
    if (redMarginCheckbox) redMarginCheckbox.addEventListener('change', renderPreview);
    if (scannedLookCheckbox) scannedLookCheckbox.addEventListener('change', renderPreview);

    // Header inputs
    if (studentNameInput) studentNameInput.addEventListener('input', renderPreview);
    if (submissionDateInput) submissionDateInput.addEventListener('input', renderPreview);

    // Pager buttons
    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', function () {
        if (currentPageIndex > 0) {
          currentPageIndex--;
          updatePagerUI();
          renderPage(previewCtx, currentPageIndex);
        }
      });
    }

    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', function () {
        if (currentPageIndex < computedPages.length - 1) {
          currentPageIndex++;
          updatePagerUI();
          renderPage(previewCtx, currentPageIndex);
        }
      });
    }

    // Helper: Async chunked rendering of all pages without freezing the UI
    async function renderAllPagesChunked(onProgress) {
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = A4_WIDTH;
      offscreenCanvas.height = A4_HEIGHT;
      const offCtx = offscreenCanvas.getContext('2d');

      const total = computedPages.length;
      const results = [];

      for (let i = 0; i < total; i++) {
        if (onProgress) onProgress(i + 1, total);
        // Yield to browser animation frame
        await new Promise((resolve) => requestAnimationFrame(resolve));

        renderPage(offCtx, i);
        const blob = await new Promise((res) => {
          offscreenCanvas.toBlob((b) => res(b), 'image/jpeg', 0.92);
        });
        results.push({ pageNum: i + 1, blob: blob });
      }

      return results;
    }

    // Download JPG / ZIP Button
    if (downloadJpgBtn) {
      downloadJpgBtn.addEventListener('click', async function () {
        computePages();
        const total = computedPages.length;

        if (total === 1) {
          // Single Page JPG
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = A4_WIDTH;
          tempCanvas.height = A4_HEIGHT;
          renderPage(tempCanvas.getContext('2d'), 0);
          tempCanvas.toBlob((blob) => {
            window.downloadBlob(blob, 'handwriting-page-1.jpg', 'image/jpeg');
          }, 'image/jpeg', 0.94);
        } else {
          // Multi-page: Progress Bar + ZIP
          if (typeof window.JSZip !== 'function') {
            alert('ZIP library loading. Please wait a moment.');
            return;
          }

          if (exportProgressArea) exportProgressArea.classList.remove('is-hidden');
          downloadJpgBtn.disabled = true;

          try {
            const pages = await renderAllPagesChunked((curr, max) => {
              const pct = Math.round((curr / max) * 100);
              if (exportProgressFill) exportProgressFill.style.width = `${pct}%`;
              if (exportStatusText) exportStatusText.textContent = `Rendering page ${curr} of ${max}...`;
            });

            if (exportStatusText) exportStatusText.textContent = 'Compressing into ZIP archive...';
            const zip = new window.JSZip();
            pages.forEach((p) => {
              zip.file(`handwriting-page-${p.pageNum}.jpg`, p.blob);
            });

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            window.downloadBlob(zipBlob, 'handwriting-pages.zip', 'application/zip');
          } finally {
            if (exportProgressArea) exportProgressArea.classList.add('is-hidden');
            downloadJpgBtn.disabled = false;
          }
        }
      });
    }

    // Download Multi-Page PDF Button (jsPDF)
    if (downloadPdfBtn) {
      downloadPdfBtn.addEventListener('click', async function () {
        if (!window.jspdf || !window.jspdf.jsPDF) {
          alert('PDF library is loading. Please wait a moment.');
          return;
        }

        computePages();
        const total = computedPages.length;

        if (exportProgressArea) exportProgressArea.classList.remove('is-hidden');
        downloadPdfBtn.disabled = true;

        try {
          const pages = await renderAllPagesChunked((curr, max) => {
            const pct = Math.round((curr / max) * 100);
            if (exportProgressFill) exportProgressFill.style.width = `${pct}%`;
            if (exportStatusText) exportStatusText.textContent = `Rendering page ${curr} of ${max} for PDF...`;
          });

          if (exportStatusText) exportStatusText.textContent = 'Building A4 PDF document...';
          const { jsPDF } = window.jspdf;
          // Standard A4 portrait in points: 595.28 x 841.89
          const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
          });

          for (let i = 0; i < pages.length; i++) {
            if (i > 0) doc.addPage('a4', 'portrait');

            const imgUrl = URL.createObjectURL(pages[i].blob);
            const imgData = await new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                const c = document.createElement('canvas');
                c.width = img.width;
                c.height = img.height;
                const cCtx = c.getContext('2d');
                cCtx.drawImage(img, 0, 0);
                const dataUrl = c.toDataURL('image/jpeg', 0.90);
                URL.revokeObjectURL(imgUrl);
                resolve(dataUrl);
              };
              img.src = imgUrl;
            });

            doc.addImage(imgData, 'JPEG', 0, 0, 595.28, 841.89);
          }

          const pdfBlob = doc.output('blob');
          window.downloadBlob(pdfBlob, 'handwriting.pdf', 'application/pdf');
        } finally {
          if (exportProgressArea) exportProgressArea.classList.add('is-hidden');
          downloadPdfBtn.disabled = false;
        }
      });
    }

    // Start font preloading and initial draw
    preloadFonts();
  };
})();
