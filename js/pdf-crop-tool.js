/**
 * FileShrink - Crop PDF Engine (js/pdf-crop-tool.js)
 * Interactive visual crop rectangle, unit-converted numeric margins, auto-crop,
 * lossless vector CropBox/MediaBox export, and permanent rasterized crop.
 */

(function () {
  'use strict';

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // Unit conversion multipliers to points (pt)
  const UNIT_TO_PT = {
    pt: 1,
    mm: 72 / 25.4,          // ~2.83465
    cm: 72 / 2.54,           // ~28.3465
    in: 72                  // 72
  };

  window.initPdfCropTool = function () {
    // DOM Elements - Containers & Steps
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const uploadArea = document.getElementById('uploadArea');
    const processingArea = document.getElementById('processingArea');
    const progressStatus = document.getElementById('progressStatus');
    const progressBar = document.getElementById('progressBar');
    const editorArea = document.getElementById('editorArea');
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');
    const errorMessage = document.getElementById('errorMessage');
    const warningArea = document.getElementById('warningArea');
    const warningMessage = document.getElementById('warningMessage');

    // Upload Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');

    // Page Navigator
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageNumDisplay = document.getElementById('pageNumDisplay');

    // Canvas Stage & Crop Box Elements
    const stageContainer = document.getElementById('stageContainer');
    const stageInner = document.getElementById('stageInner');
    const previewCanvas = document.getElementById('previewCanvas');
    const cropBox = document.getElementById('cropBox');
    const scrimTop = document.getElementById('scrimTop');
    const scrimBottom = document.getElementById('scrimBottom');
    const scrimLeft = document.getElementById('scrimLeft');
    const scrimRight = document.getElementById('scrimRight');

    // Numeric Margin Inputs & Units
    const marginTopInput = document.getElementById('marginTop');
    const marginRightInput = document.getElementById('marginRight');
    const marginBottomInput = document.getElementById('marginBottom');
    const marginLeftInput = document.getElementById('marginLeft');
    const unitSelect = document.getElementById('unitSelect');
    const autoCropBtn = document.getElementById('autoCropBtn');
    const resetCropBtn = document.getElementById('resetCropBtn');

    // Crop Scope & Permanent Option
    const cropScopeSelect = document.getElementById('cropScopeSelect');
    const pageRangeGroup = document.getElementById('pageRangeGroup');
    const pageRangeInput = document.getElementById('pageRangeInput');
    const permanentCropCheckbox = document.getElementById('permanentCropCheckbox');

    // Action Buttons
    const startAgainBtn = document.getElementById('startAgainBtn');
    const actionExecuteBtn = document.getElementById('actionExecuteBtn');
    const resultDownloadBtn = document.getElementById('resultDownloadBtn');
    const resultStartAgainBtn = document.getElementById('resultStartAgainBtn');
    const resultPageCountEl = document.getElementById('resultPageCount');
    const resultFileSizeEl = document.getElementById('resultFileSize');

    // State Variables
    let rawPdfBuffer = null;
    let pdfJsDoc = null;
    let pdfLibDoc = null;
    let originalBaseName = 'document';
    let totalPages = 0;
    let currentPageIndex = 0; // 0-indexed
    let currentRenderTask = null;

    // Visual dimensions of current rendered page on canvas
    let renderScale = 1.0;
    let visualPageWidth = 0;   // In PDF points
    let visualPageHeight = 0;  // In PDF points
    let canvasWidth = 0;       // In screen pixels
    let canvasHeight = 0;      // In screen pixels

    // Crop box coordinates in points (visual pt)
    let marginsPt = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    };

    let activeUnit = 'pt';
    let finalDownloadBlob = null;
    let finalDownloadUrl = null;

    function setStep(step) {
      if (step1) step1.className = 'step-item' + (step === 1 ? ' active' : (step > 1 ? ' completed' : ''));
      if (step2) step2.className = 'step-item' + (step === 2 ? ' active' : (step > 2 ? ' completed' : ''));
      if (step3) step3.className = 'step-item' + (step === 3 ? ' active' : '');
    }

    function showError(msg) {
      if (errorArea) {
        errorArea.classList.remove('is-hidden');
        if (errorMessage) errorMessage.textContent = msg;
      }
      if (processingArea) processingArea.classList.add('is-hidden');
    }

    function clearError() {
      if (errorArea) errorArea.classList.add('is-hidden');
    }

    function showWarning(msg) {
      if (warningArea) {
        warningArea.classList.remove('is-hidden');
        if (warningMessage) warningMessage.innerHTML = msg;
      }
    }

    function clearWarning() {
      if (warningArea) warningArea.classList.add('is-hidden');
    }

    function resetTool() {
      if (fileInput) fileInput.value = '';
      if (finalDownloadUrl) {
        URL.revokeObjectURL(finalDownloadUrl);
        finalDownloadUrl = null;
      }
      rawPdfBuffer = null;
      pdfJsDoc = null;
      pdfLibDoc = null;
      originalBaseName = 'document';
      totalPages = 0;
      currentPageIndex = 0;
      marginsPt = { top: 0, right: 0, bottom: 0, left: 0 };
      finalDownloadBlob = null;

      clearError();
      clearWarning();
      if (uploadArea) uploadArea.classList.remove('is-hidden');
      if (processingArea) processingArea.classList.add('is-hidden');
      if (editorArea) editorArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.add('is-hidden');
      setStep(1);
    }

    if (startAgainBtn) startAgainBtn.addEventListener('click', resetTool);
    if (resultStartAgainBtn) resultStartAgainBtn.addEventListener('click', resetTool);

    /* ==========================================================================
       FILE UPLOAD & PARSING
       ========================================================================== */

    async function handleFile(file) {
      clearError();
      clearWarning();
      if (!file) return;

      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!isPdf) {
        showError('Please select a valid PDF document.');
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        showWarning('<strong>Notice:</strong> This PDF is larger than 50 MB. Processing large files may take extra time on mobile devices.');
      }

      originalBaseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'document';

      if (uploadArea) uploadArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.remove('is-hidden');
      setStep(2);

      try {
        rawPdfBuffer = await file.arrayBuffer();

        const loadingTask = window.pdfjsLib.getDocument({
          data: rawPdfBuffer.slice(0)
        });

        loadingTask.onPassword = function (callback) {
          showError('This PDF is password-protected. Please remove the password before using this tool.');
          callback('');
        };

        pdfJsDoc = await loadingTask.promise;
        totalPages = pdfJsDoc.numPages;

        if (totalPages === 0) {
          throw new Error('This PDF contains no pages.');
        }

        pdfLibDoc = await window.PDFLib.PDFDocument.load(rawPdfBuffer.slice(0), { ignoreEncryption: false });

        currentPageIndex = 0;
        marginsPt = { top: 0, right: 0, bottom: 0, left: 0 };

        if (processingArea) processingArea.classList.add('is-hidden');
        if (editorArea) editorArea.classList.remove('is-hidden');

        await renderCurrentPagePreview();
      } catch (err) {
        if (err.name === 'PasswordException' || (err.message && /password|encrypt/i.test(err.message))) {
          showError('This PDF is password-protected. Please remove the password before using this tool.');
        } else {
          showError(err.message || 'Could not read PDF. The file may be damaged or invalid.');
        }
      }
    }

    /* ==========================================================================
       PREVIEW RENDERING & STAGE SETUP
       ========================================================================== */

    async function renderCurrentPagePreview() {
      if (!pdfJsDoc) return;
      if (currentRenderTask) {
        try { currentRenderTask.cancel(); } catch (e) {}
      }

      clearError();
      updatePageNav();

      const page = await pdfJsDoc.getPage(currentPageIndex + 1);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      visualPageWidth = unscaledViewport.width;
      visualPageHeight = unscaledViewport.height;

      // Fit preview comfortably in available viewport width
      const maxWidth = Math.min(stageContainer ? stageContainer.clientWidth - 40 : 600, 680);
      renderScale = Math.min(maxWidth / visualPageWidth, 1.25);
      if (renderScale < 0.4) renderScale = 0.4;

      const viewport = page.getViewport({ scale: renderScale });
      canvasWidth = viewport.width;
      canvasHeight = viewport.height;

      previewCanvas.width = canvasWidth;
      previewCanvas.height = canvasHeight;
      stageInner.style.width = `${canvasWidth}px`;
      stageInner.style.height = `${canvasHeight}px`;

      const ctx = previewCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      currentRenderTask = page.render({ canvasContext: ctx, viewport: viewport });
      await currentRenderTask.promise;
      currentRenderTask = null;

      updateCropBoxFromMargins();
      updateNumericInputs();
    }

    function updatePageNav() {
      if (pageNumDisplay) pageNumDisplay.textContent = `Page ${currentPageIndex + 1} of ${totalPages}`;
      if (prevPageBtn) prevPageBtn.disabled = currentPageIndex === 0;
      if (nextPageBtn) nextPageBtn.disabled = currentPageIndex === totalPages - 1;
    }

    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', async () => {
        if (currentPageIndex > 0) {
          currentPageIndex--;
          await renderCurrentPagePreview();
        }
      });
    }

    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', async () => {
        if (currentPageIndex < totalPages - 1) {
          currentPageIndex++;
          await renderCurrentPagePreview();
        }
      });
    }

    /* ==========================================================================
       TWO-WAY CROP RECTANGLE & NUMERIC MARGINS SYNC
       ========================================================================== */

    function ptToActiveUnit(pt) {
      const factor = UNIT_TO_PT[activeUnit] || 1;
      return +(pt / factor).toFixed(2);
    }

    function activeUnitToPt(val) {
      const factor = UNIT_TO_PT[activeUnit] || 1;
      return (parseFloat(val) || 0) * factor;
    }

    function updateNumericInputs() {
      if (marginTopInput) marginTopInput.value = ptToActiveUnit(marginsPt.top);
      if (marginRightInput) marginRightInput.value = ptToActiveUnit(marginsPt.right);
      if (marginBottomInput) marginBottomInput.value = ptToActiveUnit(marginsPt.bottom);
      if (marginLeftInput) marginLeftInput.value = ptToActiveUnit(marginsPt.left);
    }

    function updateCropBoxFromMargins() {
      if (!cropBox || canvasWidth === 0 || canvasHeight === 0) return;

      const leftPx = marginsPt.left * renderScale;
      const topPx = marginsPt.top * renderScale;
      const rightPx = marginsPt.right * renderScale;
      const bottomPx = marginsPt.bottom * renderScale;

      const boxWidth = Math.max(0, canvasWidth - leftPx - rightPx);
      const boxHeight = Math.max(0, canvasHeight - topPx - bottomPx);

      cropBox.style.left = `${leftPx}px`;
      cropBox.style.top = `${topPx}px`;
      cropBox.style.width = `${boxWidth}px`;
      cropBox.style.height = `${boxHeight}px`;

      // Update Scrims around crop box
      if (scrimTop) {
        scrimTop.style.top = '0';
        scrimTop.style.left = '0';
        scrimTop.style.width = '100%';
        scrimTop.style.height = `${topPx}px`;
      }
      if (scrimBottom) {
        scrimBottom.style.top = `${topPx + boxHeight}px`;
        scrimBottom.style.left = '0';
        scrimBottom.style.width = '100%';
        scrimBottom.style.height = `${canvasHeight - (topPx + boxHeight)}px`;
      }
      if (scrimLeft) {
        scrimLeft.style.top = `${topPx}px`;
        scrimLeft.style.left = '0';
        scrimLeft.style.width = `${leftPx}px`;
        scrimLeft.style.height = `${boxHeight}px`;
      }
      if (scrimRight) {
        scrimRight.style.top = `${topPx}px`;
        scrimRight.style.left = `${leftPx + boxWidth}px`;
        scrimRight.style.width = `${canvasWidth - (leftPx + boxWidth)}px`;
        scrimRight.style.height = `${boxHeight}px`;
      }
    }

    function onNumericInputChange() {
      const topPt = activeUnitToPt(marginTopInput.value);
      const rightPt = activeUnitToPt(marginRightInput.value);
      const bottomPt = activeUnitToPt(marginBottomInput.value);
      const leftPt = activeUnitToPt(marginLeftInput.value);

      if (leftPt + rightPt >= visualPageWidth || topPt + bottomPt >= visualPageHeight) {
        showError('Margins cannot be larger than the page dimensions.');
        return;
      }
      clearError();

      marginsPt.top = Math.max(0, topPt);
      marginsPt.right = Math.max(0, rightPt);
      marginsPt.bottom = Math.max(0, bottomPt);
      marginsPt.left = Math.max(0, leftPt);

      updateCropBoxFromMargins();
    }

    [marginTopInput, marginRightInput, marginBottomInput, marginLeftInput].forEach(inp => {
      if (inp) inp.addEventListener('input', onNumericInputChange);
    });

    if (unitSelect) {
      unitSelect.addEventListener('change', () => {
        activeUnit = unitSelect.value;
        updateNumericInputs();
      });
    }

    if (resetCropBtn) {
      resetCropBtn.addEventListener('click', () => {
        marginsPt = { top: 0, right: 0, bottom: 0, left: 0 };
        clearError();
        updateNumericInputs();
        updateCropBoxFromMargins();
      });
    }

    /* ==========================================================================
       AUTO-CROP WHITE MARGINS
       ========================================================================== */

    if (autoCropBtn) {
      autoCropBtn.addEventListener('click', async () => {
        if (!pdfJsDoc) return;
        try {
          const page = await pdfJsDoc.getPage(currentPageIndex + 1);
          // Render to offscreen canvas at 1.0 scale
          const unscaled = page.getViewport({ scale: 1.0 });
          const offCanvas = document.createElement('canvas');
          offCanvas.width = unscaled.width;
          offCanvas.height = unscaled.height;
          const offCtx = offCanvas.getContext('2d');
          offCtx.fillStyle = '#ffffff';
          offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);

          await page.render({ canvasContext: offCtx, viewport: unscaled }).promise;

          const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
          const data = imgData.data;
          const w = offCanvas.width;
          const h = offCanvas.height;

          let minX = w, maxX = 0, minY = h, maxY = 0;

          // Scan pixels for non-white content
          for (let y = 0; y < h; y += 2) {
            for (let x = 0; x < w; x += 2) {
              const idx = (y * w + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              // If not white / light background
              if (r < 248 || g < 248 || b < 248) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          if (maxX <= minX || maxY <= minY) {
            showError('Could not detect content boundaries on this page.');
            return;
          }

          const paddingPt = 15; // 15 pt padding
          const autoLeft = Math.max(0, minX - paddingPt);
          const autoTop = Math.max(0, minY - paddingPt);
          const autoRight = Math.max(0, w - maxX - paddingPt);
          const autoBottom = Math.max(0, h - maxY - paddingPt);

          marginsPt.left = autoLeft;
          marginsPt.top = autoTop;
          marginsPt.right = autoRight;
          marginsPt.bottom = autoBottom;

          clearError();
          updateNumericInputs();
          updateCropBoxFromMargins();
        } catch (e) {
          showError('Failed to auto-detect page margins.');
        }
      });
    }

    /* ==========================================================================
       INTERACTIVE CROP BOX DRAG & RESIZE HANDLERS
       ========================================================================== */

    let isInteracting = false;
    let interactionMode = null; // 'move', 'nw', 'ne', 'se', 'sw', 'n', 's', 'w', 'e'
    let startX = 0;
    let startY = 0;
    let startBox = { left: 0, top: 0, width: 0, height: 0 };

    function onPointerDown(e) {
      if (!cropBox) return;
      const target = e.target;
      if (target.classList.contains('crop-handle')) {
        const handleClass = Array.from(target.classList).find(c => c.startsWith('crop-handle-'));
        interactionMode = handleClass ? handleClass.replace('crop-handle-', '') : 'se';
      } else if (target === cropBox || cropBox.contains(target)) {
        interactionMode = 'move';
      } else {
        return;
      }

      isInteracting = true;
      startX = e.clientX || (e.touches && e.touches[0].clientX);
      startY = e.clientY || (e.touches && e.touches[0].clientY);

      const leftPx = marginsPt.left * renderScale;
      const topPx = marginsPt.top * renderScale;
      const boxWidth = Math.max(0, canvasWidth - leftPx - (marginsPt.right * renderScale));
      const boxHeight = Math.max(0, canvasHeight - topPx - (marginsPt.bottom * renderScale));

      startBox = { left: leftPx, top: topPx, width: boxWidth, height: boxHeight };

      e.preventDefault();
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchend', onPointerUp);
    }

    function onPointerMove(e) {
      if (!isInteracting) return;
      e.preventDefault();

      const curX = e.clientX || (e.touches && e.touches[0].clientX);
      const curY = e.clientY || (e.touches && e.touches[0].clientY);
      const dx = curX - startX;
      const dy = curY - startY;

      let newLeft = startBox.left;
      let newTop = startBox.top;
      let newWidth = startBox.width;
      let newHeight = startBox.height;

      const minSize = 20; // 20px min crop box size

      if (interactionMode === 'move') {
        newLeft = Math.max(0, Math.min(canvasWidth - newWidth, startBox.left + dx));
        newTop = Math.max(0, Math.min(canvasHeight - newHeight, startBox.top + dy));
      } else {
        if (interactionMode.includes('e')) {
          newWidth = Math.max(minSize, Math.min(canvasWidth - startBox.left, startBox.width + dx));
        }
        if (interactionMode.includes('s')) {
          newHeight = Math.max(minSize, Math.min(canvasHeight - startBox.top, startBox.height + dy));
        }
        if (interactionMode.includes('w')) {
          const maxLeftShift = startBox.width - minSize;
          const shift = Math.max(-startBox.left, Math.min(maxLeftShift, dx));
          newLeft = startBox.left + shift;
          newWidth = startBox.width - shift;
        }
        if (interactionMode.includes('n')) {
          const maxTopShift = startBox.height - minSize;
          const shift = Math.max(-startBox.top, Math.min(maxTopShift, dy));
          newTop = startBox.top + shift;
          newHeight = startBox.height - shift;
        }
      }

      // Convert back to pt margins
      const leftPt = newLeft / renderScale;
      const topPt = newTop / renderScale;
      const rightPt = (canvasWidth - newLeft - newWidth) / renderScale;
      const bottomPt = (canvasHeight - newTop - newHeight) / renderScale;

      marginsPt.left = Math.max(0, leftPt);
      marginsPt.top = Math.max(0, topPt);
      marginsPt.right = Math.max(0, rightPt);
      marginsPt.bottom = Math.max(0, bottomPt);

      updateCropBoxFromMargins();
      updateNumericInputs();
    }

    function onPointerUp() {
      if (isInteracting) {
        isInteracting = false;
        interactionMode = null;
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        window.removeEventListener('touchend', onPointerUp);
      }
    }

    if (cropBox) {
      cropBox.addEventListener('mousedown', onPointerDown);
      cropBox.addEventListener('touchstart', onPointerDown, { passive: false });
    }

    /* Scope selector toggle */
    if (cropScopeSelect && pageRangeGroup) {
      cropScopeSelect.addEventListener('change', () => {
        pageRangeGroup.classList.toggle('is-hidden', cropScopeSelect.value !== 'range');
      });
    }

    function parsePageRange(rangeStr, total) {
      const set = new Set();
      if (!rangeStr) return set;
      const parts = rangeStr.split(',');
      for (let part of parts) {
        part = part.trim();
        if (part.includes('-')) {
          const [startStr, endStr] = part.split('-');
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = Math.max(1, start); i <= Math.min(total, end); i++) {
              set.add(i - 1);
            }
          }
        } else {
          const p = parseInt(part, 10);
          if (!isNaN(p) && p >= 1 && p <= total) {
            set.add(p - 1);
          }
        }
      }
      return set;
    }

    /* ==========================================================================
       EXPORT & DOWNLOAD LOGIC
       ========================================================================== */

    async function executeCropExport() {
      if (actionExecuteBtn) {
        actionExecuteBtn.disabled = true;
        actionExecuteBtn.textContent = 'Cropping PDF...';
      }

      try {
        const scope = cropScopeSelect ? cropScopeSelect.value : 'all';
        let targetIndices = new Set();
        if (scope === 'all') {
          for (let i = 0; i < totalPages; i++) targetIndices.add(i);
        } else if (scope === 'current') {
          targetIndices.add(currentPageIndex);
        } else if (scope === 'range') {
          targetIndices = parsePageRange(pageRangeInput ? pageRangeInput.value : '', totalPages);
          if (targetIndices.size === 0) {
            throw new Error('Please specify a valid page range (e.g. 1-3, 5).');
          }
        }

        const isPermanent = permanentCropCheckbox && permanentCropCheckbox.checked;
        let exportPdfBytes = null;

        if (isPermanent) {
          // Rasterize pages to JPEG at 150 DPI and rebuild PDF
          const newDoc = await window.PDFLib.PDFDocument.create();
          const dpiScale = 150 / 72; // 150 DPI

          for (let i = 0; i < totalPages; i++) {
            const page = await pdfJsDoc.getPage(i + 1);
            const unscaled = page.getViewport({ scale: 1.0 });
            const pW = unscaled.width;
            const pH = unscaled.height;

            if (targetIndices.has(i)) {
              if (marginsPt.left + marginsPt.right >= pW || marginsPt.top + marginsPt.bottom >= pH) {
                throw new Error('Margins cannot be larger than the page dimensions.');
              }

              const croppedVisualW = pW - marginsPt.left - marginsPt.right;
              const croppedVisualH = pH - marginsPt.top - marginsPt.bottom;

              // Render page at 150 DPI
              const fullCanvas = document.createElement('canvas');
              fullCanvas.width = Math.round(pW * dpiScale);
              fullCanvas.height = Math.round(pH * dpiScale);
              const fullCtx = fullCanvas.getContext('2d');
              fullCtx.fillStyle = '#ffffff';
              fullCtx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);

              const dpiViewport = page.getViewport({ scale: dpiScale });
              await page.render({ canvasContext: fullCtx, viewport: dpiViewport }).promise;

              // Crop sub-rectangle
              const clipCanvas = document.createElement('canvas');
              clipCanvas.width = Math.round(croppedVisualW * dpiScale);
              clipCanvas.height = Math.round(croppedVisualH * dpiScale);
              const clipCtx = clipCanvas.getContext('2d');

              clipCtx.drawImage(
                fullCanvas,
                Math.round(marginsPt.left * dpiScale),
                Math.round(marginsPt.top * dpiScale),
                clipCanvas.width,
                clipCanvas.height,
                0,
                0,
                clipCanvas.width,
                clipCanvas.height
              );

              const jpgDataUrl = clipCanvas.toDataURL('image/jpeg', 0.92);
              const embeddedJpg = await newDoc.embedJpg(jpgDataUrl);
              const newPage = newDoc.addPage([croppedVisualW, croppedVisualH]);
              newPage.drawImage(embeddedJpg, {
                x: 0,
                y: 0,
                width: croppedVisualW,
                height: croppedVisualH
              });
            } else {
              // Uncropped page retained as lossless copy
              const [copiedPage] = await newDoc.copyPages(pdfLibDoc, [i]);
              newDoc.addPage(copiedPage);
            }
          }

          exportPdfBytes = await newDoc.save();
        } else {
          // Standard vector crop: adjust CropBox and MediaBox
          const libPages = pdfLibDoc.getPages();

          targetIndices.forEach(idx => {
            const page = libPages[idx];
            const existingCrop = page.getCropBox() || page.getMediaBox();
            const cropX = existingCrop.x;
            const cropY = existingCrop.y;
            const W = existingCrop.width;
            const H = existingCrop.height;

            const rot = ((page.getRotation().angle % 360) + 360) % 360;

            let visualW = W;
            let visualH = H;
            if (rot === 90 || rot === 270) {
              visualW = H;
              visualH = W;
            }

            if (marginsPt.left + marginsPt.right >= visualW || marginsPt.top + marginsPt.bottom >= visualH) {
              throw new Error('Margins cannot be larger than the page dimensions.');
            }

            let newX = cropX;
            let newY = cropY;
            let newW = W;
            let newH = H;

            if (rot === 0) {
              newX = cropX + marginsPt.left;
              newY = cropY + marginsPt.bottom;
              newW = W - marginsPt.left - marginsPt.right;
              newH = H - marginsPt.top - marginsPt.bottom;
            } else if (rot === 90) {
              newX = cropX + marginsPt.bottom;
              newY = cropY + marginsPt.left;
              newW = W - marginsPt.top - marginsPt.bottom;
              newH = H - marginsPt.left - marginsPt.right;
            } else if (rot === 180) {
              newX = cropX + marginsPt.right;
              newY = cropY + marginsPt.top;
              newW = W - marginsPt.left - marginsPt.right;
              newH = H - marginsPt.top - marginsPt.bottom;
            } else if (rot === 270) {
              newX = cropX + marginsPt.top;
              newY = cropY + marginsPt.right;
              newW = W - marginsPt.top - marginsPt.bottom;
              newH = H - marginsPt.left - marginsPt.right;
            }

            page.setCropBox(newX, newY, newW, newH);
            page.setMediaBox(newX, newY, newW, newH);
          });

          exportPdfBytes = await pdfLibDoc.save();
        }

        finalDownloadBlob = new Blob([exportPdfBytes], { type: 'application/pdf' });
        if (finalDownloadUrl) URL.revokeObjectURL(finalDownloadUrl);
        finalDownloadUrl = URL.createObjectURL(finalDownloadBlob);

        if (resultPageCountEl) resultPageCountEl.textContent = `${totalPages} pages`;
        if (resultFileSizeEl) {
          resultFileSizeEl.textContent = window.formatBytes ? window.formatBytes(finalDownloadBlob.size) : `${Math.round(finalDownloadBlob.size / 1024)} KB`;
        }

        if (editorArea) editorArea.classList.add('is-hidden');
        if (resultArea) resultArea.classList.remove('is-hidden');
        setStep(3);
      } catch (err) {
        showError(err.message || 'An error occurred while cropping the PDF.');
      } finally {
        if (actionExecuteBtn) {
          actionExecuteBtn.disabled = false;
          actionExecuteBtn.textContent = 'Save & Download Cropped PDF';
        }
      }
    }

    if (actionExecuteBtn) actionExecuteBtn.addEventListener('click', executeCropExport);

    if (resultDownloadBtn) {
      resultDownloadBtn.addEventListener('click', () => {
        if (!finalDownloadBlob) return;
        const fileName = `${originalBaseName}-cropped.pdf`;
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
       DRAG AND DROP FILE LISTENERS
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
