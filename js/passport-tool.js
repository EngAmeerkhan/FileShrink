/**
 * FileShrink - Passport Photo Maker Engine (js/passport-tool.js)
 * Interactive pan/zoom cropper, exact pixel & physical dimension rendering, KB compression, and A4 print sheet
 */

(function () {
  'use strict';

  window.initPassportTool = function () {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadArea = document.getElementById('uploadArea');
    const editorArea = document.getElementById('editorArea');
    const processingArea = document.getElementById('processingArea');
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');
    const errorMessage = document.getElementById('errorMessage');

    const cropCanvas = document.getElementById('cropCanvas');
    const cropGuide = document.getElementById('cropGuide');
    const zoomSlider = document.getElementById('zoomSlider');
    const presetSelect = document.getElementById('presetSelect');
    const customDimRow = document.getElementById('customDimRow');
    const customWidth = document.getElementById('customWidth');
    const customHeight = document.getElementById('customHeight');
    const customUnit = document.getElementById('customUnit');
    const customDpi = document.getElementById('customDpi');

    const targetKbInput = document.getElementById('targetKbInput');
    const quickKbBtns = document.querySelectorAll('.quick-kb-btn');
    const fillWhiteCheckbox = document.getElementById('fillWhiteCheckbox');

    const generateBtn = document.getElementById('generateBtn');
    const downloadPhotoBtn = document.getElementById('downloadPhotoBtn');
    const printSheetBtn = document.getElementById('printSheetBtn');
    const resetBtn = document.getElementById('resetBtn');

    const previewPhotoImg = document.getElementById('previewPhotoImg');
    const resultPxLabel = document.getElementById('resultPxLabel');
    const resultKbLabel = document.getElementById('resultKbLabel');

    // Step indicators
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    let loadedImage = null;
    let baseFileName = 'photo';
    let zoomLevel = 1.0;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    let targetWidthPx = 413;
    let targetHeightPx = 531;

    let finalPassportBlob = null;
    let finalSheetBlob = null;

    function setStep(step) {
      if (step1) step1.className = 'step-item' + (step === 1 ? ' active' : (step > 1 ? ' completed' : ''));
      if (step2) step2.className = 'step-item' + (step === 2 ? ' active' : (step > 2 ? ' completed' : ''));
      if (step3) step3.className = 'step-item' + (step === 3 ? ' active' : '');
    }

    function resetTool() {
      if (fileInput) fileInput.value = '';
      loadedImage = null;
      finalPassportBlob = null;
      finalSheetBlob = null;
      if (uploadArea) uploadArea.classList.remove('is-hidden');
      if (editorArea) editorArea.classList.add('is-hidden');
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
    }

    function updateTargetDimensions() {
      const preset = presetSelect ? presetSelect.value : '35x45';
      if (preset === '35x45') {
        // 35x45 mm at 300 DPI
        targetWidthPx = 413;
        targetHeightPx = 531;
        if (customDimRow) customDimRow.classList.add('is-hidden');
      } else if (preset === '2x2') {
        // 2x2 inch at 300 DPI
        targetWidthPx = 600;
        targetHeightPx = 600;
        if (customDimRow) customDimRow.classList.add('is-hidden');
      } else if (preset === 'custom') {
        if (customDimRow) customDimRow.classList.remove('is-hidden');
        const w = parseFloat(customWidth ? customWidth.value : 35);
        const h = parseFloat(customHeight ? customHeight.value : 45);
        const unit = customUnit ? customUnit.value : 'mm';
        const dpi = parseFloat(customDpi ? customDpi.value : 300) || 300;

        if (unit === 'px') {
          targetWidthPx = Math.round(w);
          targetHeightPx = Math.round(h);
        } else if (unit === 'mm') {
          targetWidthPx = Math.round((w / 25.4) * dpi);
          targetHeightPx = Math.round((h / 25.4) * dpi);
        } else if (unit === 'cm') {
          targetWidthPx = Math.round((w / 2.54) * dpi);
          targetHeightPx = Math.round((h / 2.54) * dpi);
        } else if (unit === 'inch') {
          targetWidthPx = Math.round(w * dpi);
          targetHeightPx = Math.round(h * dpi);
        }
      }

      updateCropGuideAspect();
      drawEditorCanvas();
    }

    function updateCropGuideAspect() {
      if (!cropGuide || !cropCanvas) return;
      const canvasW = cropCanvas.width;
      const canvasH = cropCanvas.height;
      const targetRatio = targetWidthPx / targetHeightPx;

      let guideW, guideH;
      const maxGuideW = canvasW * 0.8;
      const maxGuideH = canvasH * 0.8;

      if (targetRatio > (maxGuideW / maxGuideH)) {
        guideW = maxGuideW;
        guideH = maxGuideW / targetRatio;
      } else {
        guideH = maxGuideH;
        guideW = maxGuideH * targetRatio;
      }

      cropGuide.style.width = `${guideW}px`;
      cropGuide.style.height = `${guideH}px`;
    }

    function drawEditorCanvas() {
      if (!cropCanvas || !loadedImage) return;
      const ctx = cropCanvas.getContext('2d');
      const cw = cropCanvas.width;
      const ch = cropCanvas.height;

      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, cw, ch);

      // Draw loaded image with zoom and pan
      const imgW = loadedImage.naturalWidth;
      const imgH = loadedImage.naturalHeight;
      const baseScale = Math.max(cw / imgW, ch / imgH);
      const curScale = baseScale * zoomLevel;

      const drawW = imgW * curScale;
      const drawH = imgH * curScale;
      const drawX = (cw - drawW) / 2 + panX;
      const drawY = (ch - drawH) / 2 + panY;

      ctx.drawImage(loadedImage, drawX, drawY, drawW, drawH);
    }

    // Initialize Canvas Cropper Listeners
    function setupCropperEvents() {
      if (!cropCanvas) return;

      const getPos = (e) => {
        const rect = cropCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
          x: (clientX - rect.left) * (cropCanvas.width / rect.width),
          y: (clientY - rect.top) * (cropCanvas.height / rect.height)
        };
      };

      const startDrag = (e) => {
        isDragging = true;
        const p = getPos(e);
        dragStartX = p.x - panX;
        dragStartY = p.y - panY;
      };

      const doDrag = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const p = getPos(e);
        panX = p.x - dragStartX;
        panY = p.y - dragStartY;
        drawEditorCanvas();
      };

      const endDrag = () => {
        isDragging = false;
      };

      cropCanvas.addEventListener('mousedown', startDrag);
      window.addEventListener('mousemove', doDrag);
      window.addEventListener('mouseup', endDrag);

      cropCanvas.addEventListener('touchstart', startDrag, { passive: false });
      window.addEventListener('touchmove', doDrag, { passive: false });
      window.addEventListener('touchend', endDrag);
    }

    if (zoomSlider) {
      zoomSlider.addEventListener('input', function () {
        zoomLevel = parseFloat(this.value);
        drawEditorCanvas();
      });
    }

    if (presetSelect) {
      presetSelect.addEventListener('change', updateTargetDimensions);
    }

    [customWidth, customHeight, customUnit, customDpi].forEach(el => {
      if (el) el.addEventListener('input', updateTargetDimensions);
    });

    // Quick KB buttons
    if (quickKbBtns) {
      quickKbBtns.forEach(btn => {
        btn.addEventListener('click', function () {
          const kb = this.getAttribute('data-kb');
          if (kb && targetKbInput) {
            if (targetKbInput.value === kb) {
              targetKbInput.value = '';
              quickKbBtns.forEach(b => b.classList.remove('active'));
            } else {
              targetKbInput.value = kb;
              quickKbBtns.forEach(b => b.classList.remove('active'));
              this.classList.add('active');
            }
          }
        });
      });
    }

    // Load photo
    async function loadPhoto(file) {
      if (!file) return;
      if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
        showError('Please choose a valid photo (JPG, PNG, or WEBP).');
        return;
      }

      baseFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const objUrl = URL.createObjectURL(file);
      const img = new Image();

      try {
        await new Promise((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error('Photo could not be loaded'));
          img.src = objUrl;
        });

        loadedImage = img;
        panX = 0;
        panY = 0;
        zoomLevel = 1.0;
        if (zoomSlider) zoomSlider.value = 1.0;

        if (uploadArea) uploadArea.classList.add('is-hidden');
        if (editorArea) editorArea.classList.remove('is-hidden');
        if (resultArea) resultArea.classList.add('is-hidden');
        if (errorArea) errorArea.classList.add('is-hidden');

        // Set internal canvas resolution
        if (cropCanvas) {
          cropCanvas.width = 440;
          cropCanvas.height = 380;
        }

        updateTargetDimensions();
        setStep(2);
      } catch (err) {
        URL.revokeObjectURL(objUrl);
        showError('Could not load photo. Please check the file.');
      }
    }

    // Export cropped photo to exact pixel target
    async function renderFinalPhoto() {
      if (!loadedImage || !cropCanvas || !cropGuide) return;

      if (errorArea) errorArea.classList.add('is-hidden');
      if (editorArea) editorArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.remove('is-hidden');

      try {
        const cw = cropCanvas.width;
        const ch = cropCanvas.height;
        const guideRect = cropGuide.getBoundingClientRect();
        const canvasRect = cropCanvas.getBoundingClientRect();

        const guideXOnCanvas = (guideRect.left - canvasRect.left) * (cw / canvasRect.width);
        const guideYOnCanvas = (guideRect.top - canvasRect.top) * (ch / canvasRect.height);
        const guideWOnCanvas = guideRect.width * (cw / canvasRect.width);
        const guideHOnCanvas = guideRect.height * (ch / canvasRect.height);

        // Offscreen export canvas
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = targetWidthPx;
        exportCanvas.height = targetHeightPx;
        const expCtx = exportCanvas.getContext('2d');

        // Fill background
        expCtx.fillStyle = '#FFFFFF';
        expCtx.fillRect(0, 0, targetWidthPx, targetHeightPx);

        // Draw cropped section scaled up/down directly to target pixel size
        expCtx.drawImage(
          cropCanvas,
          guideXOnCanvas, guideYOnCanvas, guideWOnCanvas, guideHOnCanvas,
          0, 0, targetWidthPx, targetHeightPx
        );

        // Optional KB limit search
        const targetKb = targetKbInput && targetKbInput.value ? parseFloat(targetKbInput.value) : null;
        const targetBytes = targetKb ? targetKb * 1024 : null;

        let bestBlob = null;
        let qualities = targetBytes ? [0.95, 0.85, 0.70, 0.55, 0.40, 0.25, 0.10] : [0.95];

        for (let q of qualities) {
          const blob = await new Promise(res => exportCanvas.toBlob(b => res(b), 'image/jpeg', q));
          if (!targetBytes || blob.size <= targetBytes) {
            bestBlob = blob;
            break;
          }
          bestBlob = blob;
        }

        finalPassportBlob = bestBlob;

        // Build A4 Print Sheet
        finalSheetBlob = await createPrintSheetBlob(exportCanvas);

        if (processingArea) processingArea.classList.add('is-hidden');
        if (resultArea) resultArea.classList.remove('is-hidden');

        if (previewPhotoImg) {
          previewPhotoImg.src = URL.createObjectURL(finalPassportBlob);
        }
        if (resultPxLabel) {
          resultPxLabel.textContent = `${targetWidthPx} x ${targetHeightPx} px`;
        }
        if (resultKbLabel) {
          resultKbLabel.textContent = window.formatBytes(finalPassportBlob.size);
        }

        setStep(3);
      } catch (err) {
        if (processingArea) processingArea.classList.add('is-hidden');
        if (editorArea) editorArea.classList.remove('is-hidden');
        showError('Could not process photo.');
      }
    }

    // Build A4 Print Sheet (300 DPI: 2480 x 3508 px) with multiple copies
    async function createPrintSheetBlob(photoCanvas) {
      const sheetCanvas = document.createElement('canvas');
      sheetCanvas.width = 2480;
      sheetCanvas.height = 3508;
      const sCtx = sheetCanvas.getContext('2d');

      sCtx.fillStyle = '#FFFFFF';
      sCtx.fillRect(0, 0, 2480, 3508);

      const marginX = 150;
      const marginY = 150;
      const gapX = 60;
      const gapY = 60;

      const photoW = photoCanvas.width;
      const photoH = photoCanvas.height;

      const cols = Math.floor((2480 - (marginX * 2) + gapX) / (photoW + gapX));
      const rows = Math.floor((3508 - (marginY * 2) + gapY) / (photoH + gapY));

      const totalCols = Math.max(1, Math.min(cols, 4));
      const totalRows = Math.max(1, Math.min(rows, 6));

      for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < totalCols; c++) {
          const x = marginX + c * (photoW + gapX);
          const y = marginY + r * (photoH + gapY);

          // Subtle cutting border
          sCtx.strokeStyle = '#e2e8f0';
          sCtx.lineWidth = 2;
          sCtx.strokeRect(x - 1, y - 1, photoW + 2, photoH + 2);

          sCtx.drawImage(photoCanvas, x, y, photoW, photoH);
        }
      }

      return new Promise(res => sheetCanvas.toBlob(b => res(b), 'image/jpeg', 0.92));
    }

    // Attach File Event Listeners
    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
          loadPhoto(e.target.files[0]);
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
          loadPhoto(e.dataTransfer.files[0]);
        }
      });
    }

    if (generateBtn) {
      generateBtn.addEventListener('click', renderFinalPhoto);
    }

    if (downloadPhotoBtn) {
      downloadPhotoBtn.addEventListener('click', function () {
        if (finalPassportBlob) {
          window.downloadBlob(finalPassportBlob, `${baseFileName}-passport.jpg`);
        }
      });
    }

    if (printSheetBtn) {
      printSheetBtn.addEventListener('click', function () {
        if (finalSheetBlob) {
          window.downloadBlob(finalSheetBlob, `${baseFileName}-passport-sheet.jpg`);
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', resetTool);
    }

    setupCropperEvents();
    resetTool();
  };
})();
