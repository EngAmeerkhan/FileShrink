/**
 * FileShrink - Image Compression Engine (js/image-tool.js)
 * High-performance, client-side canvas-based binary search compression
 */

(function () {
  'use strict';

  window.initImageTool = function (config) {
    const isCustom = !!config.isCustom;
    let targetKB = config.targetKB || 50;
    let targetBytes = targetKB * 1024;
    let suffix = config.outputSuffix || `${targetKB}kb`;

    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadArea = document.getElementById('uploadArea');
    const processingArea = document.getElementById('processingArea');
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');
    const errorMessage = document.getElementById('errorMessage');

    const customTargetInput = document.getElementById('customTargetInput');
    const quickSizeBtns = document.querySelectorAll('.quick-size-btn');

    const previewImg = document.getElementById('previewImg');
    const originalSizeEl = document.getElementById('originalSize');
    const compressedSizeEl = document.getElementById('compressedSize');
    const sizeSavedEl = document.getElementById('sizeSaved');
    const statusNoteEl = document.getElementById('statusNote');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');

    // Step indicators
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    let currentResultBlob = null;
    let currentFileName = `image-${suffix}.jpg`;
    let currentLoadedFile = null;

    function getCustomTargetKB() {
      if (!isCustom) return targetKB;
      const val = parseFloat(customTargetInput ? customTargetInput.value : targetKB);
      if (isNaN(val) || val <= 0 || val > 10000) {
        return null;
      }
      return val;
    }

    // Update Step Indicators
    function setStep(step) {
      if (step1) {
        step1.className = 'step-item' + (step === 1 ? ' active' : (step > 1 ? ' completed' : ''));
      }
      if (step2) {
        step2.className = 'step-item' + (step === 2 ? ' active' : (step > 2 ? ' completed' : ''));
      }
      if (step3) {
        step3.className = 'step-item' + (step === 3 ? ' active' : '');
      }
    }

    // Reset Tool State
    function resetTool() {
      if (fileInput) fileInput.value = '';
      currentResultBlob = null;
      currentLoadedFile = null;
      if (uploadArea) uploadArea.classList.remove('is-hidden');
      if (processingArea) processingArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.add('is-hidden');
      if (errorArea) errorArea.classList.add('is-hidden');
      if (statusNoteEl) statusNoteEl.classList.add('is-hidden');
      setStep(1);
    }

    // Display Error Message
    function showError(msg) {
      if (uploadArea) uploadArea.classList.remove('is-hidden');
      if (processingArea) processingArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.add('is-hidden');
      if (errorArea) {
        errorArea.classList.remove('is-hidden');
        if (errorMessage) errorMessage.textContent = msg;
      }
      setStep(1);
    }

    // Helper: Convert canvas to JPEG blob at given quality
    function canvasToBlob(canvas, quality) {
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
      });
    }

    // Core Compression Algorithm
    async function compressImage(file) {
      currentLoadedFile = file;
      const curTargetKB = getCustomTargetKB();
      if (!curTargetKB) {
        showError('Please enter a valid target size in KB (between 1 and 10000).');
        return;
      }

      const activeTargetBytes = curTargetKB * 1024;
      const activeSuffix = isCustom ? `${curTargetKB}kb` : suffix;
      const originalBytes = file.size;

      // Extract base filename without extension
      const originalBaseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      currentFileName = `${originalBaseName}-${activeSuffix}.jpg`;

      // Check if original is already smaller than target
      if (originalBytes <= activeTargetBytes) {
        currentResultBlob = file;
        showSuccessResult(file, originalBytes, originalBytes, true, curTargetKB, activeTargetBytes);
        return;
      }

      // Load Image
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      try {
        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Invalid image file.'));
          img.src = objectUrl;
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        showError('Could not load image. Please check the file and try again.');
        return;
      }

      URL.revokeObjectURL(objectUrl);

      const naturalWidth = img.naturalWidth || img.width;
      const naturalHeight = img.naturalHeight || img.height;

      if (!naturalWidth || !naturalHeight) {
        showError('Invalid image dimensions.');
        return;
      }

      let bestBlob = null;
      let scale = 1.0;
      const minScale = 0.1;
      const scaleStep = 0.1;

      // Scaling and binary-search quality loop
      while (scale >= minScale) {
        const curWidth = Math.max(1, Math.round(naturalWidth * scale));
        const curHeight = Math.max(1, Math.round(naturalHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = curWidth;
        canvas.height = curHeight;
        const ctx = canvas.getContext('2d');

        // Draw with white background for transparency support
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, curWidth, curHeight);
        ctx.drawImage(img, 0, 0, curWidth, curHeight);

        // Binary search quality from 0.05 to 0.98
        let minQ = 0.05;
        let maxQ = 0.98;
        let scaleBestBlob = null;

        for (let iter = 0; iter < 7; iter++) {
          const midQ = (minQ + maxQ) / 2;
          const blob = await canvasToBlob(canvas, midQ);

          if (!blob) break;

          if (blob.size <= activeTargetBytes) {
            scaleBestBlob = blob;
            minQ = midQ; // Try higher quality to get closer to target
          } else {
            maxQ = midQ; // Reduce quality to fit under target
          }
        }

        // Test lowest quality on this scale if no match yet
        if (!scaleBestBlob) {
          const lowestBlob = await canvasToBlob(canvas, 0.05);
          if (lowestBlob && lowestBlob.size <= activeTargetBytes) {
            scaleBestBlob = lowestBlob;
          }
        }

        if (scaleBestBlob) {
          bestBlob = scaleBestBlob;
          break; // Found optimal combination
        }

        scale -= scaleStep; // Scale down dimensions and retry
      }

      // If even lowest scale is above target, use the smallest generated
      if (!bestBlob) {
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = Math.max(50, Math.round(naturalWidth * 0.1));
        fallbackCanvas.height = Math.max(50, Math.round(naturalHeight * 0.1));
        const fCtx = fallbackCanvas.getContext('2d');
        fCtx.fillStyle = '#FFFFFF';
        fCtx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
        fCtx.drawImage(img, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
        bestBlob = await canvasToBlob(fallbackCanvas, 0.05);
      }

      if (!bestBlob) {
        showError(`This file is too large to shrink to ${curTargetKB} KB. Try a larger size like 100 KB or 200 KB.`);
        return;
      }

      currentResultBlob = bestBlob;
      showSuccessResult(bestBlob, originalBytes, bestBlob.size, false, curTargetKB, activeTargetBytes);
    }

    // Render Success UI
    function showSuccessResult(blob, originalSize, newSize, isAlreadySmaller, activeKB, activeBytes) {
      if (uploadArea) uploadArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.add('is-hidden');
      if (errorArea) errorArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.remove('is-hidden');

      if (previewImg) {
        previewImg.src = URL.createObjectURL(blob);
      }

      if (originalSizeEl) {
        originalSizeEl.textContent = window.formatBytes(originalSize);
      }

      if (compressedSizeEl) {
        compressedSizeEl.textContent = window.formatBytes(newSize);
      }

      if (sizeSavedEl) {
        if (isAlreadySmaller) {
          sizeSavedEl.textContent = 'Already under target';
          sizeSavedEl.style.color = 'var(--primary)';
        } else {
          const savedPct = Math.round(((originalSize - newSize) / originalSize) * 100);
          sizeSavedEl.textContent = `Saved ${Math.max(0, savedPct)}%`;
          sizeSavedEl.style.color = 'var(--success)';
        }
      }

      if (statusNoteEl) {
        if (isAlreadySmaller) {
          statusNoteEl.textContent = `Your image is already ${window.formatBytes(originalSize)}, which is under the ${activeKB} KB target. You can still download it below.`;
          statusNoteEl.classList.remove('is-hidden');
        } else if (newSize > activeBytes) {
          statusNoteEl.textContent = `Compressed to the smallest possible size (${window.formatBytes(newSize)}). For an exact fit under ${activeKB} KB, try our next size up.`;
          statusNoteEl.classList.remove('is-hidden');
        } else {
          statusNoteEl.classList.add('is-hidden');
        }
      }

      setStep(3);
    }

    // Process selected file
    function handleFile(file) {
      if (!file) return;

      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type.toLowerCase()) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
        showError('Please select a valid image file (JPG, JPEG, PNG, or WEBP).');
        return;
      }

      if (errorArea) errorArea.classList.add('is-hidden');
      if (uploadArea) uploadArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.remove('is-hidden');
      setStep(2);

      // Give browser time to paint spinner
      setTimeout(() => {
        compressImage(file).catch(() => {
          showError('An unexpected error occurred while compressing. Please try again.');
        });
      }, 50);
    }

    // Quick size buttons in custom mode
    if (quickSizeBtns && quickSizeBtns.length > 0) {
      quickSizeBtns.forEach((btn) => {
        btn.addEventListener('click', function () {
          const size = this.getAttribute('data-size');
          if (size && customTargetInput) {
            customTargetInput.value = size;
            quickSizeBtns.forEach((b) => b.classList.remove('active'));
            this.classList.add('active');
            if (currentLoadedFile) {
              handleFile(currentLoadedFile);
            }
          }
        });
      });
    }

    if (customTargetInput) {
      customTargetInput.addEventListener('change', function () {
        const val = this.value;
        quickSizeBtns.forEach((b) => {
          b.classList.toggle('active', b.getAttribute('data-size') === val);
        });
        if (currentLoadedFile) {
          handleFile(currentLoadedFile);
        }
      });
    }

    // Attach Event Listeners
    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
          handleFile(e.target.files[0]);
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
          handleFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        if (currentResultBlob) {
          window.downloadBlob(currentResultBlob, currentFileName);
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', resetTool);
    }

    // Initial state
    resetTool();
  };
})();
