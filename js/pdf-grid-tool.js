/**
 * FileShrink - Shared PDF Page Grid Engine (js/pdf-grid-tool.js)
 * High-performance, client-side PDF text extraction, rotation, and reordering.
 * Uses pdf.js (for rendering and text extraction) and pdf-lib (for lossless vector export).
 */

(function () {
  'use strict';

  // Configure pdf.js worker
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  window.initPdfGridTool = function (config) {
    const mode = config.mode || 'text'; // 'text', 'rotate', 'reorder'
    const outputSuffix = config.outputSuffix || (mode === 'rotate' ? 'rotated' : 'reordered');

    // DOM Elements - Steps & Containers
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const uploadArea = document.getElementById('uploadArea');
    const processingArea = document.getElementById('processingArea');
    const editorArea = document.getElementById('editorArea');
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');
    const errorMessage = document.getElementById('errorMessage');
    const warningArea = document.getElementById('warningArea');
    const warningMessage = document.getElementById('warningMessage');
    const progressStatus = document.getElementById('progressStatus');
    const progressBar = document.getElementById('progressBar');

    // Upload Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');

    // Grid Elements
    const pdfPagesGrid = document.getElementById('pdfPagesGrid');
    const actionExecuteBtn = document.getElementById('actionExecuteBtn');
    const startAgainBtn = document.getElementById('startAgainBtn');
    const resetGridBtn = document.getElementById('resetGridBtn');
    const undoBtn = document.getElementById('undoBtn');
    const reverseBtn = document.getElementById('reverseBtn');
    const rotateAllRightBtn = document.getElementById('rotateAllRightBtn');
    const rotateAllLeftBtn = document.getElementById('rotateAllLeftBtn');
    const rotateSelectedBtn = document.getElementById('rotateSelectedBtn');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const selectedCountBadge = document.getElementById('selectedCountBadge');

    // Text Extraction Elements (Mode 'text')
    const extractedTextBox = document.getElementById('extractedTextBox');
    const copyTextBtn = document.getElementById('copyTextBtn');
    const downloadTxtBtn = document.getElementById('downloadTxtBtn');
    const pageSeparatorToggle = document.getElementById('pageSeparatorToggle');
    const wordCountBadge = document.getElementById('wordCountBadge');
    const pageCountBadge = document.getElementById('pageCountBadge');
    const noTextNotice = document.getElementById('noTextNotice');

    // Result & Download Elements
    const resultDownloadBtn = document.getElementById('resultDownloadBtn');
    const resultStartAgainBtn = document.getElementById('resultStartAgainBtn');
    const resultPageCountEl = document.getElementById('resultPageCount');
    const resultFileSizeEl = document.getElementById('resultFileSize');

    // Working State
    let rawPdfBuffer = null;
    let pdfJsDoc = null;
    let pdfLibDoc = null;
    let originalFileName = '';
    let originalBaseName = 'document';
    let originalSizeBytes = 0;
    let totalPages = 0;

    // Mode 'text' State
    let extractedPages = []; // Array of { pageNum: number, text: string, hasText: boolean }
    let showPageSeparators = true;

    // Mode 'rotate' State
    // Array of { originalIndex: number, pageNum: number, delta: number, existingRotation: number, selected: boolean }
    let rotatePages = [];

    // Mode 'reorder' State
    // Array of { id: string, originalIndex: number, initialPageNum: number }
    let reorderPages = [];
    let historyStack = []; // History for Undo

    // IntersectionObserver for lazy thumbnail rendering
    let thumbnailObserver = null;
    let renderedThumbnails = new Set();

    // Exported Result Blob
    let finalDownloadBlob = null;
    let finalDownloadUrl = null;

    /**
     * UI Step Indicators
     */
    function setStep(step) {
      if (step1) step1.className = 'step-item' + (step === 1 ? ' active' : (step > 1 ? ' completed' : ''));
      if (step2) step2.className = 'step-item' + (step === 2 ? ' active' : (step > 2 ? ' completed' : ''));
      if (step3) step3.className = 'step-item' + (step === 3 ? ' active' : '');
    }

    /**
     * Show Error Message
     */
    function showError(msg) {
      if (errorArea) {
        errorArea.classList.remove('is-hidden');
        if (errorMessage) errorMessage.innerHTML = msg;
      }
      if (processingArea) processingArea.classList.add('is-hidden');
    }

    function clearError() {
      if (errorArea) errorArea.classList.add('is-hidden');
    }

    /**
     * Show Warning Message
     */
    function showWarning(msg) {
      if (warningArea) {
        warningArea.classList.remove('is-hidden');
        if (warningMessage) warningMessage.innerHTML = msg;
      }
    }

    function clearWarning() {
      if (warningArea) warningArea.classList.add('is-hidden');
    }

    /**
     * Start Again / Reset Tool
     */
    function resetTool() {
      if (fileInput) fileInput.value = '';
      if (finalDownloadUrl) {
        URL.revokeObjectURL(finalDownloadUrl);
        finalDownloadUrl = null;
      }
      if (thumbnailObserver) {
        thumbnailObserver.disconnect();
        thumbnailObserver = null;
      }
      rawPdfBuffer = null;
      pdfJsDoc = null;
      pdfLibDoc = null;
      originalFileName = '';
      originalBaseName = 'document';
      originalSizeBytes = 0;
      totalPages = 0;
      extractedPages = [];
      rotatePages = [];
      reorderPages = [];
      historyStack = [];
      renderedThumbnails.clear();
      finalDownloadBlob = null;

      clearError();
      clearWarning();
      if (pdfPagesGrid) pdfPagesGrid.innerHTML = '';
      if (extractedTextBox) extractedTextBox.value = '';
      if (noTextNotice) noTextNotice.classList.add('is-hidden');

      if (uploadArea) uploadArea.classList.remove('is-hidden');
      if (processingArea) processingArea.classList.add('is-hidden');
      if (editorArea) editorArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.add('is-hidden');
      setStep(1);
    }

    if (startAgainBtn) startAgainBtn.addEventListener('click', resetTool);
    if (resultStartAgainBtn) resultStartAgainBtn.addEventListener('click', resetTool);

    /**
     * Handle PDF File Selection
     */
    async function handleFile(file) {
      clearError();
      clearWarning();
      if (!file) return;

      // Validate PDF format
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!isPdf) {
        showError('Please select a valid PDF document.');
        return;
      }

      // Check 50 MB threshold
      if (file.size > 50 * 1024 * 1024) {
        showWarning('<strong>Notice:</strong> This PDF is larger than 50 MB. Processing large documents may take extra time on mobile devices.');
      }

      originalFileName = file.name;
      originalBaseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'document';
      originalSizeBytes = file.size;

      if (uploadArea) uploadArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.remove('is-hidden');
      setStep(2);

      try {
        rawPdfBuffer = await file.arrayBuffer();

        // Load with pdf.js (with password handler)
        const loadingTask = window.pdfjsLib.getDocument({
          data: rawPdfBuffer.slice(0)
        });

        loadingTask.onPassword = function (callback, reason) {
          showError('This PDF is password-protected. Please remove the password before using this tool.');
          callback('');
        };

        pdfJsDoc = await loadingTask.promise;
        totalPages = pdfJsDoc.numPages;

        if (totalPages === 0) {
          throw new Error('This PDF has no pages.');
        }

        // Also check with pdf-lib if in rotate or reorder mode
        if (mode === 'rotate' || mode === 'reorder') {
          try {
            pdfLibDoc = await window.PDFLib.PDFDocument.load(rawPdfBuffer.slice(0), { ignoreEncryption: false });
          } catch (pdfLibErr) {
            if (pdfLibErr.message && /encrypt|password/i.test(pdfLibErr.message)) {
              showError('This PDF is password-protected. Please remove the password before using this tool.');
              return;
            }
            throw pdfLibErr;
          }
        }

        if (mode === 'text') {
          await processPdfToText();
        } else if (mode === 'rotate') {
          initRotateMode();
        } else if (mode === 'reorder') {
          initReorderMode();
        }
      } catch (err) {
        if (err.name === 'PasswordException' || (err.message && /password|encrypt/i.test(err.message))) {
          showError('This PDF is password-protected. Please remove the password before using this tool.');
        } else {
          showError('Could not read PDF. The file may be damaged or invalid.');
        }
      }
    }

    /* ==========================================================================
       MODE 1: PDF TO TEXT
       ========================================================================== */

    async function processPdfToText() {
      extractedPages = [];
      let totalTextLength = 0;

      for (let i = 1; i <= totalPages; i++) {
        // Update progress without blocking UI
        if (progressStatus) progressStatus.textContent = `Extracting text: Page ${i} of ${totalPages}...`;
        if (progressBar) progressBar.style.width = `${Math.round((i / totalPages) * 100)}%`;

        // Yield to browser event loop
        await new Promise(r => setTimeout(r, 0));

        const page = await pdfJsDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = reconstructPageText(textContent);

        const hasText = pageText.trim().length > 0;
        if (hasText) totalTextLength += pageText.trim().length;

        extractedPages.push({
          pageNum: i,
          text: pageText,
          hasText: hasText
        });
      }

      // Check if whole PDF has no text
      const allEmpty = totalTextLength === 0;
      if (allEmpty && noTextNotice) {
        noTextNotice.classList.remove('is-hidden');
      }

      renderExtractedTextUI();
      if (processingArea) processingArea.classList.add('is-hidden');
      if (editorArea) editorArea.classList.remove('is-hidden');
      setStep(2);
    }

    /**
     * Line and Spacing Reconstruction Algorithm
     * Groups text items with similar y positions, sorts left to right, inserts spaces where gaps are large.
     */
    function reconstructPageText(textContent) {
      if (!textContent || !textContent.items || textContent.items.length === 0) {
        return '';
      }

      const items = textContent.items.filter(item => typeof item.str === 'string');
      if (items.length === 0) return '';

      // Each item transform: [scaleX, skewY, skewX, scaleY, transX, transY]
      // In PDF coordinates: transX = x, transY = y (0 at bottom, increasing upwards)
      const parsedItems = items.map(item => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width || 0,
        height: item.height || 10
      }));

      // Group items into lines where vertical distance <= 3px
      const lines = [];
      const yThreshold = 3.0;

      parsedItems.forEach(item => {
        let matchedLine = lines.find(line => Math.abs(line.y - item.y) <= yThreshold);
        if (matchedLine) {
          matchedLine.items.push(item);
          // Keep running average for y
          matchedLine.y = (matchedLine.y * (matchedLine.items.length - 1) + item.y) / matchedLine.items.length;
        } else {
          lines.push({ y: item.y, items: [item] });
        }
      });

      // Sort lines top to bottom (descending y)
      lines.sort((a, b) => b.y - a.y);

      // Reconstruct text for each line
      const lineStrings = lines.map(line => {
        // Sort items left to right
        line.items.sort((a, b) => a.x - b.x);

        let lineText = '';
        for (let i = 0; i < line.items.length; i++) {
          const cur = line.items[i];
          if (i === 0) {
            lineText += cur.str;
          } else {
            const prev = line.items[i - 1];
            const gap = cur.x - (prev.x + prev.width);
            const needsSpace = gap >= 2.0 && !lineText.endsWith(' ') && !cur.str.startsWith(' ');
            if (needsSpace) {
              lineText += ' ';
            }
            lineText += cur.str;
          }
        }
        return lineText.trimEnd();
      });

      return lineStrings.join('\n').trim();
    }

    function renderExtractedTextUI() {
      let combined = '';
      extractedPages.forEach(p => {
        if (showPageSeparators) {
          combined += `--- Page ${p.pageNum} ---\n`;
        }
        if (p.hasText) {
          combined += p.text + '\n\n';
        } else {
          combined += `[No text found on page ${p.pageNum}. It may be a scanned page.]\n\n`;
        }
      });

      if (extractedTextBox) {
        extractedTextBox.value = combined.trim();
        updateTextCounters();
      }
    }

    function updateTextCounters() {
      if (!extractedTextBox) return;
      const text = extractedTextBox.value.trim();
      const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
      if (wordCountBadge) wordCountBadge.textContent = `${words.toLocaleString()} words`;
      if (pageCountBadge) pageCountBadge.textContent = `${totalPages} page(s)`;
    }

    if (extractedTextBox) {
      extractedTextBox.addEventListener('input', updateTextCounters);
    }

    if (pageSeparatorToggle) {
      pageSeparatorToggle.addEventListener('change', () => {
        showPageSeparators = pageSeparatorToggle.checked;
        renderExtractedTextUI();
      });
    }

    if (copyTextBtn) {
      copyTextBtn.addEventListener('click', async () => {
        if (!extractedTextBox) return;
        try {
          await navigator.clipboard.writeText(extractedTextBox.value);
          const originalLabel = copyTextBtn.innerHTML;
          copyTextBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
          setTimeout(() => { copyTextBtn.innerHTML = originalLabel; }, 2000);
        } catch (e) {
          extractedTextBox.select();
          document.execCommand('copy');
        }
      });
    }

    if (downloadTxtBtn) {
      downloadTxtBtn.addEventListener('click', () => {
        if (!extractedTextBox) return;
        const blob = new Blob([extractedTextBox.value], { type: 'text/plain;charset=utf-8' });
        const fileName = `${originalBaseName}.txt`;
        if (window.downloadBlob) {
          window.downloadBlob(blob, fileName, 'text/plain');
        } else {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => a.remove(), 2000);
        }
      });
    }

    /* ==========================================================================
       MODE 2: ROTATE PDF
       ========================================================================== */

    function initRotateMode() {
      rotatePages = [];
      const libPages = pdfLibDoc.getPages();

      for (let i = 0; i < totalPages; i++) {
        const libPage = libPages[i];
        let existingRot = 0;
        try {
          existingRot = libPage.getRotation().angle || 0;
        } catch (e) {}

        rotatePages.push({
          originalIndex: i,
          pageNum: i + 1,
          delta: 0,
          existingRotation: existingRot,
          selected: false
        });
      }

      renderRotateGrid();
      if (processingArea) processingArea.classList.add('is-hidden');
      if (editorArea) editorArea.classList.remove('is-hidden');
      setStep(2);
    }

    function renderRotateGrid() {
      if (!pdfPagesGrid) return;
      pdfPagesGrid.innerHTML = '';

      rotatePages.forEach((p, idx) => {
        const card = document.createElement('div');
        card.className = 'pdf-page-card' + (p.selected ? ' selected' : '');
        card.dataset.index = idx.toString();

        const currentRot = normalizeAngle(p.existingRotation + p.delta);

        card.innerHTML = `
          <div class="pdf-page-header">
            <label class="pdf-checkbox-label" title="Select page">
              <input type="checkbox" class="pdf-checkbox-input" data-index="${idx}" ${p.selected ? 'checked' : ''}>
            </label>
            <span class="pdf-page-number">Page ${p.pageNum}</span>
            <span class="pdf-rotation-badge" id="rotBadge-${idx}">${currentRot}°</span>
          </div>
          <div class="pdf-thumb-wrapper" id="thumbWrapper-${idx}">
            <div class="pdf-thumb-placeholder">
              <span style="font-size:0.75rem;">Loading...</span>
            </div>
          </div>
          <div class="pdf-page-actions">
            <button type="button" class="pdf-card-btn rot-left-btn" data-index="${idx}" title="Rotate Left 90°">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2v6h6"></path><path d="M2.66 15.57a10 10 0 1 0 .57-8.38L2.5 8"></path></svg>
            </button>
            <button type="button" class="pdf-card-btn rot-right-btn" data-index="${idx}" title="Rotate Right 90°">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6"></path><path d="M21.34 15.57a10 10 0 1 1-.57-8.38L21.5 8"></path></svg>
            </button>
          </div>
        `;

        pdfPagesGrid.appendChild(card);
      });

      setupLazyThumbnails(rotatePages.map((p, idx) => ({
        wrapperId: `thumbWrapper-${idx}`,
        originalIndex: p.originalIndex,
        pageNum: p.pageNum,
        cardIndex: idx,
        rotationDeg: p.delta
      })));

      bindRotateEvents();
      updateRotateSelectionUI();
    }

    function normalizeAngle(deg) {
      return ((deg % 360) + 360) % 360;
    }

    function bindRotateEvents() {
      // Individual rotate buttons
      pdfPagesGrid.querySelectorAll('.rot-left-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index, 10);
          rotatePageBy(idx, -90);
        });
      });

      pdfPagesGrid.querySelectorAll('.rot-right-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index, 10);
          rotatePageBy(idx, 90);
        });
      });

      // Individual selection checkbox
      pdfPagesGrid.querySelectorAll('.pdf-checkbox-input').forEach(chk => {
        chk.addEventListener('change', (e) => {
          e.stopPropagation();
          const idx = parseInt(chk.dataset.index, 10);
          rotatePages[idx].selected = chk.checked;
          const card = pdfPagesGrid.querySelector(`.pdf-page-card[data-index="${idx}"]`);
          if (card) card.classList.toggle('selected', chk.checked);
          updateRotateSelectionUI();
        });
      });
    }

    function rotatePageBy(idx, deg) {
      const p = rotatePages[idx];
      p.delta += deg;
      const totalAngle = normalizeAngle(p.existingRotation + p.delta);
      const badge = document.getElementById(`rotBadge-${idx}`);
      if (badge) badge.textContent = `${totalAngle}°`;

      const wrapper = document.getElementById(`thumbWrapper-${idx}`);
      const canvas = wrapper ? wrapper.querySelector('canvas') : null;
      if (canvas) {
        canvas.style.transform = `rotate(${p.delta}deg)`;
      }
    }

    function updateRotateSelectionUI() {
      const selected = rotatePages.filter(p => p.selected);
      if (selectedCountBadge) {
        selectedCountBadge.textContent = `${selected.length} of ${rotatePages.length} selected`;
      }
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = selected.length === rotatePages.length && rotatePages.length > 0;
      }
    }

    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', () => {
        const checked = selectAllCheckbox.checked;
        rotatePages.forEach((p, idx) => {
          p.selected = checked;
          const card = pdfPagesGrid.querySelector(`.pdf-page-card[data-index="${idx}"]`);
          if (card) {
            card.classList.toggle('selected', checked);
            const chk = card.querySelector('.pdf-checkbox-input');
            if (chk) chk.checked = checked;
          }
        });
        updateRotateSelectionUI();
      });
    }

    if (rotateAllRightBtn) {
      rotateAllRightBtn.addEventListener('click', () => {
        rotatePages.forEach((_, idx) => rotatePageBy(idx, 90));
      });
    }

    if (rotateAllLeftBtn) {
      rotateAllLeftBtn.addEventListener('click', () => {
        rotatePages.forEach((_, idx) => rotatePageBy(idx, -90));
      });
    }

    if (rotateSelectedBtn) {
      rotateSelectedBtn.addEventListener('click', () => {
        const anySelected = rotatePages.some(p => p.selected);
        rotatePages.forEach((p, idx) => {
          if (!anySelected || p.selected) {
            rotatePageBy(idx, 90);
          }
        });
      });
    }

    if (resetGridBtn && mode === 'rotate') {
      resetGridBtn.addEventListener('click', () => {
        rotatePages.forEach((p, idx) => {
          p.delta = 0;
          const totalAngle = normalizeAngle(p.existingRotation);
          const badge = document.getElementById(`rotBadge-${idx}`);
          if (badge) badge.textContent = `${totalAngle}°`;
          const wrapper = document.getElementById(`thumbWrapper-${idx}`);
          const canvas = wrapper ? wrapper.querySelector('canvas') : null;
          if (canvas) canvas.style.transform = 'rotate(0deg)';
        });
      });
    }

    /* ==========================================================================
       MODE 3: REORDER PDF PAGES
       ========================================================================== */

    function initReorderMode() {
      reorderPages = [];
      historyStack = [];

      for (let i = 0; i < totalPages; i++) {
        reorderPages.push({
          id: 'p-' + Math.random().toString(36).substring(2, 9),
          originalIndex: i,
          initialPageNum: i + 1
        });
      }

      renderReorderGrid();
      if (processingArea) processingArea.classList.add('is-hidden');
      if (editorArea) editorArea.classList.remove('is-hidden');
      setStep(2);
    }

    function saveHistoryState() {
      historyStack.push(reorderPages.map(p => ({ ...p })));
      if (historyStack.length > 20) historyStack.shift();
      if (undoBtn) undoBtn.disabled = false;
    }

    function renderReorderGrid() {
      if (!pdfPagesGrid) return;
      pdfPagesGrid.innerHTML = '';

      reorderPages.forEach((p, idx) => {
        const card = document.createElement('div');
        card.className = 'pdf-page-card';
        card.draggable = true;
        card.dataset.index = idx.toString();
        card.dataset.id = p.id;

        card.innerHTML = `
          <div class="pdf-page-header">
            <span class="pdf-page-number">#${idx + 1} (Orig ${p.initialPageNum})</span>
          </div>
          <div class="pdf-thumb-wrapper" id="reorderThumb-${p.id}">
            <div class="pdf-thumb-placeholder">
              <span style="font-size:0.75rem;">Loading...</span>
            </div>
          </div>
          <div class="pdf-page-actions">
            <button type="button" class="pdf-card-btn move-first-btn" data-index="${idx}" title="Move to First" ${idx === 0 ? 'disabled' : ''}>&laquo;</button>
            <button type="button" class="pdf-card-btn move-left-btn" data-index="${idx}" title="Move Left" ${idx === 0 ? 'disabled' : ''}>&lsaquo;</button>
            <button type="button" class="pdf-card-btn move-right-btn" data-index="${idx}" title="Move Right" ${idx === reorderPages.length - 1 ? 'disabled' : ''}>&rsaquo;</button>
            <button type="button" class="pdf-card-btn move-last-btn" data-index="${idx}" title="Move to Last" ${idx === reorderPages.length - 1 ? 'disabled' : ''}>&raquo;</button>
          </div>
          <div class="pdf-page-actions" style="margin-top:6px;">
            <button type="button" class="pdf-card-btn duplicate-btn" data-index="${idx}" title="Duplicate page" style="width:auto; padding:0 6px;">Copy</button>
            <button type="button" class="pdf-card-btn danger delete-btn" data-index="${idx}" title="Delete page" style="width:auto; padding:0 6px;">Delete</button>
          </div>
        `;

        pdfPagesGrid.appendChild(card);
      });

      setupLazyThumbnails(reorderPages.map(p => ({
        wrapperId: `reorderThumb-${p.id}`,
        originalIndex: p.originalIndex,
        pageNum: p.initialPageNum
      })));

      bindReorderEvents();
    }

    function bindReorderEvents() {
      // Button Handlers
      pdfPagesGrid.querySelectorAll('.move-left-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index, 10);
          if (idx > 0) {
            saveHistoryState();
            const temp = reorderPages[idx];
            reorderPages[idx] = reorderPages[idx - 1];
            reorderPages[idx - 1] = temp;
            renderReorderGrid();
          }
        });
      });

      pdfPagesGrid.querySelectorAll('.move-right-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index, 10);
          if (idx < reorderPages.length - 1) {
            saveHistoryState();
            const temp = reorderPages[idx];
            reorderPages[idx] = reorderPages[idx + 1];
            reorderPages[idx + 1] = temp;
            renderReorderGrid();
          }
        });
      });

      pdfPagesGrid.querySelectorAll('.move-first-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index, 10);
          if (idx > 0) {
            saveHistoryState();
            const item = reorderPages.splice(idx, 1)[0];
            reorderPages.unshift(item);
            renderReorderGrid();
          }
        });
      });

      pdfPagesGrid.querySelectorAll('.move-last-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index, 10);
          if (idx < reorderPages.length - 1) {
            saveHistoryState();
            const item = reorderPages.splice(idx, 1)[0];
            reorderPages.push(item);
            renderReorderGrid();
          }
        });
      });

      pdfPagesGrid.querySelectorAll('.duplicate-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index, 10);
          saveHistoryState();
          const target = reorderPages[idx];
          const clone = {
            id: 'p-' + Math.random().toString(36).substring(2, 9),
            originalIndex: target.originalIndex,
            initialPageNum: target.initialPageNum
          };
          reorderPages.splice(idx + 1, 0, clone);
          renderReorderGrid();
        });
      });

      pdfPagesGrid.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (reorderPages.length <= 1) {
            showError('At least one page must remain in the document.');
            setTimeout(clearError, 3500);
            return;
          }
          saveHistoryState();
          const idx = parseInt(btn.dataset.index, 10);
          reorderPages.splice(idx, 1);
          renderReorderGrid();
        });
      });

      // Desktop HTML5 Drag & Drop
      let draggedCard = null;
      let draggedIndex = -1;

      pdfPagesGrid.querySelectorAll('.pdf-page-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
          draggedCard = card;
          draggedIndex = parseInt(card.dataset.index, 10);
          card.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          card.classList.add('drag-over');
        });

        card.addEventListener('dragleave', () => {
          card.classList.remove('drag-over');
        });

        card.addEventListener('drop', (e) => {
          e.preventDefault();
          card.classList.remove('drag-over');
          const targetIndex = parseInt(card.dataset.index, 10);
          if (draggedIndex !== -1 && targetIndex !== draggedIndex) {
            saveHistoryState();
            const item = reorderPages.splice(draggedIndex, 1)[0];
            reorderPages.splice(targetIndex, 0, item);
            renderReorderGrid();
          }
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
          draggedCard = null;
          draggedIndex = -1;
        });
      });
    }

    if (reverseBtn && mode === 'reorder') {
      reverseBtn.addEventListener('click', () => {
        saveHistoryState();
        reorderPages.reverse();
        renderReorderGrid();
      });
    }

    if (undoBtn && mode === 'reorder') {
      undoBtn.addEventListener('click', () => {
        if (historyStack.length > 0) {
          reorderPages = historyStack.pop();
          renderReorderGrid();
          if (historyStack.length === 0) undoBtn.disabled = true;
        }
      });
    }

    if (resetGridBtn && mode === 'reorder') {
      resetGridBtn.addEventListener('click', () => {
        saveHistoryState();
        initReorderMode();
      });
    }

    /* ==========================================================================
       LAZY THUMBNAIL RENDERING (300+ Pages Smooth Performance)
       ========================================================================== */

    function setupLazyThumbnails(items) {
      if (thumbnailObserver) thumbnailObserver.disconnect();

      thumbnailObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(async (entry) => {
          if (entry.isIntersecting) {
            const wrapper = entry.target;
            observer.unobserve(wrapper);

            const origIdx = parseInt(wrapper.dataset.originalIndex, 10);
            const rotDeg = parseInt(wrapper.dataset.rotation || '0', 10);
            await renderSingleThumbnail(wrapper, origIdx, rotDeg);
          }
        });
      }, {
        root: pdfPagesGrid,
        rootMargin: '250px'
      });

      items.forEach(item => {
        const wrapper = document.getElementById(item.wrapperId);
        if (wrapper) {
          wrapper.dataset.originalIndex = item.originalIndex.toString();
          wrapper.dataset.rotation = (item.rotationDeg || 0).toString();
          thumbnailObserver.observe(wrapper);
        }
      });
    }

    async function renderSingleThumbnail(wrapper, origIdx, rotDeg) {
      if (!wrapper || !pdfJsDoc) return;
      try {
        const page = await pdfJsDoc.getPage(origIdx + 1);
        const viewport = page.getViewport({ scale: 0.35 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        if (rotDeg) {
          canvas.style.transform = `rotate(${rotDeg}deg)`;
        }

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        wrapper.innerHTML = '';
        wrapper.appendChild(canvas);
      } catch (e) {
        wrapper.innerHTML = '<span style="font-size:0.75rem; color:#dc2626;">Error</span>';
      }
    }

    /* ==========================================================================
       FINAL EXPORT & DOWNLOAD
       ========================================================================== */

    async function executeExport() {
      if (actionExecuteBtn) {
        actionExecuteBtn.disabled = true;
        actionExecuteBtn.textContent = 'Processing PDF...';
      }

      try {
        let exportPdfBytes = null;

        if (mode === 'rotate') {
          const libPages = pdfLibDoc.getPages();
          rotatePages.forEach(p => {
            const libPage = libPages[p.originalIndex];
            const newAngle = normalizeAngle(p.existingRotation + p.delta);
            libPage.setRotation(window.PDFLib.degrees(newAngle));
          });
          exportPdfBytes = await pdfLibDoc.save();
        } else if (mode === 'reorder') {
          const newDoc = await window.PDFLib.PDFDocument.create();
          const pageIndices = reorderPages.map(p => p.originalIndex);
          const copiedPages = await newDoc.copyPages(pdfLibDoc, pageIndices);
          copiedPages.forEach(p => newDoc.addPage(p));
          exportPdfBytes = await newDoc.save();
        }

        if (!exportPdfBytes) {
          throw new Error('Failed to create PDF file.');
        }

        finalDownloadBlob = new Blob([exportPdfBytes], { type: 'application/pdf' });
        if (finalDownloadUrl) URL.revokeObjectURL(finalDownloadUrl);
        finalDownloadUrl = URL.createObjectURL(finalDownloadBlob);

        // Update stats
        if (resultPageCountEl) {
          const count = mode === 'rotate' ? rotatePages.length : reorderPages.length;
          resultPageCountEl.textContent = `${count} pages`;
        }
        if (resultFileSizeEl) {
          resultFileSizeEl.textContent = window.formatBytes ? window.formatBytes(finalDownloadBlob.size) : `${Math.round(finalDownloadBlob.size / 1024)} KB`;
        }

        if (editorArea) editorArea.classList.add('is-hidden');
        if (resultArea) resultArea.classList.remove('is-hidden');
        setStep(3);
      } catch (err) {
        showError(err.message || 'An error occurred while building the modified PDF.');
      } finally {
        if (actionExecuteBtn) {
          actionExecuteBtn.disabled = false;
          actionExecuteBtn.textContent = mode === 'rotate' ? 'Save & Download Rotated PDF' : 'Save & Download Reordered PDF';
        }
      }
    }

    if (actionExecuteBtn) {
      actionExecuteBtn.addEventListener('click', executeExport);
    }

    if (resultDownloadBtn) {
      resultDownloadBtn.addEventListener('click', () => {
        if (!finalDownloadBlob) return;
        const fileName = `${originalBaseName}-${outputSuffix}.pdf`;
        if (window.downloadBlob) {
          window.downloadBlob(finalDownloadBlob, fileName, 'application/pdf');
        } else {
          const a = document.createElement('a');
          a.href = finalDownloadUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => a.remove(), 2000);
        }
      });
    }

    /* ==========================================================================
       FILE UPLOAD & DRAG/DROP LISTENERS
       ========================================================================== */

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      if (uploadBtn) uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
      });

      ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFile(e.dataTransfer.files[0]);
        }
      });
    }
  };
})();
