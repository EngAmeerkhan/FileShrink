/**
 * FileShrink - Shared Image Editor Engine (js/image-editor.js)
 * High-performance, client-side, zero-dependency canvas image processor.
 * Used across 7 specialized pages via page configuration.
 */

(function () {
  'use strict';

  /* ==========================================================================
     PLATFORM SPECIFICATIONS & CONFIGURATION BLOCK
     All platform sizes and dimension rules are defined below.
     Rule 8: Any platform size or limit in a config block must carry the comment:
     verify against the platform's current guidance
     ========================================================================== */
  const PLATFORM_CONFIG = {
    youtube: {
      /* verify against the platform's current guidance */
      recommendedWidth: 1280,
      recommendedHeight: 720,
      aspectRatio: 16 / 9,
      minWidth: 640,
      outputSuffix: 'youtube',
      label: 'YouTube Thumbnail (1280 × 720 px, 16:9)',
      guidanceNote: 'Recommended size: 1280 × 720 px (16:9 aspect ratio, minimum width 640 px)'
    },
    instagram: {
      /* verify against the platform's current guidance */
      profileSizes: [320, 640, 1080],
      defaultProfileSize: 640,
      outputSuffix: 'profile',
      label: 'Instagram Profile Picture (640 × 640 px)',
      postPresets: [
        /* verify against the platform's current guidance */
        { id: 'profile', name: 'Profile Avatar', width: 640, height: 640, aspect: 1, isCircle: true },
        { id: 'square', name: 'Square Post (1:1)', width: 1080, height: 1080, aspect: 1, isCircle: false },
        { id: 'portrait', name: 'Portrait Post (4:5)', width: 1080, height: 1350, aspect: 4 / 5, isCircle: false },
        { id: 'landscape', name: 'Landscape Post (1.91:1)', width: 1080, height: 566, aspect: 1.91, isCircle: false }
      ]
    },
    whatsapp: {
      /* verify against the platform's current guidance */
      defaultDpSize: 640,
      outputSuffix: 'dp',
      label: 'WhatsApp DP (640 × 640 px)',
      statusPreset: {
        /* verify against the platform's current guidance */
        width: 1080,
        height: 1920,
        aspect: 9 / 16,
        label: 'Status Story (1080 × 1920 px, 9:16)'
      }
    },
    square: {
      /* verify against the platform's current guidance */
      outputSuffix: 'square',
      presetSizes: ['original', 1080, 2048]
    },
    border: {
      /* verify against the platform's current guidance */
      outputSuffix: 'border',
      minBorderPx: 0,
      maxBorderPx: 300,
      defaultBorderPx: 50,
      defaultColor: '#ffffff'
    },
    bw: {
      /* verify against the platform's current guidance */
      outputSuffix: 'bw',
      luminanceWeights: { r: 0.2126, g: 0.7152, b: 0.0722 }
    },
    blur: {
      /* verify against the platform's current guidance */
      outputSuffix: 'blur',
      defaultStrength: 15,
      maxStrength: 50
    }
  };

  /**
   * Parse EXIF orientation from JPEG byte buffer
   * Returns orientation number (1 to 8), or 1 if none found.
   */
  function getExifOrientation(arrayBuffer) {
    try {
      const view = new DataView(arrayBuffer);
      if (view.getUint16(0, false) !== 0xFFD8) return 1; // Not a JPEG
      const length = view.byteLength;
      let offset = 2;

      while (offset < length) {
        if (view.getUint16(offset + 2, false) <= 8) return 1;
        const marker = view.getUint16(offset, false);
        offset += 2;
        if (marker === 0xFFE1) {
          // APP1 Marker
          if (view.getUint32(offset += 2, false) !== 0x45786966) return 1; // Not "Exif"
          const littleEndian = view.getUint16(offset += 6, false) === 0x4949;
          offset += view.getUint32(offset + 4, littleEndian);
          const tags = view.getUint16(offset, littleEndian);
          offset += 2;
          for (let i = 0; i < tags; i++) {
            if (view.getUint16(offset + (i * 12), littleEndian) === 0x0112) {
              return view.getUint16(offset + (i * 12) + 8, littleEndian);
            }
          }
        } else if ((marker & 0xFF00) !== 0xFF00) {
          break;
        } else {
          offset += view.getUint16(offset, false);
        }
      }
    } catch (e) {
      // Ignore EXIF parsing error, default to normal orientation
    }
    return 1;
  }

  /**
   * Fast, edge-clamped 3-pass Box Blur in Pure JavaScript
   * Mathematical equivalent of Gaussian blur without dark border artifacts.
   * Does NOT use ctx.filter (which has inconsistent browser support).
   */
  function applyBoxBlur(imageData, radius) {
    const r = Math.round(radius);
    if (r <= 0) return imageData;

    const width = imageData.width;
    const height = imageData.height;
    const pixels = imageData.data;
    const totalPixels = width * height;

    // Temporary buffers for red, green, blue, alpha
    const srcR = new Uint8ClampedArray(totalPixels);
    const srcG = new Uint8ClampedArray(totalPixels);
    const srcB = new Uint8ClampedArray(totalPixels);
    const srcA = new Uint8ClampedArray(totalPixels);

    const dstR = new Uint8ClampedArray(totalPixels);
    const dstG = new Uint8ClampedArray(totalPixels);
    const dstB = new Uint8ClampedArray(totalPixels);
    const dstA = new Uint8ClampedArray(totalPixels);

    for (let i = 0, p = 0; i < totalPixels; i++, p += 4) {
      srcR[i] = pixels[p];
      srcG[i] = pixels[p + 1];
      srcB[i] = pixels[p + 2];
      srcA[i] = pixels[p + 3];
    }

    // Perform 3-pass box blur for smooth Gaussian approximation
    for (let pass = 0; pass < 3; pass++) {
      // Horizontal pass
      boxBlurHorizontal(srcR, dstR, width, height, r);
      boxBlurHorizontal(srcG, dstG, width, height, r);
      boxBlurHorizontal(srcB, dstB, width, height, r);
      boxBlurHorizontal(srcA, dstA, width, height, r);

      // Vertical pass
      boxBlurVertical(dstR, srcR, width, height, r);
      boxBlurVertical(dstG, srcG, width, height, r);
      boxBlurVertical(dstB, srcB, width, height, r);
      boxBlurVertical(dstA, srcA, width, height, r);
    }

    for (let i = 0, p = 0; i < totalPixels; i++, p += 4) {
      pixels[p] = srcR[i];
      pixels[p + 1] = srcG[i];
      pixels[p + 2] = srcB[i];
      pixels[p + 3] = srcA[i];
    }

    return imageData;
  }

  function boxBlurHorizontal(scl, tcl, w, h, r) {
    const iarr = 1 / (r + r + 1);
    for (let i = 0; i < h; i++) {
      let ti = i * w;
      let li = ti;
      let ri = ti + r;
      const fv = scl[ti]; // First pixel value (clamped edge)
      const lv = scl[ti + w - 1]; // Last pixel value (clamped edge)
      let val = (r + 1) * fv;

      for (let j = 0; j < r; j++) val += scl[ti + Math.min(j, w - 1)];
      for (let j = 0; j <= r; j++) {
        val += (ri < ti + w ? scl[ri++] : lv) - fv;
        tcl[ti++] = Math.round(val * iarr);
      }
      for (let j = r + 1; j < w - r; j++) {
        val += scl[ri++] - scl[li++];
        tcl[ti++] = Math.round(val * iarr);
      }
      for (let j = w - r; j < w; j++) {
        val += lv - (li < ti ? scl[li++] : fv);
        tcl[ti++] = Math.round(val * iarr);
      }
    }
  }

  function boxBlurVertical(scl, tcl, w, h, r) {
    const iarr = 1 / (r + r + 1);
    for (let i = 0; i < w; i++) {
      let ti = i;
      let li = ti;
      let ri = ti + r * w;
      const fv = scl[ti];
      const lv = scl[ti + w * (h - 1)];
      let val = (r + 1) * fv;

      for (let j = 0; j < r; j++) val += scl[ti + Math.min(j, h - 1) * w];
      for (let j = 0; j <= r; j++) {
        val += (ri < w * h ? scl[ri] : lv) - fv;
        tcl[ti] = Math.round(val * iarr);
        ri += w;
        ti += w;
      }
      for (let j = r + 1; j < h - r; j++) {
        val += scl[ri] - scl[li];
        tcl[ti] = Math.round(val * iarr);
        li += w;
        ri += w;
        ti += w;
      }
      for (let j = h - r; j < h; j++) {
        val += lv - scl[li];
        tcl[ti] = Math.round(val * iarr);
        li += w;
        ti += w;
      }
    }
  }

  /**
   * Main Image Editor Initialization
   */
  window.initImageEditor = function (pageConfig) {
    const mode = pageConfig.mode || 'youtube'; // 'youtube', 'instagram', 'whatsapp', 'square', 'border', 'bw', 'blur'
    const platformDefaults = PLATFORM_CONFIG[mode] || {};

    // DOM Elements - Steps & Sections
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const uploadArea = document.getElementById('uploadArea');
    const editorArea = document.getElementById('editorArea');
    const resultArea = document.getElementById('resultArea');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const errorArea = document.getElementById('errorArea');
    const errorMessage = document.getElementById('errorMessage');
    const warningNotice = document.getElementById('warningNotice');

    // Canvas Viewport & Layers
    const editorCanvas = document.getElementById('editorCanvas');
    const ctx = editorCanvas ? editorCanvas.getContext('2d', { willReadFrequently: true }) : null;
    const cropOverlay = document.getElementById('cropOverlay');

    // Controls Toolbar & Buttons
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const zoomSlider = document.getElementById('zoomSlider');
    const zoomValueBadge = document.getElementById('zoomValueBadge');
    const resetPositionBtn = document.getElementById('resetPositionBtn');
    const doneEditingBtn = document.getElementById('doneEditingBtn');
    const startAgainBtn = document.getElementById('startAgainBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    // Output options
    const formatSelect = document.getElementById('formatSelect');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValBadge = document.getElementById('qualityValBadge');
    const keepKbToggle = document.getElementById('keepKbToggle');
    const keepKbControls = document.getElementById('keepKbControls');
    const customKbInput = document.getElementById('customKbInput');
    const quickKbBtns = document.querySelectorAll('.quick-kb-btn');

    // Result & Stats Elements
    const originalDimsEl = document.getElementById('originalDims');
    const originalSizeEl = document.getElementById('originalSize');
    const finalDimsEl = document.getElementById('finalDims');
    const finalSizeEl = document.getElementById('finalSize');
    const resultPreviewImg = document.getElementById('resultPreviewImg');

    // Working State
    let masterImage = null; // Master upright image (HTMLImageElement or ImageBitmap)
    let originalFile = null;
    let originalFileName = '';
    let originalBaseName = 'image';
    let originalSizeBytes = 0;
    let masterWidth = 0;
    let masterHeight = 0;
    let wasDownscaledFrom6000 = false;

    // Viewport Pan / Zoom State
    let zoomLevel = 1.0;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialTouchDistance = 0;

    // Target Output Configuration
    let outputWidth = platformDefaults.recommendedWidth || 1280;
    let outputHeight = platformDefaults.recommendedHeight || 720;
    let outputAspect = platformDefaults.aspectRatio || (16 / 9);
    let outputSuffix = platformDefaults.outputSuffix || mode;

    // Mode-specific configurations
    let fitWholeImage = false; // YouTube & WhatsApp
    let backgroundType = 'blur'; // 'blur', 'white', 'black', 'custom'
    let customBgColor = '#ffffff';
    let isCircularMask = (mode === 'instagram' || mode === 'whatsapp');

    // Border tool state
    let borderPx = platformDefaults.defaultBorderPx || 50;
    let borderIsPercent = false;
    let borderColor = platformDefaults.defaultColor || '#ffffff';
    let borderMakeSquare = false;
    let borderKeepOriginalSize = false;

    // Square tool state
    let squareMode = 'background'; // 'background' or 'crop'
    let squareSizePreset = 'original'; // 'original', 1080, 2048

    // Black & White tool state
    let bwBrightness = 0; // -100 to 100
    let bwContrast = 0;   // -100 to 100
    let bwThresholdMode = false;
    let bwThresholdVal = 128;

    // Blur tool state
    let blurMode = 'whole'; // 'whole' or 'area'
    let blurStrength = platformDefaults.defaultStrength || 15;
    let blurShapes = []; // Array of { type: 'rect'|'ellipse', x, y, w, h }
    let isDrawingArea = false;
    let currentShape = null;

    // Final Blob & URL
    let generatedBlob = null;
    let generatedBlobUrl = null;

    /**
     * Update Step Visual Indicators
     */
    function setStep(step) {
      if (step1) step1.className = 'step-item' + (step === 1 ? ' active' : (step > 1 ? ' completed' : ''));
      if (step2) step2.className = 'step-item' + (step === 2 ? ' active' : (step > 2 ? ' completed' : ''));
      if (step3) step3.className = 'step-item' + (step === 3 ? ' active' : '');
    }

    /**
     * Display Friendly Error
     */
    function showError(msg) {
      if (errorArea) {
        errorArea.classList.remove('is-hidden');
        if (errorMessage) errorMessage.innerHTML = msg;
      }
    }

    function clearError() {
      if (errorArea) errorArea.classList.add('is-hidden');
    }

    /**
     * Fully Reset Tool State
     */
    function resetAll() {
      if (fileInput) fileInput.value = '';
      if (generatedBlobUrl) {
        URL.revokeObjectURL(generatedBlobUrl);
        generatedBlobUrl = null;
      }
      masterImage = null;
      originalFile = null;
      originalFileName = '';
      originalBaseName = 'image';
      originalSizeBytes = 0;
      wasDownscaledFrom6000 = false;
      zoomLevel = 1.0;
      panX = 0;
      panY = 0;
      blurShapes = [];
      generatedBlob = null;

      if (warningNotice) warningNotice.classList.add('is-hidden');
      clearError();
      if (uploadArea) uploadArea.classList.remove('is-hidden');
      if (editorArea) editorArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.add('is-hidden');
      setStep(1);
    }

    if (startAgainBtn) {
      startAgainBtn.addEventListener('click', resetAll);
    }

    /**
     * Load image file and handle EXIF + 6000px guard
     */
    async function handleFile(file) {
      clearError();
      if (!file) return;

      // Check for HEIC / HEIF
      const fileNameLower = file.name.toLowerCase();
      const isHeic = fileNameLower.endsWith('.heic') || fileNameLower.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';
      if (isHeic) {
        showError('HEIC photos from iPhones are not directly readable by web browsers. Please convert your photo to JPG first using our free <a href="/heic-to-jpg/" style="text-decoration:underline; font-weight:700;">HEIC to JPG converter</a>, then edit it here.');
        return;
      }

      // Check valid file types
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!validTypes.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(fileNameLower)) {
        showError('Please upload a valid JPG, PNG, or WebP image.');
        return;
      }

      originalFile = file;
      originalFileName = file.name;
      originalBaseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'image';
      originalSizeBytes = file.size;

      try {
        const buffer = await file.arrayBuffer();
        const orientation = getExifOrientation(buffer);

        // Load to HTMLImageElement
        const blobUrl = URL.createObjectURL(file);
        const tempImg = new Image();

        await new Promise((resolve, reject) => {
          tempImg.onload = resolve;
          tempImg.onerror = () => reject(new Error('Failed to decode image.'));
          tempImg.src = blobUrl;
        });
        URL.revokeObjectURL(blobUrl);

        let naturalW = tempImg.naturalWidth || tempImg.width;
        let naturalH = tempImg.naturalHeight || tempImg.height;

        // Apply EXIF rotation to a normalized canvas
        let rotatedW = (orientation === 6 || orientation === 8) ? naturalH : naturalW;
        let rotatedH = (orientation === 6 || orientation === 8) ? naturalW : naturalH;

        // 6000 px Downscale Guard
        wasDownscaledFrom6000 = false;
        let finalNormW = rotatedW;
        let finalNormH = rotatedH;
        const maxDimension = Math.max(rotatedW, rotatedH);

        if (maxDimension > 6000) {
          const downscaleRatio = 6000 / maxDimension;
          finalNormW = Math.round(rotatedW * downscaleRatio);
          finalNormH = Math.round(rotatedH * downscaleRatio);
          wasDownscaledFrom6000 = true;
        }

        const normCanvas = document.createElement('canvas');
        normCanvas.width = finalNormW;
        normCanvas.height = finalNormH;
        const nCtx = normCanvas.getContext('2d');

        // Apply EXIF transforms
        nCtx.save();
        if (wasDownscaledFrom6000) {
          const ratio = 6000 / maxDimension;
          nCtx.scale(ratio, ratio);
        }

        switch (orientation) {
          case 2: // Horizontal flip
            nCtx.translate(naturalW, 0);
            nCtx.scale(-1, 1);
            break;
          case 3: // 180 rotate
            nCtx.translate(naturalW, naturalH);
            nCtx.rotate(Math.PI);
            break;
          case 4: // Vertical flip
            nCtx.translate(0, naturalH);
            nCtx.scale(1, -1);
            break;
          case 5: // Vertical flip + 90 rotate
            nCtx.rotate(0.5 * Math.PI);
            nCtx.scale(1, -1);
            break;
          case 6: // 90 rotate CW
            nCtx.translate(naturalH, 0);
            nCtx.rotate(0.5 * Math.PI);
            break;
          case 7: // Horizontal flip + 90 rotate
            nCtx.rotate(0.5 * Math.PI);
            nCtx.translate(naturalW, -naturalH);
            nCtx.scale(-1, 1);
            break;
          case 8: // 270 rotate CW (90 CCW)
            nCtx.translate(0, naturalW);
            nCtx.rotate(-0.5 * Math.PI);
            break;
          default:
            break;
        }

        nCtx.drawImage(tempImg, 0, 0);
        nCtx.restore();

        masterImage = normCanvas;
        masterWidth = finalNormW;
        masterHeight = finalNormH;

        // Initialize editor state and display warning if downscaled
        if (warningNotice) {
          if (wasDownscaledFrom6000) {
            warningNotice.textContent = 'Your photo was larger than 6000 px. It has been automatically resized to 6000 px to keep your browser fast.';
            warningNotice.classList.remove('is-hidden');
          } else {
            warningNotice.classList.add('is-hidden');
          }
        }

        initializeEditorForMode();
        if (uploadArea) uploadArea.classList.add('is-hidden');
        if (editorArea) editorArea.classList.remove('is-hidden');
        setStep(2);

        renderEditorPreview();
      } catch (err) {
        showError('Could not process this image file. Please try another image.');
      }
    }

    /**
     * Configure default dimensions for active mode
     */
    function initializeEditorForMode() {
      zoomLevel = 1.0;
      panX = 0;
      panY = 0;
      blurShapes = [];

      if (mode === 'youtube') {
        outputWidth = 1280;
        outputHeight = 720;
        outputAspect = 16 / 9;
        isCircularMask = false;
      } else if (mode === 'instagram') {
        outputWidth = 640;
        outputHeight = 640;
        outputAspect = 1;
        isCircularMask = true;
      } else if (mode === 'whatsapp') {
        outputWidth = 640;
        outputHeight = 640;
        outputAspect = 1;
        isCircularMask = true;
      } else if (mode === 'square') {
        outputWidth = Math.max(masterWidth, masterHeight);
        outputHeight = outputWidth;
        outputAspect = 1;
        isCircularMask = false;
      } else if (mode === 'border') {
        isCircularMask = false;
      } else if (mode === 'bw' || mode === 'blur') {
        outputWidth = masterWidth;
        outputHeight = masterHeight;
        outputAspect = masterWidth / masterHeight;
        isCircularMask = false;
      }
    }

    /**
     * Render Interactive Editor Canvas Preview
     */
    function renderEditorPreview() {
      if (!ctx || !masterImage) return;

      // Handle mode-specific rendering
      if (mode === 'youtube') {
        renderYouTubePreview();
      } else if (mode === 'instagram') {
        renderInstagramPreview();
      } else if (mode === 'whatsapp') {
        renderWhatsAppPreview();
      } else if (mode === 'square') {
        renderSquarePreview();
      } else if (mode === 'border') {
        renderBorderPreview();
      } else if (mode === 'bw') {
        renderBwPreview();
      } else if (mode === 'blur') {
        renderBlurPreview();
      }
    }

    /**
     * Mode 1: YouTube Thumbnail Preview
     */
    function renderYouTubePreview() {
      editorCanvas.width = outputWidth;
      editorCanvas.height = outputHeight;

      if (fitWholeImage) {
        drawLetterboxBackground(ctx, outputWidth, outputHeight);
        // Draw image fitted inside 1280x720
        const scale = Math.min(outputWidth / masterWidth, outputHeight / masterHeight) * zoomLevel;
        const dw = masterWidth * scale;
        const dh = masterHeight * scale;
        const dx = (outputWidth - dw) / 2 + panX;
        const dy = (outputHeight - dh) / 2 + panY;
        ctx.drawImage(masterImage, dx, dy, dw, dh);
      } else {
        // Crop & Fill mode with Pan and Zoom
        const baseScale = Math.max(outputWidth / masterWidth, outputHeight / masterHeight);
        const scale = baseScale * zoomLevel;
        const dw = masterWidth * scale;
        const dh = masterHeight * scale;
        const dx = (outputWidth - dw) / 2 + panX;
        const dy = (outputHeight - dh) / 2 + panY;
        ctx.drawImage(masterImage, dx, dy, dw, dh);
      }
    }

    /**
     * Mode 2: Instagram Profile & Post Preview
     */
    function renderInstagramPreview() {
      editorCanvas.width = outputWidth;
      editorCanvas.height = outputHeight;

      const baseScale = Math.max(outputWidth / masterWidth, outputHeight / masterHeight);
      const scale = baseScale * zoomLevel;
      const dw = masterWidth * scale;
      const dh = masterHeight * scale;
      const dx = (outputWidth - dw) / 2 + panX;
      const dy = (outputHeight - dh) / 2 + panY;

      ctx.drawImage(masterImage, dx, dy, dw, dh);

      // Draw circular overlay preview mask if avatar mode
      if (isCircularMask) {
        drawCircleMaskOverlay(ctx, outputWidth, outputHeight);
      }
    }

    /**
     * Mode 3: WhatsApp DP & Status Preview
     */
    function renderWhatsAppPreview() {
      editorCanvas.width = outputWidth;
      editorCanvas.height = outputHeight;

      if (fitWholeImage) {
        drawLetterboxBackground(ctx, outputWidth, outputHeight);
        const scale = Math.min(outputWidth / masterWidth, outputHeight / masterHeight) * zoomLevel;
        const dw = masterWidth * scale;
        const dh = masterHeight * scale;
        const dx = (outputWidth - dw) / 2 + panX;
        const dy = (outputHeight - dh) / 2 + panY;
        ctx.drawImage(masterImage, dx, dy, dw, dh);
      } else {
        const baseScale = Math.max(outputWidth / masterWidth, outputHeight / masterHeight);
        const scale = baseScale * zoomLevel;
        const dw = masterWidth * scale;
        const dh = masterHeight * scale;
        const dx = (outputWidth - dw) / 2 + panX;
        const dy = (outputHeight - dh) / 2 + panY;
        ctx.drawImage(masterImage, dx, dy, dw, dh);
      }

      if (isCircularMask) {
        drawCircleMaskOverlay(ctx, outputWidth, outputHeight);
      }
    }

    /**
     * Mode 4: Make Photo Square Preview
     */
    function renderSquarePreview() {
      let targetSize = masterWidth >= masterHeight ? masterWidth : masterHeight;
      if (squareSizePreset === 1080) targetSize = 1080;
      else if (squareSizePreset === 2048) targetSize = 2048;

      editorCanvas.width = targetSize;
      editorCanvas.height = targetSize;

      if (squareMode === 'background') {
        drawLetterboxBackground(ctx, targetSize, targetSize);
        const scale = Math.min(targetSize / masterWidth, targetSize / masterHeight);
        const dw = masterWidth * scale;
        const dh = masterHeight * scale;
        const dx = (targetSize - dw) / 2;
        const dy = (targetSize - dh) / 2;
        ctx.drawImage(masterImage, dx, dy, dw, dh);
      } else {
        // Crop to square
        const baseScale = Math.max(targetSize / masterWidth, targetSize / masterHeight);
        const scale = baseScale * zoomLevel;
        const dw = masterWidth * scale;
        const dh = masterHeight * scale;
        const dx = (targetSize - dw) / 2 + panX;
        const dy = (targetSize - dh) / 2 + panY;
        ctx.drawImage(masterImage, dx, dy, dw, dh);
      }
    }

    /**
     * Mode 5: Add White Border Preview
     */
    function renderBorderPreview() {
      let bp = borderPx;
      if (borderIsPercent) {
        bp = Math.round(Math.max(masterWidth, masterHeight) * (borderPx / 100));
      }

      let targetW, targetH, imgW, imgH, imgX, imgY;

      if (borderKeepOriginalSize) {
        targetW = masterWidth;
        targetH = masterHeight;
        const scale = Math.min((targetW - 2 * bp) / masterWidth, (targetH - 2 * bp) / masterHeight);
        imgW = Math.max(1, Math.round(masterWidth * scale));
        imgH = Math.max(1, Math.round(masterHeight * scale));
        imgX = Math.round((targetW - imgW) / 2);
        imgY = Math.round((targetH - imgH) / 2);
      } else if (borderMakeSquare) {
        const sideWithBorder = Math.max(masterWidth + 2 * bp, masterHeight + 2 * bp);
        targetW = sideWithBorder;
        targetH = sideWithBorder;
        imgW = masterWidth;
        imgH = masterHeight;
        imgX = Math.round((targetW - imgW) / 2);
        imgY = Math.round((targetH - imgH) / 2);
      } else {
        targetW = masterWidth + 2 * bp;
        targetH = masterHeight + 2 * bp;
        imgW = masterWidth;
        imgH = masterHeight;
        imgX = bp;
        imgY = bp;
      }

      editorCanvas.width = targetW;
      editorCanvas.height = targetH;

      ctx.fillStyle = borderColor;
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(masterImage, imgX, imgY, imgW, imgH);
    }

    /**
     * Mode 6: Black & White Grayscale Preview
     */
    function renderBwPreview() {
      // Downscale preview for responsiveness if master image is large
      const maxPrevDim = 800;
      let prevScale = 1.0;
      if (Math.max(masterWidth, masterHeight) > maxPrevDim) {
        prevScale = maxPrevDim / Math.max(masterWidth, masterHeight);
      }

      const pw = Math.round(masterWidth * prevScale);
      const ph = Math.round(masterHeight * prevScale);

      editorCanvas.width = pw;
      editorCanvas.height = ph;

      ctx.drawImage(masterImage, 0, 0, pw, ph);
      const imgData = ctx.getImageData(0, 0, pw, ph);
      applyBwFilterToImageData(imgData, bwBrightness, bwContrast, bwThresholdMode, bwThresholdVal);
      ctx.putImageData(imgData, 0, 0);
    }

    /**
     * Core B&W Filter implementation
     */
    function applyBwFilterToImageData(imgData, brightness, contrast, isThreshold, threshVal) {
      const data = imgData.data;
      const len = data.length;
      const weights = PLATFORM_CONFIG.bw.luminanceWeights; // { r: 0.2126, g: 0.7152, b: 0.0722 }

      // Contrast factor calculation
      const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      const bOffset = brightness * 2.55;

      for (let i = 0; i < len; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a === 0) continue; // Keep transparent

        // Standard ITU-R BT.709 luminance calculation
        let lum = weights.r * r + weights.g * g + weights.b * b;

        // Apply contrast and brightness if set
        if (contrast !== 0) {
          lum = cFactor * (lum - 128) + 128;
        }
        if (brightness !== 0) {
          lum += bOffset;
        }

        let finalVal = Math.round(lum);
        if (finalVal < 0) finalVal = 0;
        if (finalVal > 255) finalVal = 255;

        // High contrast threshold mode
        if (isThreshold) {
          finalVal = finalVal >= threshVal ? 255 : 0;
        }

        data[i] = finalVal;
        data[i + 1] = finalVal;
        data[i + 2] = finalVal;
        // Keep alpha channel for PNG
      }
    }

    /**
     * Mode 7: Blur Image Preview
     */
    function renderBlurPreview() {
      // Downscale for silky smooth interaction on large images
      const maxPrevDim = 900;
      let prevScale = 1.0;
      if (Math.max(masterWidth, masterHeight) > maxPrevDim) {
        prevScale = maxPrevDim / Math.max(masterWidth, masterHeight);
      }

      const pw = Math.round(masterWidth * prevScale);
      const ph = Math.round(masterHeight * prevScale);

      editorCanvas.width = pw;
      editorCanvas.height = ph;

      ctx.drawImage(masterImage, 0, 0, pw, ph);

      if (blurStrength > 0) {
        const origImageData = ctx.getImageData(0, 0, pw, ph);

        // Create blurred copy using Box Blur
        const blurCopyCanvas = document.createElement('canvas');
        blurCopyCanvas.width = pw;
        blurCopyCanvas.height = ph;
        const bCtx = blurCopyCanvas.getContext('2d', { willReadFrequently: true });
        bCtx.drawImage(masterImage, 0, 0, pw, ph);
        const blurImageData = bCtx.getImageData(0, 0, pw, ph);
        applyBoxBlur(blurImageData, blurStrength * prevScale);

        if (blurMode === 'whole') {
          ctx.putImageData(blurImageData, 0, 0);
        } else {
          // Blur an area mode: only pixels inside drawn shapes get blurred
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = pw;
          maskCanvas.height = ph;
          const mCtx = maskCanvas.getContext('2d');
          mCtx.fillStyle = '#ffffff';

          blurShapes.forEach(shape => {
            const sx = shape.x * prevScale;
            const sy = shape.y * prevScale;
            const sw = shape.w * prevScale;
            const sh = shape.h * prevScale;

            mCtx.beginPath();
            if (shape.type === 'ellipse') {
              const rx = Math.abs(sw / 2);
              const ry = Math.abs(sh / 2);
              const cx = sx + sw / 2;
              const cy = sy + sh / 2;
              mCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            } else {
              mCtx.rect(sx, sy, sw, sh);
            }
            mCtx.fill();
          });

          // Draw live shape being dragged right now
          if (currentShape) {
            const sx = currentShape.x * prevScale;
            const sy = currentShape.y * prevScale;
            const sw = currentShape.w * prevScale;
            const sh = currentShape.h * prevScale;
            mCtx.beginPath();
            if (currentShape.type === 'ellipse') {
              mCtx.ellipse(sx + sw / 2, sy + sh / 2, Math.abs(sw / 2), Math.abs(sh / 2), 0, 0, Math.PI * 2);
            } else {
              mCtx.rect(sx, sy, sw, sh);
            }
            mCtx.fill();
          }

          const maskData = mCtx.getImageData(0, 0, pw, ph).data;
          const oData = origImageData.data;
          const bData = blurImageData.data;
          const len = oData.length;

          for (let i = 0; i < len; i += 4) {
            if (maskData[i + 3] > 128) {
              oData[i] = bData[i];
              oData[i + 1] = bData[i + 1];
              oData[i + 2] = bData[i + 2];
              oData[i + 3] = bData[i + 3];
            }
          }
          ctx.putImageData(origImageData, 0, 0);

          // Draw outline guides around blur areas
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          blurShapes.forEach(shape => {
            const sx = shape.x * prevScale;
            const sy = shape.y * prevScale;
            const sw = shape.w * prevScale;
            const sh = shape.h * prevScale;
            ctx.beginPath();
            if (shape.type === 'ellipse') {
              ctx.ellipse(sx + sw / 2, sy + sh / 2, Math.abs(sw / 2), Math.abs(sh / 2), 0, 0, Math.PI * 2);
            } else {
              ctx.strokeRect(sx, sy, sw, sh);
            }
            ctx.stroke();
          });

          if (currentShape) {
            const sx = currentShape.x * prevScale;
            const sy = currentShape.y * prevScale;
            const sw = currentShape.w * prevScale;
            const sh = currentShape.h * prevScale;
            ctx.beginPath();
            ctx.strokeStyle = '#3b82f6';
            if (currentShape.type === 'ellipse') {
              ctx.ellipse(sx + sw / 2, sy + sh / 2, Math.abs(sw / 2), Math.abs(sh / 2), 0, 0, Math.PI * 2);
            } else {
              ctx.strokeRect(sx, sy, sw, sh);
            }
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }
      }
    }

    /**
     * Letterbox Background Drawing (Blur, White, Black, Custom)
     */
    function drawLetterboxBackground(targetCtx, w, h) {
      if (backgroundType === 'blur') {
        const bgCanvas = document.createElement('canvas');
        const bgW = 160;
        const bgH = Math.round(160 * (h / w));
        bgCanvas.width = bgW;
        bgCanvas.height = bgH;
        const bCtx = bgCanvas.getContext('2d', { willReadFrequently: true });

        bCtx.fillStyle = '#ffffff';
        bCtx.fillRect(0, 0, bgW, bgH);

        // Draw image scaled to cover background
        const bgScale = Math.max(bgW / masterWidth, bgH / masterHeight);
        const bdw = masterWidth * bgScale;
        const bdh = masterHeight * bgScale;
        bCtx.drawImage(masterImage, (bgW - bdw) / 2, (bgH - bdh) / 2, bdw, bdh);

        const imgData = bCtx.getImageData(0, 0, bgW, bgH);
        applyBoxBlur(imgData, 12);
        bCtx.putImageData(imgData, 0, 0);

        targetCtx.drawImage(bgCanvas, 0, 0, w, h);
      } else {
        let fill = '#ffffff';
        if (backgroundType === 'black') fill = '#000000';
        else if (backgroundType === 'custom') fill = customBgColor;
        targetCtx.fillStyle = fill;
        targetCtx.fillRect(0, 0, w, h);
      }
    }

    /**
     * Circular Mask Overlay for Profile / DP Previews
     */
    function drawCircleMaskOverlay(targetCtx, w, h) {
      targetCtx.save();
      const radius = Math.min(w, h) / 2;
      const cx = w / 2;
      const cy = h / 2;

      // Darken outside circle
      targetCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      targetCtx.beginPath();
      targetCtx.rect(0, 0, w, h);
      targetCtx.arc(cx, cy, radius, 0, Math.PI * 2, true);
      targetCtx.fill();

      // Thin white ring around circle border
      targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      targetCtx.lineWidth = 2;
      targetCtx.beginPath();
      targetCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      targetCtx.stroke();
      targetCtx.restore();
    }

    /**
     * Full-Resolution Final Render for Export
     */
    async function renderFullResolutionCanvas() {
      const exportCanvas = document.createElement('canvas');
      const eCtx = exportCanvas.getContext('2d', { willReadFrequently: true });

      if (mode === 'youtube') {
        exportCanvas.width = 1280;
        exportCanvas.height = 720;
        if (fitWholeImage) {
          drawLetterboxBackground(eCtx, 1280, 720);
          const scale = Math.min(1280 / masterWidth, 720 / masterHeight) * zoomLevel;
          const dw = masterWidth * scale;
          const dh = masterHeight * scale;
          const dx = (1280 - dw) / 2 + panX;
          const dy = (720 - dh) / 2 + panY;
          eCtx.drawImage(masterImage, dx, dy, dw, dh);
        } else {
          const baseScale = Math.max(1280 / masterWidth, 720 / masterHeight);
          const scale = baseScale * zoomLevel;
          const dw = masterWidth * scale;
          const dh = masterHeight * scale;
          const dx = (1280 - dw) / 2 + panX;
          const dy = (720 - dh) / 2 + panY;
          eCtx.drawImage(masterImage, dx, dy, dw, dh);
        }
      } else if (mode === 'instagram') {
        exportCanvas.width = outputWidth;
        exportCanvas.height = outputHeight;
        const baseScale = Math.max(outputWidth / masterWidth, outputHeight / masterHeight);
        const scale = baseScale * zoomLevel;
        const dw = masterWidth * scale;
        const dh = masterHeight * scale;
        const dx = (outputWidth - dw) / 2 + panX;
        const dy = (outputHeight - dh) / 2 + panY;
        eCtx.drawImage(masterImage, dx, dy, dw, dh);
      } else if (mode === 'whatsapp') {
        exportCanvas.width = outputWidth;
        exportCanvas.height = outputHeight;
        if (fitWholeImage) {
          drawLetterboxBackground(eCtx, outputWidth, outputHeight);
          const scale = Math.min(outputWidth / masterWidth, outputHeight / masterHeight) * zoomLevel;
          const dw = masterWidth * scale;
          const dh = masterHeight * scale;
          const dx = (outputWidth - dw) / 2 + panX;
          const dy = (outputHeight - dh) / 2 + panY;
          eCtx.drawImage(masterImage, dx, dy, dw, dh);
        } else {
          const baseScale = Math.max(outputWidth / masterWidth, outputHeight / masterHeight);
          const scale = baseScale * zoomLevel;
          const dw = masterWidth * scale;
          const dh = masterHeight * scale;
          const dx = (outputWidth - dw) / 2 + panX;
          const dy = (outputHeight - dh) / 2 + panY;
          eCtx.drawImage(masterImage, dx, dy, dw, dh);
        }
      } else if (mode === 'square') {
        let targetSize = masterWidth >= masterHeight ? masterWidth : masterHeight;
        if (squareSizePreset === 1080) targetSize = 1080;
        else if (squareSizePreset === 2048) targetSize = 2048;

        exportCanvas.width = targetSize;
        exportCanvas.height = targetSize;

        if (squareMode === 'background') {
          drawLetterboxBackground(eCtx, targetSize, targetSize);
          const scale = Math.min(targetSize / masterWidth, targetSize / masterHeight);
          const dw = masterWidth * scale;
          const dh = masterHeight * scale;
          const dx = (targetSize - dw) / 2;
          const dy = (targetSize - dh) / 2;
          eCtx.drawImage(masterImage, dx, dy, dw, dh);
        } else {
          const baseScale = Math.max(targetSize / masterWidth, targetSize / masterHeight);
          const scale = baseScale * zoomLevel;
          const dw = masterWidth * scale;
          const dh = masterHeight * scale;
          const dx = (targetSize - dw) / 2 + panX;
          const dy = (targetSize - dh) / 2 + panY;
          eCtx.drawImage(masterImage, dx, dy, dw, dh);
        }
      } else if (mode === 'border') {
        let bp = borderPx;
        if (borderIsPercent) {
          bp = Math.round(Math.max(masterWidth, masterHeight) * (borderPx / 100));
        }

        let targetW, targetH, imgW, imgH, imgX, imgY;

        if (borderKeepOriginalSize) {
          targetW = masterWidth;
          targetH = masterHeight;
          const scale = Math.min((targetW - 2 * bp) / masterWidth, (targetH - 2 * bp) / masterHeight);
          imgW = Math.max(1, Math.round(masterWidth * scale));
          imgH = Math.max(1, Math.round(masterHeight * scale));
          imgX = Math.round((targetW - imgW) / 2);
          imgY = Math.round((targetH - imgH) / 2);
        } else if (borderMakeSquare) {
          const sideWithBorder = Math.max(masterWidth + 2 * bp, masterHeight + 2 * bp);
          targetW = sideWithBorder;
          targetH = sideWithBorder;
          imgW = masterWidth;
          imgH = masterHeight;
          imgX = Math.round((targetW - imgW) / 2);
          imgY = Math.round((targetH - imgH) / 2);
        } else {
          targetW = masterWidth + 2 * bp;
          targetH = masterHeight + 2 * bp;
          imgW = masterWidth;
          imgH = masterHeight;
          imgX = bp;
          imgY = bp;
        }

        exportCanvas.width = targetW;
        exportCanvas.height = targetH;
        eCtx.fillStyle = borderColor;
        eCtx.fillRect(0, 0, targetW, targetH);
        eCtx.drawImage(masterImage, imgX, imgY, imgW, imgH);
      } else if (mode === 'bw') {
        exportCanvas.width = masterWidth;
        exportCanvas.height = masterHeight;
        eCtx.drawImage(masterImage, 0, 0, masterWidth, masterHeight);
        const fullImgData = eCtx.getImageData(0, 0, masterWidth, masterHeight);
        applyBwFilterToImageData(fullImgData, bwBrightness, bwContrast, bwThresholdMode, bwThresholdVal);
        eCtx.putImageData(fullImgData, 0, 0);
      } else if (mode === 'blur') {
        exportCanvas.width = masterWidth;
        exportCanvas.height = masterHeight;
        eCtx.drawImage(masterImage, 0, 0, masterWidth, masterHeight);

        if (blurStrength > 0) {
          const origFullData = eCtx.getImageData(0, 0, masterWidth, masterHeight);

          const fullBlurCanvas = document.createElement('canvas');
          fullBlurCanvas.width = masterWidth;
          fullBlurCanvas.height = masterHeight;
          const fbCtx = fullBlurCanvas.getContext('2d', { willReadFrequently: true });
          fbCtx.drawImage(masterImage, 0, 0, masterWidth, masterHeight);
          const fullBlurData = fbCtx.getImageData(0, 0, masterWidth, masterHeight);

          applyBoxBlur(fullBlurData, blurStrength);

          if (blurMode === 'whole') {
            eCtx.putImageData(fullBlurData, 0, 0);
          } else {
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = masterWidth;
            maskCanvas.height = masterHeight;
            const mCtx = maskCanvas.getContext('2d');
            mCtx.fillStyle = '#ffffff';

            blurShapes.forEach(shape => {
              mCtx.beginPath();
              if (shape.type === 'ellipse') {
                const rx = Math.abs(shape.w / 2);
                const ry = Math.abs(shape.h / 2);
                const cx = shape.x + shape.w / 2;
                const cy = shape.y + shape.h / 2;
                mCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
              } else {
                mCtx.rect(shape.x, shape.y, shape.w, shape.h);
              }
              mCtx.fill();
            });

            const maskData = mCtx.getImageData(0, 0, masterWidth, masterHeight).data;
            const oData = origFullData.data;
            const bData = fullBlurData.data;
            const len = oData.length;

            for (let i = 0; i < len; i += 4) {
              if (maskData[i + 3] > 128) {
                oData[i] = bData[i];
                oData[i + 1] = bData[i + 1];
                oData[i + 2] = bData[i + 2];
                oData[i + 3] = bData[i + 3];
              }
            }
            eCtx.putImageData(origFullData, 0, 0);
          }
        }
      }

      return exportCanvas;
    }

    /**
     * Helper: Convert Canvas to Blob with white background for JPG
     */
    function exportCanvasToBlob(canvas, mimeType, quality) {
      return new Promise((resolve) => {
        if (mimeType === 'image/jpeg') {
          // Flatten transparent areas onto white
          const whiteCanvas = document.createElement('canvas');
          whiteCanvas.width = canvas.width;
          whiteCanvas.height = canvas.height;
          const wCtx = whiteCanvas.getContext('2d');
          wCtx.fillStyle = '#ffffff';
          wCtx.fillRect(0, 0, canvas.width, canvas.height);
          wCtx.drawImage(canvas, 0, 0);
          whiteCanvas.toBlob(resolve, 'image/jpeg', quality);
        } else {
          canvas.toBlob(resolve, 'image/png');
        }
      });
    }

    /**
     * Binary Search Quality Compression for "Keep under KB"
     */
    async function searchQualityUnderKB(canvas, targetKB) {
      const targetBytes = targetKB * 1024;
      let minQ = 0.05;
      let maxQ = 0.98;
      let bestBlob = null;

      for (let iter = 0; iter < 7; iter++) {
        const midQ = (minQ + maxQ) / 2;
        const blob = await exportCanvasToBlob(canvas, 'image/jpeg', midQ);
        if (!blob) break;

        if (blob.size <= targetBytes) {
          bestBlob = blob;
          minQ = midQ;
        } else {
          maxQ = midQ;
        }
      }

      if (!bestBlob) {
        bestBlob = await exportCanvasToBlob(canvas, 'image/jpeg', 0.05);
      }
      return bestBlob;
    }

    /**
     * Done Editing: Generate Output Blob and Display Results
     */
    async function finalizeOutput() {
      if (!masterImage) return;

      if (doneEditingBtn) {
        doneEditingBtn.disabled = true;
        doneEditingBtn.textContent = 'Processing...';
      }

      try {
        const fullCanvas = await renderFullResolutionCanvas();
        const mimeType = (formatSelect && formatSelect.value === 'png') ? 'image/png' : 'image/jpeg';
        let quality = qualitySlider ? (parseFloat(qualitySlider.value) / 100) : 0.92;
        if (isNaN(quality) || quality <= 0) quality = 0.92;

        let finalBlob = null;
        const isKeepKb = keepKbToggle && keepKbToggle.checked && mimeType === 'image/jpeg';
        let targetKB = customKbInput ? parseFloat(customKbInput.value) : 200;

        if (isKeepKb && targetKB > 0) {
          finalBlob = await searchQualityUnderKB(fullCanvas, targetKB);
        } else {
          finalBlob = await exportCanvasToBlob(fullCanvas, mimeType, quality);
        }

        if (!finalBlob) {
          showError('Failed to generate image file.');
          return;
        }

        generatedBlob = finalBlob;
        if (generatedBlobUrl) URL.revokeObjectURL(generatedBlobUrl);
        generatedBlobUrl = URL.createObjectURL(finalBlob);

        // Update Result Screen UI
        if (resultPreviewImg) resultPreviewImg.src = generatedBlobUrl;
        if (originalDimsEl) originalDimsEl.textContent = `${masterWidth} × ${masterHeight} px`;
        if (originalSizeEl) originalSizeEl.textContent = window.formatBytes ? window.formatBytes(originalSizeBytes) : `${Math.round(originalSizeBytes / 1024)} KB`;
        if (finalDimsEl) finalDimsEl.textContent = `${fullCanvas.width} × ${fullCanvas.height} px`;
        if (finalSizeEl) finalSizeEl.textContent = window.formatBytes ? window.formatBytes(finalBlob.size) : `${Math.round(finalBlob.size / 1024)} KB`;

        if (editorArea) editorArea.classList.add('is-hidden');
        if (resultArea) resultArea.classList.remove('is-hidden');
        setStep(3);
      } catch (err) {
        showError('An error occurred while preparing your download.');
      } finally {
        if (doneEditingBtn) {
          doneEditingBtn.disabled = false;
          doneEditingBtn.textContent = 'Done - Ready to Download';
        }
      }
    }

    if (doneEditingBtn) {
      doneEditingBtn.addEventListener('click', finalizeOutput);
    }

    /**
     * Download Output File
     */
    function triggerDownload() {
      if (!generatedBlob) return;
      const ext = generatedBlob.type === 'image/png' ? 'png' : 'jpg';
      const outputFilename = `${originalBaseName}-${outputSuffix}.${ext}`;

      if (window.downloadBlob) {
        window.downloadBlob(generatedBlob, outputFilename, generatedBlob.type);
      } else {
        const a = document.createElement('a');
        a.href = generatedBlobUrl;
        a.download = outputFilename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 2000);
      }
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', triggerDownload);
    }

    /* ==========================================================================
       EVENT HANDLERS & CONTROLS BINDINGS
       ========================================================================== */

    // Drag & Drop Upload
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      if (uploadBtn) uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
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

    // Zoom Controls
    if (zoomSlider) {
      zoomSlider.addEventListener('input', () => {
        zoomLevel = parseFloat(zoomSlider.value);
        if (zoomValueBadge) zoomValueBadge.textContent = `${Math.round(zoomLevel * 100)}%`;
        renderEditorPreview();
      });
    }

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        zoomLevel = Math.min(3.0, zoomLevel + 0.1);
        if (zoomSlider) zoomSlider.value = zoomLevel;
        if (zoomValueBadge) zoomValueBadge.textContent = `${Math.round(zoomLevel * 100)}%`;
        renderEditorPreview();
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        zoomLevel = Math.max(0.5, zoomLevel - 0.1);
        if (zoomSlider) zoomSlider.value = zoomLevel;
        if (zoomValueBadge) zoomValueBadge.textContent = `${Math.round(zoomLevel * 100)}%`;
        renderEditorPreview();
      });
    }

    if (resetPositionBtn) {
      resetPositionBtn.addEventListener('click', () => {
        zoomLevel = 1.0;
        panX = 0;
        panY = 0;
        if (zoomSlider) zoomSlider.value = 1.0;
        if (zoomValueBadge) zoomValueBadge.textContent = '100%';
        renderEditorPreview();
      });
    }

    // Interactive Pan & Zoom / Area Draw on Canvas
    if (editorCanvas) {
      // Mouse Wheel Zoom
      editorCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        zoomLevel = Math.max(0.5, Math.min(3.0, zoomLevel + delta));
        if (zoomSlider) zoomSlider.value = zoomLevel;
        if (zoomValueBadge) zoomValueBadge.textContent = `${Math.round(zoomLevel * 100)}%`;
        renderEditorPreview();
      }, { passive: false });

      // Mouse Pointer Events
      editorCanvas.addEventListener('mousedown', (e) => {
        if (mode === 'blur' && blurMode === 'area') {
          const rect = editorCanvas.getBoundingClientRect();
          const scaleX = editorCanvas.width / rect.width;
          const scaleY = editorCanvas.height / rect.height;
          const prevScale = editorCanvas.width / masterWidth;
          const startX = ((e.clientX - rect.left) * scaleX) / prevScale;
          const startY = ((e.clientY - rect.top) * scaleY) / prevScale;

          isDrawingArea = true;
          const shapeType = document.getElementById('blurShapeSelect')?.value || 'rect';
          currentShape = { type: shapeType, startX, startY, x: startX, y: startY, w: 0, h: 0 };
        } else {
          isDragging = true;
          dragStartX = e.clientX - panX;
          dragStartY = e.clientY - panY;
          editorCanvas.classList.add('cursor-grabbing');
        }
      });

      window.addEventListener('mousemove', (e) => {
        if (isDrawingArea && currentShape) {
          const rect = editorCanvas.getBoundingClientRect();
          const scaleX = editorCanvas.width / rect.width;
          const scaleY = editorCanvas.height / rect.height;
          const prevScale = editorCanvas.width / masterWidth;
          const curX = ((e.clientX - rect.left) * scaleX) / prevScale;
          const curY = ((e.clientY - rect.top) * scaleY) / prevScale;

          const minX = Math.min(currentShape.startX, curX);
          const minY = Math.min(currentShape.startY, curY);
          const w = Math.abs(curX - currentShape.startX);
          const h = Math.abs(curY - currentShape.startY);

          currentShape.x = minX;
          currentShape.y = minY;
          currentShape.w = w;
          currentShape.h = h;
          renderEditorPreview();
        } else if (isDragging) {
          panX = e.clientX - dragStartX;
          panY = e.clientY - dragStartY;
          renderEditorPreview();
        }
      });

      window.addEventListener('mouseup', () => {
        if (isDrawingArea && currentShape) {
          if (currentShape.w > 5 && currentShape.h > 5) {
            blurShapes.push({
              type: currentShape.type,
              x: currentShape.x,
              y: currentShape.y,
              w: currentShape.w,
              h: currentShape.h
            });
          }
          currentShape = null;
          isDrawingArea = false;
          renderEditorPreview();
        }
        if (isDragging) {
          isDragging = false;
          editorCanvas.classList.remove('cursor-grabbing');
        }
      });

      // Touch Events for Mobile (Pan & Pinch Zoom)
      editorCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          isDragging = true;
          dragStartX = e.touches[0].clientX - panX;
          dragStartY = e.touches[0].clientY - panY;
        } else if (e.touches.length === 2) {
          isDragging = false;
          initialTouchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
      }, { passive: true });

      editorCanvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isDragging) {
          panX = e.touches[0].clientX - dragStartX;
          panY = e.touches[0].clientY - dragStartY;
          renderEditorPreview();
        } else if (e.touches.length === 2) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          if (initialTouchDistance > 0) {
            const factor = dist / initialTouchDistance;
            zoomLevel = Math.max(0.5, Math.min(3.0, zoomLevel * factor));
            if (zoomSlider) zoomSlider.value = zoomLevel;
            if (zoomValueBadge) zoomValueBadge.textContent = `${Math.round(zoomLevel * 100)}%`;
            renderEditorPreview();
          }
          initialTouchDistance = dist;
        }
      }, { passive: true });

      editorCanvas.addEventListener('touchend', () => {
        isDragging = false;
        initialTouchDistance = 0;
      });
    }

    // Quality Slider
    if (qualitySlider) {
      qualitySlider.addEventListener('input', () => {
        if (qualityValBadge) qualityValBadge.textContent = `${qualitySlider.value}%`;
      });
    }

    // Keep under KB controls
    if (keepKbToggle && keepKbControls) {
      keepKbToggle.addEventListener('change', () => {
        keepKbControls.classList.toggle('is-hidden', !keepKbToggle.checked);
      });
    }

    quickKbBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        quickKbBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        if (customKbInput) customKbInput.value = this.dataset.kb;
      });
    });

    // YouTube / WhatsApp Letterbox background toggles
    const fitWholeCheckbox = document.getElementById('fitWholeCheckbox');
    if (fitWholeCheckbox) {
      fitWholeCheckbox.addEventListener('change', () => {
        fitWholeImage = fitWholeCheckbox.checked;
        const bgRow = document.getElementById('letterboxBgRow');
        if (bgRow) bgRow.classList.toggle('is-hidden', !fitWholeImage);
        renderEditorPreview();
      });
    }

    const bgTypeButtons = document.querySelectorAll('.bg-type-btn');
    bgTypeButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        bgTypeButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        backgroundType = this.dataset.bg;
        const customColorPicker = document.getElementById('customBgColorPicker');
        if (customColorPicker) customColorPicker.classList.toggle('is-hidden', backgroundType !== 'custom');
        renderEditorPreview();
      });
    });

    const customBgColorInput = document.getElementById('customBgColor');
    if (customBgColorInput) {
      customBgColorInput.addEventListener('input', (e) => {
        customBgColor = e.target.value;
        renderEditorPreview();
      });
    }

    // Instagram Presets
    const igPresetButtons = document.querySelectorAll('.ig-preset-btn');
    igPresetButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        igPresetButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const presetId = this.dataset.preset;
        const preset = PLATFORM_CONFIG.instagram.postPresets.find(p => p.id === presetId);
        if (preset) {
          outputWidth = preset.width;
          outputHeight = preset.height;
          outputAspect = preset.aspect;
          isCircularMask = !!preset.isCircle;
          zoomLevel = 1.0;
          panX = 0;
          panY = 0;
          renderEditorPreview();
        }
      });
    });

    // WhatsApp Status Preset toggle
    const whatsappPresetButtons = document.querySelectorAll('.wa-preset-btn');
    whatsappPresetButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        whatsappPresetButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const p = this.dataset.preset;
        if (p === 'status') {
          outputWidth = PLATFORM_CONFIG.whatsapp.statusPreset.width;
          outputHeight = PLATFORM_CONFIG.whatsapp.statusPreset.height;
          outputAspect = PLATFORM_CONFIG.whatsapp.statusPreset.aspect;
          isCircularMask = false;
        } else {
          outputWidth = PLATFORM_CONFIG.whatsapp.defaultDpSize;
          outputHeight = PLATFORM_CONFIG.whatsapp.defaultDpSize;
          outputAspect = 1;
          isCircularMask = true;
        }
        zoomLevel = 1.0;
        panX = 0;
        panY = 0;
        renderEditorPreview();
      });
    });

    // Square Tool Modes
    const squareModeButtons = document.querySelectorAll('.square-mode-btn');
    squareModeButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        squareModeButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        squareMode = this.dataset.mode;
        const bgOptions = document.getElementById('squareBgOptions');
        if (bgOptions) bgOptions.classList.toggle('is-hidden', squareMode !== 'background');
        renderEditorPreview();
      });
    });

    const squarePresetButtons = document.querySelectorAll('.square-preset-btn');
    squarePresetButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        squarePresetButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const val = this.dataset.size;
        squareSizePreset = val === 'original' ? 'original' : parseInt(val, 10);
        renderEditorPreview();
      });
    });

    // Border Tool Controls
    const borderSlider = document.getElementById('borderSlider');
    const borderValBadge = document.getElementById('borderValBadge');
    if (borderSlider) {
      borderSlider.addEventListener('input', () => {
        borderPx = parseInt(borderSlider.value, 10);
        if (borderValBadge) borderValBadge.textContent = `${borderPx}${borderIsPercent ? '%' : ' px'}`;
        renderEditorPreview();
      });
    }

    const borderUnitToggle = document.getElementById('borderUnitToggle');
    if (borderUnitToggle) {
      borderUnitToggle.addEventListener('change', () => {
        borderIsPercent = borderUnitToggle.checked;
        if (borderSlider) {
          borderSlider.max = borderIsPercent ? 25 : 300;
          borderSlider.value = borderIsPercent ? 5 : 50;
          borderPx = parseInt(borderSlider.value, 10);
        }
        if (borderValBadge) borderValBadge.textContent = `${borderPx}${borderIsPercent ? '%' : ' px'}`;
        renderEditorPreview();
      });
    }

    const borderSquareToggle = document.getElementById('borderSquareToggle');
    if (borderSquareToggle) {
      borderSquareToggle.addEventListener('change', () => {
        borderMakeSquare = borderSquareToggle.checked;
        renderEditorPreview();
      });
    }

    const borderOriginalSizeToggle = document.getElementById('borderOriginalSizeToggle');
    if (borderOriginalSizeToggle) {
      borderOriginalSizeToggle.addEventListener('change', () => {
        borderKeepOriginalSize = borderOriginalSizeToggle.checked;
        renderEditorPreview();
      });
    }

    const borderColorButtons = document.querySelectorAll('.border-color-btn');
    borderColorButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        borderColorButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        borderColor = this.dataset.color;
        renderEditorPreview();
      });
    });

    const customBorderColorInput = document.getElementById('customBorderColor');
    if (customBorderColorInput) {
      customBorderColorInput.addEventListener('input', (e) => {
        borderColor = e.target.value;
        borderColorButtons.forEach(b => b.classList.remove('active'));
        renderEditorPreview();
      });
    }

    // Black & White Controls
    const bwBrightnessSlider = document.getElementById('bwBrightnessSlider');
    const bwBrightnessVal = document.getElementById('bwBrightnessVal');
    if (bwBrightnessSlider) {
      bwBrightnessSlider.addEventListener('input', () => {
        bwBrightness = parseInt(bwBrightnessSlider.value, 10);
        if (bwBrightnessVal) bwBrightnessVal.textContent = bwBrightness;
        renderEditorPreview();
      });
    }

    const bwContrastSlider = document.getElementById('bwContrastSlider');
    const bwContrastVal = document.getElementById('bwContrastVal');
    if (bwContrastSlider) {
      bwContrastSlider.addEventListener('input', () => {
        bwContrast = parseInt(bwContrastSlider.value, 10);
        if (bwContrastVal) bwContrastVal.textContent = bwContrast;
        renderEditorPreview();
      });
    }

    const bwThresholdToggle = document.getElementById('bwThresholdToggle');
    const bwThresholdControls = document.getElementById('bwThresholdControls');
    if (bwThresholdToggle) {
      bwThresholdToggle.addEventListener('change', () => {
        bwThresholdMode = bwThresholdToggle.checked;
        if (bwThresholdControls) bwThresholdControls.classList.toggle('is-hidden', !bwThresholdMode);
        renderEditorPreview();
      });
    }

    const bwThresholdSlider = document.getElementById('bwThresholdSlider');
    const bwThresholdValBadge = document.getElementById('bwThresholdValBadge');
    if (bwThresholdSlider) {
      bwThresholdSlider.addEventListener('input', () => {
        bwThresholdVal = parseInt(bwThresholdSlider.value, 10);
        if (bwThresholdValBadge) bwThresholdValBadge.textContent = bwThresholdVal;
        renderEditorPreview();
      });
    }

    // Blur Controls
    const blurStrengthSlider = document.getElementById('blurStrengthSlider');
    const blurStrengthVal = document.getElementById('blurStrengthVal');
    if (blurStrengthSlider) {
      blurStrengthSlider.addEventListener('input', () => {
        blurStrength = parseInt(blurStrengthSlider.value, 10);
        if (blurStrengthVal) blurStrengthVal.textContent = blurStrength;
        renderEditorPreview();
      });
    }

    const blurModeButtons = document.querySelectorAll('.blur-mode-btn');
    blurModeButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        blurModeButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        blurMode = this.dataset.mode;
        const areaControls = document.getElementById('blurAreaControls');
        if (areaControls) areaControls.classList.toggle('is-hidden', blurMode !== 'area');
        if (editorCanvas) {
          if (blurMode === 'area') {
            editorCanvas.classList.add('cursor-crosshair');
          } else {
            editorCanvas.classList.remove('cursor-crosshair');
          }
        }
        renderEditorPreview();
      });
    });

    const blurUndoBtn = document.getElementById('blurUndoBtn');
    if (blurUndoBtn) {
      blurUndoBtn.addEventListener('click', () => {
        if (blurShapes.length > 0) {
          blurShapes.pop();
          renderEditorPreview();
        }
      });
    }

    const blurClearBtn = document.getElementById('blurClearBtn');
    if (blurClearBtn) {
      blurClearBtn.addEventListener('click', () => {
        blurShapes = [];
        renderEditorPreview();
      });
    }
  };
})();
