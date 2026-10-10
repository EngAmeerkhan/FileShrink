/**
 * FileShrink - PDF Page Management Engine (js/pdf-pages-tool.js)
 * Split, Extract, and Remove PDF pages using pdf-lib (preserving vector text & fonts)
 */

(function () {
  'use strict';

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  window.initPdfPagesTool = function (config) {
    const mode = config.mode || 'split'; // 'split', 'extract', 'remove'

    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadArea = document.getElementById('uploadArea');
    const processingArea = document.getElementById('processingArea');
    const progressStatus = document.getElementById('progressStatus');
    const progressBar = document.getElementById('progressBar');
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');
    const errorMessage = document.getElementById('errorMessage');

    const pagesGrid = document.getElementById('pdfPagesGrid');
    const selectedCountLabel = document.getElementById('selectedCountLabel');
    const rangeInput = document.getElementById('pageRangeInput');
    const splitModeSelect = document.getElementById('splitModeSelect');
    const actionExecuteBtn = document.getElementById('actionExecuteBtn');
    const resetBtn = document.getElementById('resetBtn');

    // Step indicators
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    let rawPdfBytes = null;
    let totalPageCount = 0;
    let selectedPageIndices = new Set(); // 0-indexed
    let baseFileName = 'document';

    function setStep(step) {
      if (step1) step1.className = 'step-item' + (step === 1 ? ' active' : (step > 1 ? ' completed' : ''));
      if (step2) step2.className = 'step-item' + (step === 2 ? ' active' : (step > 2 ? ' completed' : ''));
      if (step3) step3.className = 'step-item' + (step === 3 ? ' active' : '');
    }

    function resetTool() {
      if (fileInput) fileInput.value = '';
      rawPdfBytes = null;
      totalPageCount = 0;
      selectedPageIndices.clear();
      if (uploadArea) uploadArea.classList.remove('is-hidden');
      if (processingArea) processingArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.add('is-hidden');
      if (errorArea) errorArea.classList.add('is-hidden');
      if (pagesGrid) pagesGrid.innerHTML = '';
      if (rangeInput) rangeInput.value = '';
      setStep(1);
    }

    function showError(msg) {
      if (errorArea) {
        errorArea.classList.remove('is-hidden');
        if (errorMessage) errorMessage.textContent = msg;
      }
    }

    function updateSelectionUI() {
      if (selectedCountLabel) {
        const count = selectedPageIndices.size;
        if (mode === 'remove') {
          selectedCountLabel.textContent = `${count} page(s) marked for removal (${totalPageCount - count} remaining)`;
        } else {
          selectedCountLabel.textContent = `${count} of ${totalPageCount} page(s) selected`;
        }
      }

      if (pagesGrid) {
        const cards = pagesGrid.querySelectorAll('.page-card');
        cards.forEach((card, idx) => {
          const isSelected = selectedPageIndices.has(idx);
          if (mode === 'remove') {
            card.classList.toggle('removed', isSelected);
          } else {
            card.classList.toggle('selected', isSelected);
          }
        });
      }
    }

    // Parse user page range string (e.g. "1-3, 5, 8-10")
    function parseRangeString(str, maxPages) {
      const result = new Set();
      if (!str || !str.trim()) return result;

      const parts = str.split(',');
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        if (trimmed.includes('-')) {
          const [startStr, endStr] = trimmed.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (isNaN(start) || isNaN(end) || start < 1 || end < start || start > maxPages) {
            throw new Error(`Invalid page range: "${trimmed}". Please use format like 1-3, 5.`);
          }
          for (let p = start; p <= Math.min(end, maxPages); p++) {
            result.add(p - 1);
          }
        } else {
          const p = parseInt(trimmed, 10);
          if (isNaN(p) || p < 1 || p > maxPages) {
            throw new Error(`Invalid page number: "${trimmed}". PDF only has ${maxPages} pages.`);
          }
          result.add(p - 1);
        }
      }
      return result;
    }

    // Load and render page thumbnails
    async function loadPdfForEditing(file) {
      if (!file) return;
      if (file.size === 0) {
        showError('The selected PDF file is empty (0 KB). Please choose a valid file.');
        return;
      }
      if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        showError('Please choose a valid PDF file.');
        return;
      }

      baseFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');

      if (uploadArea) uploadArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.remove('is-hidden');
      if (errorArea) errorArea.classList.add('is-hidden');
      if (progressStatus) progressStatus.textContent = 'Reading PDF structure...';
      if (progressBar) progressBar.style.width = '30%';

      try {
        rawPdfBytes = await file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: rawPdfBytes.slice(0) });
        const pdfDoc = await loadingTask.promise;
        totalPageCount = pdfDoc.numPages;

        if (totalPageCount === 0) {
          throw new Error('PDF has no pages.');
        }

        if (progressBar) progressBar.style.width = '60%';
        if (progressStatus) progressStatus.textContent = `Rendering thumbnails for ${totalPageCount} pages...`;

        if (pagesGrid) {
          pagesGrid.innerHTML = '';
          for (let i = 1; i <= totalPageCount; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.4 });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.className = 'page-card-canvas';
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            const card = document.createElement('div');
            card.className = 'page-card';
            card.setAttribute('data-index', (i - 1).toString());
            card.innerHTML = `
              <div class="page-card-checkbox">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <div class="page-card-num">Page ${i}</div>
            `;
            card.insertBefore(canvas, card.querySelector('.page-card-num'));

            card.addEventListener('click', function () {
              const idx = parseInt(this.getAttribute('data-index'), 10);
              if (selectedPageIndices.has(idx)) {
                selectedPageIndices.delete(idx);
              } else {
                selectedPageIndices.add(idx);
              }
              if (rangeInput) {
                rangeInput.value = Array.from(selectedPageIndices).map(p => p + 1).sort((a,b)=>a-b).join(', ');
              }
              updateSelectionUI();
            });

            pagesGrid.appendChild(card);
          }
        }

        // Set default selection depending on mode
        selectedPageIndices.clear();
        if (mode === 'split' || mode === 'extract') {
          // Default: first page selected
          selectedPageIndices.add(0);
          if (rangeInput) rangeInput.value = '1';
        }

        if (processingArea) processingArea.classList.add('is-hidden');
        if (resultArea) resultArea.classList.remove('is-hidden');
        setStep(2);
        updateSelectionUI();
      } catch (err) {
        showError(err.message || 'Could not parse PDF. File may be encrypted or corrupted.');
        resetTool();
      }
    }

    if (rangeInput) {
      rangeInput.addEventListener('input', function () {
        try {
          if (errorArea) errorArea.classList.add('is-hidden');
          selectedPageIndices = parseRangeString(this.value, totalPageCount);
          updateSelectionUI();
        } catch (rErr) {
          // Keep typing, don't break
        }
      });
    }

    // Execute the PDF Action preserving vector selectable text with pdf-lib
    async function executePdfAction() {
      if (!window.PDFLib) {
        showError('PDF processing engine is loading. Please try again.');
        return;
      }

      if (errorArea) errorArea.classList.add('is-hidden');

      // Sync range input if user typed custom string
      if (rangeInput && rangeInput.value.trim()) {
        try {
          selectedPageIndices = parseRangeString(rangeInput.value, totalPageCount);
          updateSelectionUI();
        } catch (err) {
          showError(err.message);
          return;
        }
      }

      const { PDFDocument } = window.PDFLib;
      const srcDoc = await PDFDocument.load(rawPdfBytes.slice(0));

      if (mode === 'extract') {
        if (selectedPageIndices.size === 0) {
          showError('Please select at least one page to extract.');
          return;
        }
        const outDoc = await PDFDocument.create();
        const pageIndicesArray = Array.from(selectedPageIndices).sort((a,b) => a - b);
        const copiedPages = await outDoc.copyPages(srcDoc, pageIndicesArray);
        copiedPages.forEach(p => outDoc.addPage(p));

        const pdfBytes = await outDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        window.downloadBlob(blob, `${baseFileName}-extracted.pdf`);
        setStep(3);
      } else if (mode === 'remove') {
        if (selectedPageIndices.size === 0) {
          showError('Please select at least one page to remove.');
          return;
        }
        if (selectedPageIndices.size >= totalPageCount) {
          showError('Cannot delete all pages. At least one page must remain.');
          return;
        }

        const outDoc = await PDFDocument.create();
        const keepIndices = [];
        for (let i = 0; i < totalPageCount; i++) {
          if (!selectedPageIndices.has(i)) {
            keepIndices.push(i);
          }
        }
        const copiedPages = await outDoc.copyPages(srcDoc, keepIndices);
        copiedPages.forEach(p => outDoc.addPage(p));

        const pdfBytes = await outDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        window.downloadBlob(blob, `${baseFileName}-edited.pdf`);
        setStep(3);
      } else if (mode === 'split') {
        const isEveryPage = splitModeSelect && splitModeSelect.value === 'all';
        if (isEveryPage) {
          if (typeof window.JSZip !== 'function') {
            showError('ZIP library loading. Please try again.');
            return;
          }
          actionExecuteBtn.disabled = true;
          actionExecuteBtn.textContent = 'Creating Split PDFs...';

          try {
            const zip = new window.JSZip();
            for (let i = 0; i < totalPageCount; i++) {
              const singleDoc = await PDFDocument.create();
              const [copied] = await singleDoc.copyPages(srcDoc, [i]);
              singleDoc.addPage(copied);
              const bytes = await singleDoc.save();
              zip.file(`${baseFileName}-page-${i + 1}.pdf`, bytes);
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            window.downloadBlob(zipBlob, `${baseFileName}-split-pages.zip`);
            setStep(3);
          } catch (zErr) {
            showError('Failed to split all pages.');
          } finally {
            actionExecuteBtn.disabled = false;
            actionExecuteBtn.textContent = 'Split PDF';
          }
        } else {
          // Split chosen range
          if (selectedPageIndices.size === 0) {
            showError('Please select or specify the pages to split.');
            return;
          }
          const outDoc = await PDFDocument.create();
          const pageIndicesArray = Array.from(selectedPageIndices).sort((a,b) => a - b);
          const copiedPages = await outDoc.copyPages(srcDoc, pageIndicesArray);
          copiedPages.forEach(p => outDoc.addPage(p));

          const pdfBytes = await outDoc.save();
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          window.downloadBlob(blob, `${baseFileName}-split.pdf`);
          setStep(3);
        }
      }
    }

    // Attach File Event Listeners
    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
          loadPdfForEditing(e.target.files[0]);
        }
      });
    }

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      ['dragleave', 'dragend'].forEach((type) => {
        dropzone.addEventListener(type, () => dropzone.classList.remove('dragover'));
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          loadPdfForEditing(e.dataTransfer.files[0]);
        }
      });
    }

    if (actionExecuteBtn) {
      actionExecuteBtn.addEventListener('click', executePdfAction);
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', resetTool);
    }

    resetTool();
  };
})();
