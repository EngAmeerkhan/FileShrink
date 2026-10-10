/**
 * FileShrink - CNIC Front and Back on One Page Tool (js/cnic-tool.js)
 * Client-side layout engine placing two card photos onto one A4 printable page
 */

(function () {
  'use strict';

  window.initCnicTool = function () {
    // DOM Elements - Front Card
    const frontDropzone = document.getElementById('frontDropzone');
    const frontInput = document.getElementById('frontInput');
    const frontPreview = document.getElementById('frontPreview');
    const frontPlaceholder = document.getElementById('frontPlaceholder');
    const frontRotateBtn = document.getElementById('frontRotateBtn');
    const frontZoomInput = document.getElementById('frontZoomInput');
    const frontRemoveBtn = document.getElementById('frontRemoveBtn');

    // DOM Elements - Back Card
    const backDropzone = document.getElementById('backDropzone');
    const backInput = document.getElementById('backInput');
    const backPreview = document.getElementById('backPreview');
    const backPlaceholder = document.getElementById('backPlaceholder');
    const backRotateBtn = document.getElementById('backRotateBtn');
    const backZoomInput = document.getElementById('backZoomInput');
    const backRemoveBtn = document.getElementById('backRemoveBtn');

    // Global Options
    const cardSizeSlider = document.getElementById('cardSizeSlider');
    const purposeInput = document.getElementById('purposeInput');
    const borderCheckbox = document.getElementById('borderCheckbox');

    // Canvas & Preview
    const a4PreviewCanvas = document.getElementById('a4PreviewCanvas');
    const generateArea = document.getElementById('generateArea');
    const errorArea = document.getElementById('errorArea');
    const errorMessage = document.getElementById('errorMessage');

    // Download Buttons
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const downloadJpgBtn = document.getElementById('downloadJpgBtn');
    const resetAllBtn = document.getElementById('resetAllBtn');

    // Step indicators
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    // State for each side
    const frontState = {
      file: null,
      img: null,
      rotation: 0, // 0, 90, 180, 270
      zoom: 1.0
    };

    const backState = {
      file: null,
      img: null,
      rotation: 0,
      zoom: 1.0
    };

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
    }

    function hideError() {
      if (errorArea) errorArea.classList.add('is-hidden');
    }

    function loadCardImage(file, isFront) {
      if (!file) return;
      if (file.size === 0) {
        showError('The selected file is empty (0 KB). Please choose a valid image.');
        return;
      }
      if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
        showError('Please choose a valid JPG, PNG, or WEBP image.');
        return;
      }

      hideError();
      const state = isFront ? frontState : backState;
      state.file = file;
      state.rotation = 0;
      state.zoom = 1.0;

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        state.img = img;
        updateCardSlotUI(isFront);
        renderA4Layout();
      };
      img.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        showError('Could not load image file. Please check the file format.');
      };
      img.src = objectUrl;
    }

    function updateCardSlotUI(isFront) {
      const state = isFront ? frontState : backState;
      const previewEl = isFront ? frontPreview : backPreview;
      const placeholderEl = isFront ? frontPlaceholder : backPlaceholder;
      const dropzoneEl = isFront ? frontDropzone : backDropzone;
      const zoomInputEl = isFront ? frontZoomInput : backZoomInput;

      if (state.img) {
        previewEl.src = state.img.src;
        previewEl.classList.remove('is-hidden');
        placeholderEl.classList.add('is-hidden');
        dropzoneEl.classList.add('has-image');
        if (zoomInputEl) zoomInputEl.value = '1';
      } else {
        previewEl.src = '';
        previewEl.classList.add('is-hidden');
        placeholderEl.classList.remove('is-hidden');
        dropzoneEl.classList.remove('has-image');
      }

      // Check if both or at least one is loaded to show step 2
      if (frontState.img || backState.img) {
        if (generateArea) generateArea.classList.remove('is-hidden');
        setStep(2);
      }
      if (frontState.img && backState.img) {
        setStep(3);
      }
    }

    function removeCardImage(isFront) {
      const state = isFront ? frontState : backState;
      if (state.img && state.img.src.startsWith('blob:')) {
        URL.revokeObjectURL(state.img.src);
      }
      state.file = null;
      state.img = null;
      state.rotation = 0;
      state.zoom = 1.0;
      const inputEl = isFront ? frontInput : backInput;
      if (inputEl) inputEl.value = '';

      updateCardSlotUI(isFront);
      renderA4Layout();
    }

    // Helper: Draw a single rotated and zoomed card onto target context
    function drawCardOnCanvas(ctx, state, x, y, destWidth, destHeight, withBorder) {
      ctx.save();
      ctx.translate(x + destWidth / 2, y + destHeight / 2);
      ctx.rotate((state.rotation * Math.PI) / 180);

      const rad = (state.rotation * Math.PI) / 180;
      const isRotated90 = state.rotation === 90 || state.rotation === 270;
      const boxW = isRotated90 ? destHeight : destWidth;
      const boxH = isRotated90 ? destWidth : destHeight;

      const imgAspect = state.img.naturalWidth / state.img.naturalHeight;
      const boxAspect = boxW / boxH;

      let drawW, drawH;
      if (imgAspect > boxAspect) {
        // Image is wider than box
        drawW = boxW * state.zoom;
        drawH = (boxW / imgAspect) * state.zoom;
      } else {
        drawH = boxH * state.zoom;
        drawW = boxH * imgAspect * state.zoom;
      }

      // Clip to card bounding box
      ctx.beginPath();
      ctx.rect(-boxW / 2, -boxH / 2, boxW, boxH);
      ctx.clip();

      // Draw image centered in clipped box
      ctx.drawImage(state.img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      // Draw light border around card box if requested
      if (withBorder) {
        ctx.save();
        ctx.strokeStyle = '#94a3b8'; // crisp light border
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, destWidth, destHeight);
        ctx.restore();
      }
    }

    // Main layout rendering onto canvas
    function renderA4Layout(isExport = false) {
      if (!a4PreviewCanvas) return;

      // A4 dimensions at 150 DPI (clean resolution for print & fast preview)
      const a4Width = isExport ? 2480 : 1240;
      const a4Height = isExport ? 3508 : 1754;

      const canvas = isExport ? document.createElement('canvas') : a4PreviewCanvas;
      canvas.width = a4Width;
      canvas.height = a4Height;
      const ctx = canvas.getContext('2d');

      // 1. Fill solid clean white A4 background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, a4Width, a4Height);

      // Card sizing calculations
      const scaleMultiplier = parseFloat(cardSizeSlider ? cardSizeSlider.value : 1.0) || 1.0;
      // Proportional card dimensions (aspect ~ 1.58 like standard cards)
      const baseCardWidth = a4Width * 0.58 * scaleMultiplier;
      const baseCardHeight = baseCardWidth / 1.58;

      const gap = a4Height * 0.045; // comfortable gap between cards
      const purposeText = purposeInput ? purposeInput.value.trim() : '';
      const textHeightEstimate = purposeText ? 80 * (a4Width / 1240) : 0;

      const totalBlockHeight = baseCardHeight * 2 + gap + textHeightEstimate;
      let startY = (a4Height - totalBlockHeight) / 2;
      // Keep inside page bounds
      if (startY < a4Height * 0.08) startY = a4Height * 0.08;

      const cardX = (a4Width - baseCardWidth) / 2;
      const withBorder = borderCheckbox ? borderCheckbox.checked : true;

      // Draw Front Card (Top)
      if (frontState.img) {
        drawCardOnCanvas(ctx, frontState, cardX, startY, baseCardWidth, baseCardHeight, withBorder);
      } else {
        // Outline placeholder if no image yet
        ctx.save();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(cardX, startY, baseCardWidth, baseCardHeight);
        ctx.fillStyle = '#94a3b8';
        ctx.font = `${Math.round(28 * (a4Width / 1240))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Front Side (Upload Above)', a4Width / 2, startY + baseCardHeight / 2);
        ctx.restore();
      }

      // Draw Back Card (Bottom)
      const backY = startY + baseCardHeight + gap;
      if (backState.img) {
        drawCardOnCanvas(ctx, backState, cardX, backY, baseCardWidth, baseCardHeight, withBorder);
      } else {
        ctx.save();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(cardX, backY, baseCardWidth, baseCardHeight);
        ctx.fillStyle = '#94a3b8';
        ctx.font = `${Math.round(28 * (a4Width / 1240))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Back Side (Upload Above)', a4Width / 2, backY + baseCardHeight / 2);
        ctx.restore();
      }

      // Draw Purpose Text Overlay
      if (purposeText) {
        const textY = backY + baseCardHeight + 50 * (a4Width / 1240);
        ctx.save();
        ctx.fillStyle = '#334155';
        ctx.font = `600 ${Math.round(26 * (a4Width / 1240))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(purposeText, a4Width / 2, textY);
        ctx.restore();
      }

      return canvas;
    }

    // Attach File Upload Listeners
    if (frontInput) {
      frontInput.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) loadCardImage(e.target.files[0], true);
      });
    }
    if (backInput) {
      backInput.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) loadCardImage(e.target.files[0], false);
      });
    }

    if (frontDropzone && frontInput) {
      frontDropzone.addEventListener('click', e => {
        if (!e.target.closest('.card-action-bar')) frontInput.click();
      });
      frontDropzone.addEventListener('dragover', e => {
        e.preventDefault();
        frontDropzone.classList.add('dragover');
      });
      ['dragleave', 'dragend'].forEach(type => frontDropzone.addEventListener(type, () => frontDropzone.classList.remove('dragover')));
      frontDropzone.addEventListener('drop', e => {
        e.preventDefault();
        frontDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) loadCardImage(e.dataTransfer.files[0], true);
      });
    }

    if (backDropzone && backInput) {
      backDropzone.addEventListener('click', e => {
        if (!e.target.closest('.card-action-bar')) backInput.click();
      });
      backDropzone.addEventListener('dragover', e => {
        e.preventDefault();
        backDropzone.classList.add('dragover');
      });
      ['dragleave', 'dragend'].forEach(type => backDropzone.addEventListener(type, () => backDropzone.classList.remove('dragover')));
      backDropzone.addEventListener('drop', e => {
        e.preventDefault();
        backDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) loadCardImage(e.dataTransfer.files[0], false);
      });
    }

    // Rotation controls
    if (frontRotateBtn) {
      frontRotateBtn.addEventListener('click', e => {
        e.stopPropagation();
        frontState.rotation = (frontState.rotation + 90) % 360;
        renderA4Layout();
      });
    }
    if (backRotateBtn) {
      backRotateBtn.addEventListener('click', e => {
        e.stopPropagation();
        backState.rotation = (backState.rotation + 90) % 360;
        renderA4Layout();
      });
    }

    // Zoom controls
    if (frontZoomInput) {
      frontZoomInput.addEventListener('input', e => {
        e.stopPropagation();
        frontState.zoom = parseFloat(frontZoomInput.value) || 1.0;
        renderA4Layout();
      });
    }
    if (backZoomInput) {
      backZoomInput.addEventListener('input', e => {
        e.stopPropagation();
        backState.zoom = parseFloat(backZoomInput.value) || 1.0;
        renderA4Layout();
      });
    }

    // Remove buttons
    if (frontRemoveBtn) {
      frontRemoveBtn.addEventListener('click', e => {
        e.stopPropagation();
        removeCardImage(true);
      });
    }
    if (backRemoveBtn) {
      backRemoveBtn.addEventListener('click', e => {
        e.stopPropagation();
        removeCardImage(false);
      });
    }

    // Options updates
    [cardSizeSlider, purposeInput, borderCheckbox].forEach(el => {
      if (el) {
        el.addEventListener('input', () => renderA4Layout());
        el.addEventListener('change', () => renderA4Layout());
      }
    });

    // Download PDF (A4)
    if (downloadPdfBtn) {
      downloadPdfBtn.addEventListener('click', () => {
        if (!frontState.img && !backState.img) {
          showError('Please upload at least one side of your card first.');
          return;
        }

        const exportCanvas = renderA4Layout(true);
        const imgData = exportCanvas.toDataURL('image/jpeg', 0.95);

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'pt',
          format: 'a4'
        });

        // A4 page in points: 595.28 x 841.89
        pdf.addImage(imgData, 'JPEG', 0, 0, 595.28, 841.89, undefined, 'FAST');
        pdf.save('cnic-copy.pdf');
        setStep(3);
      });
    }

    // Download JPG
    if (downloadJpgBtn) {
      downloadJpgBtn.addEventListener('click', () => {
        if (!frontState.img && !backState.img) {
          showError('Please upload at least one side of your card first.');
          return;
        }

        const exportCanvas = renderA4Layout(true);
        exportCanvas.toBlob(blob => {
          if (blob) {
            window.downloadBlob(blob, 'cnic-copy.jpg', 'image/jpeg');
            setStep(3);
          }
        }, 'image/jpeg', 0.95);
      });
    }

    // Reset All
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', () => {
        removeCardImage(true);
        removeCardImage(false);
        if (purposeInput) purposeInput.value = '';
        if (cardSizeSlider) cardSizeSlider.value = '1.0';
        if (borderCheckbox) borderCheckbox.checked = true;
        hideError();
        setStep(1);
        renderA4Layout();
      });
    }

    // Initial render
    setStep(1);
    renderA4Layout();
  };
})();
