/**
 * FileShrink - Add Page Numbers to PDF Engine (js/pdf-number-tool.js)
 * Client-side vector numbering using pdf-lib with live pdf.js preview
 */

(function () {
  'use strict';

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  window.initPdfNumberTool = function () {
    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadArea = document.getElementById('uploadArea');
    const configArea = document.getElementById('configArea');
    const processingArea = document.getElementById('processingArea');
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');
    const errorMessage = document.getElementById('errorMessage');

    // Controls
    const posSelect = document.getElementById('posSelect');
    const formatSelect = document.getElementById('formatSelect');
    const startNumInput = document.getElementById('startNumInput');
    const fontSizeSelect = document.getElementById('fontSizeSelect');
    const skipFirstCheckbox = document.getElementById('skipFirstCheckbox');
    const previewCanvas = document.getElementById('previewCanvas');
    const processBtn = document.getElementById('processBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');

    // Stats
    const resultOriginalSize = document.getElementById('resultOriginalSize');
    const resultNewSize = document.getElementById('resultNewSize');
    const resultPageCount = document.getElementById('resultPageCount');

    // Step indicators
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    let currentFile = null;
    let rawPdfBytes = null;
    let totalPages = 0;
    let baseFileName = 'document';
    let basePage1Image = null; // Stored rendered preview canvas of page
    let basePageWidth = 595;
    let basePageHeight = 842;
    let resultBlob = null;

    function setStep(step) {
      if (step1) step1.className = 'step-item' + (step === 1 ? ' active' : (step > 1 ? ' completed' : ''));
      if (step2) step2.className = 'step-item' + (step === 2 ? ' active' : (step > 2 ? ' completed' : ''));
      if (step3) step3.className = 'step-item' + (step === 3 ? ' active' : '');
    }

    function resetTool() {
      if (fileInput) fileInput.value = '';
      currentFile = null;
      rawPdfBytes = null;
      totalPages = 0;
      basePage1Image = null;
      resultBlob = null;
      if (uploadArea) uploadArea.classList.remove('is-hidden');
      if (configArea) configArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.add('is-hidden');
      if (errorArea) errorArea.classList.add('is-hidden');
      setStep(1);
    }

    function showError(msg) {
      if (errorArea) {
        errorArea.classList.remove('is-hidden');
        if (errorMessage) errorMessage.textContent = msg;
      }
      if (processingArea) processingArea.classList.add('is-hidden');
    }

    function hideError() {
      if (errorArea) errorArea.classList.add('is-hidden');
    }

    // Render Preview with number overlay
    function updatePreviewOverlay() {
      if (!basePage1Image || !previewCanvas) return;
      const ctx = previewCanvas.getContext('2d');
      previewCanvas.width = basePage1Image.width;
      previewCanvas.height = basePage1Image.height;

      // Draw base rendered page
      ctx.drawImage(basePage1Image, 0, 0);

      const skipFirst = skipFirstCheckbox ? skipFirstCheckbox.checked : false;
      const startNum = parseInt(startNumInput ? startNumInput.value : '1', 10) || 1;
      const format = formatSelect ? formatSelect.value : 'num';
      const pos = posSelect ? posSelect.value : 'bottom-center';
      const fontSizePt = parseInt(fontSizeSelect ? fontSizeSelect.value : '12', 10) || 12;

      // If skipping page 1, show note or sample for page 2
      if (skipFirst) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Page 1 skipped (no number)', previewCanvas.width / 2, previewCanvas.height / 2);
        return;
      }

      // Compute display text
      let text = '';
      if (format === 'page-n') {
        text = `Page ${startNum}`;
      } else if (format === 'n-of-total') {
        text = `${startNum} of ${totalPages}`;
      } else {
        text = `${startNum}`;
      }

      // Scale font for thumbnail
      const scaleFactor = previewCanvas.width / basePageWidth;
      const thumbFontSize = Math.max(9, Math.round(fontSizePt * scaleFactor));
      ctx.font = `${thumbFontSize}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = '#1e293b';

      const marginX = 24 * scaleFactor;
      const marginY = 20 * scaleFactor;
      let x = 0;
      let y = 0;

      if (pos === 'bottom-center') {
        ctx.textAlign = 'center';
        x = previewCanvas.width / 2;
        y = previewCanvas.height - marginY;
      } else if (pos === 'bottom-right') {
        ctx.textAlign = 'right';
        x = previewCanvas.width - marginX;
        y = previewCanvas.height - marginY;
      } else if (pos === 'bottom-left') {
        ctx.textAlign = 'left';
        x = marginX;
        y = previewCanvas.height - marginY;
      } else if (pos === 'top-center') {
        ctx.textAlign = 'center';
        x = previewCanvas.width / 2;
        y = marginY + thumbFontSize;
      } else if (pos === 'top-right') {
        ctx.textAlign = 'right';
        x = previewCanvas.width - marginX;
        y = marginY + thumbFontSize;
      } else if (pos === 'top-left') {
        ctx.textAlign = 'left';
        x = marginX;
        y = marginY + thumbFontSize;
      }

      ctx.fillText(text, x, y);
    }

    async function loadPdfDocument(file) {
      if (!file) return;

      if (file.size === 0) {
        showError('The selected PDF file is empty (0 KB). Please choose a valid document.');
        return;
      }

      if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        showError('Please upload a valid PDF document.');
        return;
      }

      // Warn above 50 MB
      if (file.size > 50 * 1024 * 1024) {
        if (!confirm('This PDF is over 50 MB and may take longer to process on mobile devices. Continue?')) {
          return;
        }
      }

      currentFile = file;
      baseFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      hideError();

      if (uploadArea) uploadArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.remove('is-hidden');
      setStep(2);

      try {
        rawPdfBytes = await file.arrayBuffer();

        // Render preview with pdf.js
        if (window.pdfjsLib) {
          const loadingTask = window.pdfjsLib.getDocument({ data: rawPdfBytes.slice(0) });
          const pdfDoc = await loadingTask.promise;
          totalPages = pdfDoc.numPages;

          const page1 = await pdfDoc.getPage(1);
          const viewport = page1.getViewport({ scale: 1.0 });
          basePageWidth = viewport.width;
          basePageHeight = viewport.height;

          // Render small preview thumbnail
          const thumbScale = Math.min(260 / viewport.width, 360 / viewport.height);
          const thumbViewport = page1.getViewport({ scale: thumbScale });

          const offscreenCanvas = document.createElement('canvas');
          offscreenCanvas.width = thumbViewport.width;
          offscreenCanvas.height = thumbViewport.height;
          const ctx = offscreenCanvas.getContext('2d');

          await page1.render({ canvasContext: ctx, viewport: thumbViewport }).promise;
          basePage1Image = offscreenCanvas;
        }

        if (processingArea) processingArea.classList.add('is-hidden');
        if (configArea) configArea.classList.remove('is-hidden');
        updatePreviewOverlay();
      } catch (err) {
        showError('Could not read PDF. The file may be password protected or corrupted.');
        resetTool();
      }
    }

    async function processAndNumberPdf() {
      if (!rawPdfBytes || !window.PDFLib) {
        showError('PDF engine not ready. Please try again.');
        return;
      }

      hideError();
      if (configArea) configArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.remove('is-hidden');

      try {
        const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
        const pdfDoc = await PDFDocument.load(rawPdfBytes.slice(0));
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();
        const total = pages.length;

        const skipFirst = skipFirstCheckbox ? skipFirstCheckbox.checked : false;
        const startNum = parseInt(startNumInput ? startNumInput.value : '1', 10) || 1;
        const format = formatSelect ? formatSelect.value : 'num';
        const pos = posSelect ? posSelect.value : 'bottom-center';
        const fontSize = parseInt(fontSizeSelect ? fontSizeSelect.value : '12', 10) || 12;

        const marginX = 40;
        const marginY = 32;

        for (let i = 0; i < total; i++) {
          if (skipFirst && i === 0) continue;

          const page = pages[i];
          const { width, height } = page.getSize();
          const pageNum = startNum + (skipFirst ? i - 1 : i);

          let text = '';
          if (format === 'page-n') {
            text = `Page ${pageNum}`;
          } else if (format === 'n-of-total') {
            const countForTotal = skipFirst ? total - 1 : total;
            text = `${pageNum} of ${countForTotal}`;
          } else {
            text = `${pageNum}`;
          }

          const textWidth = font.widthOfTextAtSize(text, fontSize);
          const textHeight = font.heightAtSize(fontSize);

          let x = 0;
          let y = 0;

          if (pos === 'bottom-center') {
            x = (width - textWidth) / 2;
            y = marginY;
          } else if (pos === 'bottom-right') {
            x = width - marginX - textWidth;
            y = marginY;
          } else if (pos === 'bottom-left') {
            x = marginX;
            y = marginY;
          } else if (pos === 'top-center') {
            x = (width - textWidth) / 2;
            y = height - marginY - textHeight;
          } else if (pos === 'top-right') {
            x = width - marginX - textWidth;
            y = height - marginY - textHeight;
          } else if (pos === 'top-left') {
            x = marginX;
            y = height - marginY - textHeight;
          }

          page.drawText(text, {
            x,
            y,
            size: fontSize,
            font: font,
            color: rgb(0.15, 0.2, 0.25)
          });
        }

        const outBytes = await pdfDoc.save();
        resultBlob = new Blob([outBytes], { type: 'application/pdf' });

        if (processingArea) processingArea.classList.add('is-hidden');
        if (resultArea) resultArea.classList.remove('is-hidden');

        if (resultOriginalSize) resultOriginalSize.textContent = window.formatBytes(currentFile.size);
        if (resultNewSize) resultNewSize.textContent = window.formatBytes(resultBlob.size);
        if (resultPageCount) resultPageCount.textContent = `${total} pages numbered`;

        setStep(3);
      } catch (err) {
        console.error('PDF-LIB ERROR STACK:', err ? err.stack : 'none');
        showError('An error occurred while numbering the PDF: ' + err.message);
        if (configArea) configArea.classList.remove('is-hidden');
      }
    }

    // Attach Event Listeners
    if (fileInput) {
      fileInput.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) loadPdfDocument(e.target.files[0]);
      });
    }

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', e => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', e => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      ['dragleave', 'dragend'].forEach(type => {
        dropzone.addEventListener(type, () => dropzone.classList.remove('dragover'));
      });
      dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          loadPdfDocument(e.dataTransfer.files[0]);
        }
      });
    }

    // Controls input changes update live preview
    [posSelect, formatSelect, startNumInput, fontSizeSelect, skipFirstCheckbox].forEach(el => {
      if (el) el.addEventListener('input', updatePreviewOverlay);
      if (el) el.addEventListener('change', updatePreviewOverlay);
    });

    if (processBtn) {
      processBtn.addEventListener('click', processAndNumberPdf);
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        if (resultBlob) {
          window.downloadBlob(resultBlob, `${baseFileName}-numbered.pdf`, 'application/pdf');
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', resetTool);
    }

    resetTool();
  };
})();
