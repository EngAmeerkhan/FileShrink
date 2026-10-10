/**
 * FileShrink - Signature Resizer Engine (js/signature-tool.js)
 * High-performance, client-side signature resizing and target KB compression
 */

(function () {
  'use strict';

  window.initSignatureTool = function () {
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

    const originalPreviewImg = document.getElementById('originalPreviewImg');
    const previewImg = document.getElementById('previewImg');
    const originalSizeEl = document.getElementById('originalSize');
    const compressedSizeEl = document.getElementById('compressedSize');
    const finalDimensionsEl = document.getElementById('finalDimensions');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');
    const processBtn = document.getElementById('processBtn');

    // Controls
    const presetBtns = document.querySelectorAll('.preset-btn');
    const customWidthInput = document.getElementById('customWidth');
    const customHeightInput = document.getElementById('customHeight');
    const kbBtns = document.querySelectorAll('.kb-btn');
    const targetKbInput = document.getElementById('targetKbInput');
    const whiteBgCheckbox = document.getElementById('whiteBgCheckbox');

    // Step indicators
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    let loadedFile = null;
    let loadedImage = null;
    let currentResultBlob = null;
    let currentFileName = 'signature.jpg';

    let selectedWidth = 140;
    let selectedHeight = 60;
    let selectedTargetKB = 20;

    function setStep(step) {
      if (step1) step1.className = 'step-item' + (step === 1 ? ' active' : (step > 1 ? ' completed' : ''));
      if (step2) step2.className = 'step-item' + (step === 2 ? ' active' : (step > 2 ? ' completed' : ''));
      if (step3) step3.className = 'step-item' + (step === 3 ? ' active' : '');
    }

    function resetTool() {
      if (fileInput) fileInput.value = '';
      loadedFile = null;
      loadedImage = null;
      currentResultBlob = null;
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
    }

    // Helper: Canvas to Blob
    function canvasToBlob(canvas, quality) {
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
      });
    }

    // Preset Dimension Buttons
    presetBtns.forEach((btn) => {
      btn.addEventListener('click', function () {
        presetBtns.forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        const w = parseInt(this.dataset.w, 10);
        const h = parseInt(this.dataset.h, 10);
        if (w && h) {
          selectedWidth = w;
          selectedHeight = h;
          if (customWidthInput) customWidthInput.value = w;
          if (customHeightInput) customHeightInput.value = h;
        }
      });
    });

    // Custom Width / Height change
    if (customWidthInput && customHeightInput) {
      const handleCustomDim = () => {
        const w = parseInt(customWidthInput.value, 10);
        const h = parseInt(customHeightInput.value, 10);
        if (w > 0 && h > 0) {
          selectedWidth = w;
          selectedHeight = h;
          presetBtns.forEach((b) => {
            if (parseInt(b.dataset.w, 10) === w && parseInt(b.dataset.h, 10) === h) {
              b.classList.add('active');
            } else {
              b.classList.remove('active');
            }
          });
        }
      };
      customWidthInput.addEventListener('input', handleCustomDim);
      customHeightInput.addEventListener('input', handleCustomDim);
    }

    // Quick KB Buttons
    kbBtns.forEach((btn) => {
      btn.addEventListener('click', function () {
        kbBtns.forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
        const kb = parseInt(this.dataset.kb, 10);
        selectedTargetKB = kb || 0;
        if (targetKbInput) targetKbInput.value = kb || '';
      });
    });

    if (targetKbInput) {
      targetKbInput.addEventListener('input', function () {
        const kb = parseInt(this.value, 10);
        selectedTargetKB = kb > 0 ? kb : 0;
        kbBtns.forEach((b) => {
          if (parseInt(b.dataset.kb, 10) === selectedTargetKB) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });
      });
    }

    // File selected
    function handleFile(file) {
      if (!file) return;
      if (file.size === 0) {
        showError('The selected file is empty (0 KB). Please choose a valid signature image.');
        return;
      }
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type.toLowerCase()) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
        showError('Please select a valid signature image (JPG, PNG, or WEBP).');
        return;
      }

      loadedFile = file;
      const originalBaseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      currentFileName = `${originalBaseName}-signature.jpg`;

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        loadedImage = img;
        URL.revokeObjectURL(objectUrl);
        if (uploadArea) uploadArea.classList.add('is-hidden');
        if (errorArea) errorArea.classList.add('is-hidden');
        if (configArea) configArea.classList.remove('is-hidden');
        setStep(2);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        showError('Failed to load image. Please choose another file.');
      };
      img.src = objectUrl;
    }

    // Process & Resize Action
    async function processSignature() {
      if (!loadedImage) return;

      if (configArea) configArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.remove('is-hidden');
      setStep(2);

      const targetW = selectedWidth || 140;
      const targetH = selectedHeight || 60;
      const maxBytes = selectedTargetKB > 0 ? selectedTargetKB * 1024 : 100 * 1024;
      const useWhiteBg = whiteBgCheckbox ? whiteBgCheckbox.checked : true;

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      // Fill background (white background to prevent transparent PNG turning black)
      if (useWhiteBg) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
      }

      // Aspect ratio fit
      const imgRatio = loadedImage.naturalWidth / loadedImage.naturalHeight;
      const targetRatio = targetW / targetH;
      let drawW, drawH, offsetX, offsetY;

      if (imgRatio > targetRatio) {
        drawW = targetW;
        drawH = targetW / imgRatio;
        offsetX = 0;
        offsetY = (targetH - drawH) / 2;
      } else {
        drawH = targetH;
        drawW = targetH * imgRatio;
        offsetX = (targetW - drawW) / 2;
        offsetY = 0;
      }

      ctx.drawImage(loadedImage, offsetX, offsetY, drawW, drawH);

      // Search optimal JPEG quality (0.05 to 0.98)
      let minQ = 0.05;
      let maxQ = 0.98;
      let bestBlob = null;

      for (let iter = 0; iter < 7; iter++) {
        const midQ = (minQ + maxQ) / 2;
        const blob = await canvasToBlob(canvas, midQ);
        if (!blob) break;

        if (blob.size <= maxBytes) {
          bestBlob = blob;
          minQ = midQ;
        } else {
          maxQ = midQ;
        }
      }

      if (!bestBlob) {
        bestBlob = await canvasToBlob(canvas, 0.05);
      }

      currentResultBlob = bestBlob;

      // Show Result
      if (processingArea) processingArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.remove('is-hidden');

      if (originalPreviewImg && loadedFile) {
        originalPreviewImg.src = URL.createObjectURL(loadedFile);
      }
      if (previewImg && bestBlob) {
        previewImg.src = URL.createObjectURL(bestBlob);
      }
      if (originalSizeEl && loadedFile) {
        originalSizeEl.textContent = `${window.formatBytes(loadedFile.size)} (${loadedImage.naturalWidth}×${loadedImage.naturalHeight}px)`;
      }
      if (compressedSizeEl && bestBlob) {
        compressedSizeEl.textContent = window.formatBytes(bestBlob.size);
      }
      if (finalDimensionsEl) {
        finalDimensionsEl.textContent = `${targetW} × ${targetH} px`;
      }

      setStep(3);
    }

    // Event Listeners
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
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
          handleFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (processBtn) {
      processBtn.addEventListener('click', () => {
        setTimeout(processSignature, 50);
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        if (currentResultBlob) window.downloadBlob(currentResultBlob, currentFileName);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', resetTool);
    }

    resetTool();
  };
})();
