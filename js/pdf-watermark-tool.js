/**
 * FileShrink - Add Watermark to PDF Engine (js/pdf-watermark-tool.js)
 * Supports text & image watermarks, custom opacity & rotation, centered & tiled placement,
 * Unicode/Urdu text canvas fallback, on-top and behind-content placement, and range filtering.
 */

(function () {
  'use strict';

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // Check if string can be rendered with standard Latin-1 PDF font
  function isStandardPdfText(str) {
    // Standard WinAnsi / Latin-1 range
    return /^[\x20-\x7E\xA0-\xFF\r\n\t]*$/.test(str);
  }

  // Parse hex color into { r, g, b } normalized to [0, 1]
  function hexToRgb(hex) {
    hex = (hex || '#000000').replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const num = parseInt(hex, 16);
    return {
      r: ((num >> 16) & 255) / 255,
      g: ((num >> 8) & 255) / 255,
      b: (num & 255) / 255
    };
  }

  window.initPdfWatermarkTool = function () {
    // DOM Elements - Steps & Containers
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

    // Watermark Mode Tabs
    const tabTextBtn = document.getElementById('tabTextBtn');
    const tabImageBtn = document.getElementById('tabImageBtn');
    const panelText = document.getElementById('panelText');
    const panelImage = document.getElementById('panelImage');

    // Text Watermark Controls
    const wmTextInput = document.getElementById('wmTextInput');
    const wmFontSizeInput = document.getElementById('wmFontSize');
    const wmColorInput = document.getElementById('wmColor');
    const wmOpacitySlider = document.getElementById('wmOpacity');
    const wmOpacityVal = document.getElementById('wmOpacityVal');
    const wmRotationSlider = document.getElementById('wmRotation');
    const wmRotationVal = document.getElementById('wmRotationVal');
    const wmBoldCheckbox = document.getElementById('wmBold');
    const wmPositionSelect = document.getElementById('wmPosition');
    const unicodeNotice = document.getElementById('unicodeNotice');

    // Image Watermark Controls
    const logoFileInput = document.getElementById('logoFileInput');
    const logoUploadBtn = document.getElementById('logoUploadBtn');
    const logoPreviewImg = document.getElementById('logoPreviewImg');
    const wmScaleSlider = document.getElementById('wmScale');
    const wmScaleVal = document.getElementById('wmScaleVal');

    // Scope & Layer Placement Controls
    const wmScopeSelect = document.getElementById('wmScopeSelect');
    const wmPageRangeGroup = document.getElementById('wmPageRangeGroup');
    const wmPageRangeInput = document.getElementById('wmPageRangeInput');
    const wmPlacementSelect = document.getElementById('wmPlacementSelect');

    // Preview Canvas & Stage
    const stageContainer = document.getElementById('stageContainer');
    const stageInner = document.getElementById('stageInner');
    const previewCanvas = document.getElementById('previewCanvas');
    const wmLiveOverlay = document.getElementById('wmLiveOverlay');

    // Actions
    const startAgainBtn = document.getElementById('startAgainBtn');
    const actionExecuteBtn = document.getElementById('actionExecuteBtn');
    const resultDownloadBtn = document.getElementById('resultDownloadBtn');
    const resultStartAgainBtn = document.getElementById('resultStartAgainBtn');
    const resultPageCountEl = document.getElementById('resultPageCount');
    const resultFileSizeEl = document.getElementById('resultFileSize');

    // Working State
    let rawPdfBuffer = null;
    let pdfJsDoc = null;
    let pdfLibDoc = null;
    let originalBaseName = 'document';
    let totalPages = 0;
    let currentRenderTask = null;

    let activeMode = 'text'; // 'text' or 'image'
    let uploadedLogoImage = null; // Image element

    let renderScale = 1.0;
    let canvasWidth = 0;
    let canvasHeight = 0;

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
      uploadedLogoImage = null;
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

        if (processingArea) processingArea.classList.add('is-hidden');
        if (editorArea) editorArea.classList.remove('is-hidden');

        await renderPreviewPage();
      } catch (err) {
        if (err.name === 'PasswordException' || (err.message && /password|encrypt/i.test(err.message))) {
          showError('This PDF is password-protected. Please remove the password before using this tool.');
        } else {
          showError(err.message || 'Could not read PDF. The file may be damaged or invalid.');
        }
      }
    }

    /* ==========================================================================
       PAGE 1 PREVIEW RENDERING & LIVE OVERLAY
       ========================================================================== */

    async function renderPreviewPage() {
      if (!pdfJsDoc) return;
      if (currentRenderTask) {
        try { currentRenderTask.cancel(); } catch (e) {}
      }

      const page = await pdfJsDoc.getPage(1);
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      const maxWidth = Math.min(stageContainer ? stageContainer.clientWidth - 40 : 600, 680);
      renderScale = Math.min(maxWidth / unscaledViewport.width, 1.25);
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

      updateLiveOverlay();
    }

    function updateLiveOverlay() {
      if (!wmLiveOverlay) return;
      wmLiveOverlay.innerHTML = '';

      const opacity = parseFloat(wmOpacitySlider ? wmOpacitySlider.value : '0.25');
      const rotation = parseFloat(wmRotationSlider ? wmRotationSlider.value : '45');
      const isTiled = wmPositionSelect && wmPositionSelect.value === 'tile';

      if (activeMode === 'text') {
        const text = (wmTextInput && wmTextInput.value) || 'CONFIDENTIAL';
        const fontSizePt = parseFloat(wmFontSizeInput ? wmFontSizeInput.value : '48') || 48;
        const fontSizePx = fontSizePt * renderScale;
        const color = wmColorInput ? wmColorInput.value : '#e11d48';
        const isBold = wmBoldCheckbox && wmBoldCheckbox.checked;

        // Check Unicode standard font compatibility
        const isStandard = isStandardPdfText(text);
        if (unicodeNotice) {
          unicodeNotice.classList.toggle('is-hidden', isStandard);
        }

        if (!isTiled) {
          const textSpan = document.createElement('span');
          textSpan.textContent = text;
          textSpan.style.fontFamily = 'Helvetica, Arial, sans-serif';
          textSpan.style.fontWeight = isBold ? 'bold' : 'normal';
          textSpan.style.fontSize = `${fontSizePx}px`;
          textSpan.style.color = color;
          textSpan.style.opacity = opacity;
          textSpan.style.transform = `rotate(-${rotation}deg)`;
          textSpan.style.whiteSpace = 'nowrap';
          wmLiveOverlay.appendChild(textSpan);
        } else {
          // Repeating tile
          const tileGrid = document.createElement('div');
          tileGrid.style.display = 'grid';
          tileGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
          tileGrid.style.gridTemplateRows = 'repeat(4, 1fr)';
          tileGrid.style.width = '100%';
          tileGrid.style.height = '100%';
          tileGrid.style.alignItems = 'center';
          tileGrid.style.justifyItems = 'center';

          for (let i = 0; i < 12; i++) {
            const span = document.createElement('span');
            span.textContent = text;
            span.style.fontFamily = 'Helvetica, Arial, sans-serif';
            span.style.fontWeight = isBold ? 'bold' : 'normal';
            span.style.fontSize = `${Math.round(fontSizePx * 0.65)}px`;
            span.style.color = color;
            span.style.opacity = opacity;
            span.style.transform = `rotate(-${rotation}deg)`;
            span.style.whiteSpace = 'nowrap';
            tileGrid.appendChild(span);
          }
          wmLiveOverlay.appendChild(tileGrid);
        }
      } else if (activeMode === 'image') {
        if (!uploadedLogoImage) {
          wmLiveOverlay.innerHTML = '<span style="color:var(--text-light); font-size:0.875rem;">Upload an image to see watermark preview</span>';
          return;
        }

        const scalePct = parseFloat(wmScaleSlider ? wmScaleSlider.value : '50') / 100;
        const imgW = (uploadedLogoImage.naturalWidth || 200) * scalePct * renderScale;
        const imgH = (uploadedLogoImage.naturalHeight || 100) * scalePct * renderScale;

        if (!isTiled) {
          const img = document.createElement('img');
          img.src = uploadedLogoImage.src;
          img.style.width = `${imgW}px`;
          img.style.height = `${imgH}px`;
          img.style.opacity = opacity;
          img.style.transform = `rotate(-${rotation}deg)`;
          img.style.objectFit = 'contain';
          wmLiveOverlay.appendChild(img);
        } else {
          const tileGrid = document.createElement('div');
          tileGrid.style.display = 'grid';
          tileGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
          tileGrid.style.gridTemplateRows = 'repeat(3, 1fr)';
          tileGrid.style.width = '100%';
          tileGrid.style.height = '100%';
          tileGrid.style.alignItems = 'center';
          tileGrid.style.justifyItems = 'center';

          for (let i = 0; i < 9; i++) {
            const img = document.createElement('img');
            img.src = uploadedLogoImage.src;
            img.style.width = `${imgW * 0.55}px`;
            img.style.height = `${imgH * 0.55}px`;
            img.style.opacity = opacity;
            img.style.transform = `rotate(-${rotation}deg)`;
            img.style.objectFit = 'contain';
            tileGrid.appendChild(img);
          }
          wmLiveOverlay.appendChild(tileGrid);
        }
      }
    }

    // Tabs switching
    if (tabTextBtn && tabImageBtn) {
      tabTextBtn.addEventListener('click', () => {
        activeMode = 'text';
        tabTextBtn.classList.add('active');
        tabImageBtn.classList.remove('active');
        if (panelText) {
          panelText.classList.add('active');
          panelText.style.display = 'contents';
        }
        if (panelImage) {
          panelImage.classList.remove('active');
          panelImage.style.display = 'none';
        }
        updateLiveOverlay();
      });

      tabImageBtn.addEventListener('click', () => {
        activeMode = 'image';
        tabImageBtn.classList.add('active');
        tabTextBtn.classList.remove('active');
        if (panelImage) {
          panelImage.classList.add('active');
          panelImage.style.display = 'block';
        }
        if (panelText) {
          panelText.classList.remove('active');
          panelText.style.display = 'none';
        }
        updateLiveOverlay();
      });
    }

    // Form listeners for live update
    [wmTextInput, wmFontSizeInput, wmColorInput, wmBoldCheckbox, wmPositionSelect].forEach(el => {
      if (el) el.addEventListener('input', updateLiveOverlay);
      if (el) el.addEventListener('change', updateLiveOverlay);
    });

    if (wmOpacitySlider) {
      wmOpacitySlider.addEventListener('input', () => {
        if (wmOpacityVal) wmOpacityVal.textContent = wmOpacitySlider.value;
        updateLiveOverlay();
      });
    }

    if (wmRotationSlider) {
      wmRotationSlider.addEventListener('input', () => {
        if (wmRotationVal) wmRotationVal.textContent = `${wmRotationSlider.value}°`;
        updateLiveOverlay();
      });
    }

    if (wmScaleSlider) {
      wmScaleSlider.addEventListener('input', () => {
        if (wmScaleVal) wmScaleVal.textContent = `${wmScaleSlider.value}%`;
        updateLiveOverlay();
      });
    }

    // Image Upload
    if (logoUploadBtn && logoFileInput) {
      logoUploadBtn.addEventListener('click', () => logoFileInput.click());
      logoFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
              uploadedLogoImage = img;
              if (logoPreviewImg) {
                logoPreviewImg.src = img.src;
                logoPreviewImg.classList.remove('is-hidden');
              }
              updateLiveOverlay();
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Scope change
    if (wmScopeSelect && wmPageRangeGroup) {
      wmScopeSelect.addEventListener('change', () => {
        wmPageRangeGroup.classList.toggle('is-hidden', wmScopeSelect.value !== 'range');
      });
    }

    function parseScopeIndices(scope, total, rangeStr) {
      const set = new Set();
      if (scope === 'all') {
        for (let i = 0; i < total; i++) set.add(i);
      } else if (scope === 'odd') {
        for (let i = 0; i < total; i += 2) set.add(i);
      } else if (scope === 'even') {
        for (let i = 1; i < total; i += 2) set.add(i);
      } else if (scope === 'range') {
        const parts = (rangeStr || '').split(',');
        for (let p of parts) {
          p = p.trim();
          if (p.includes('-')) {
            const [s, e] = p.split('-');
            const start = parseInt(s, 10);
            const end = parseInt(e, 10);
            if (!isNaN(start) && !isNaN(end)) {
              for (let i = Math.max(1, start); i <= Math.min(total, end); i++) {
                set.add(i - 1);
              }
            }
          } else {
            const num = parseInt(p, 10);
            if (!isNaN(num) && num >= 1 && num <= total) {
              set.add(num - 1);
            }
          }
        }
      }
      return set;
    }

    /* ==========================================================================
       EXPORT & WATERMARK EMBEDDING WITH PDF-LIB
       ========================================================================== */

    // Render Unicode text (e.g. Urdu/Arabic/Emoji) onto transparent PNG canvas
    function renderTextToCanvasPng(text, fontSizePt, colorHex, isBold) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const fontStr = `${isBold ? 'bold ' : ''}${Math.round(fontSizePt * 2)}px sans-serif`;
      ctx.font = fontStr;
      const metrics = ctx.measureText(text);

      const width = Math.max(20, Math.ceil(metrics.width) + 20);
      const height = Math.max(20, Math.ceil(fontSizePt * 2.8));

      canvas.width = width;
      canvas.height = height;

      ctx.font = fontStr;
      ctx.fillStyle = colorHex;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(text, width / 2, height / 2);

      return {
        dataUrl: canvas.toDataURL('image/png'),
        widthPt: width / 2,
        heightPt: height / 2
      };
    }

    async function executeWatermarkExport() {
      if (actionExecuteBtn) {
        actionExecuteBtn.disabled = true;
        actionExecuteBtn.textContent = 'Applying Watermark...';
      }

      try {
        const scope = wmScopeSelect ? wmScopeSelect.value : 'all';
        const targetPages = parseScopeIndices(scope, totalPages, wmPageRangeInput ? wmPageRangeInput.value : '');

        if (targetPages.size === 0) {
          throw new Error('Please select at least one page to watermark.');
        }

        const opacity = parseFloat(wmOpacitySlider ? wmOpacitySlider.value : '0.25');
        const rotationDeg = parseFloat(wmRotationSlider ? wmRotationSlider.value : '45');
        const isTiled = wmPositionSelect && wmPositionSelect.value === 'tile';
        const isBehind = wmPlacementSelect && wmPlacementSelect.value === 'behind';

        let drawWatermarkOnPage = null;

        if (activeMode === 'text') {
          const text = (wmTextInput && wmTextInput.value) || 'CONFIDENTIAL';
          const fontSize = parseFloat(wmFontSizeInput ? wmFontSizeInput.value : '48') || 48;
          const colorHex = wmColorInput ? wmColorInput.value : '#e11d48';
          const rgbColor = hexToRgb(colorHex);
          const isBold = wmBoldCheckbox && wmBoldCheckbox.checked;

          if (isStandardPdfText(text)) {
            // Standard Latin font
            const fontName = isBold ? window.PDFLib.StandardFonts.HelveticaBold : window.PDFLib.StandardFonts.Helvetica;
            const font = await pdfLibDoc.embedFont(fontName);

            drawWatermarkOnPage = (page) => {
              const crop = page.getCropBox() || page.getMediaBox();
              const W = crop.width;
              const H = crop.height;
              const textW = font.widthOfTextAtSize(text, fontSize);
              const textH = font.heightAtSize(fontSize);

              const rad = (rotationDeg * Math.PI) / 180;
              const dx = (textW / 2) * Math.cos(rad) - (textH / 2) * Math.sin(rad);
              const dy = (textW / 2) * Math.sin(rad) + (textH / 2) * Math.cos(rad);

              if (!isTiled) {
                const cx = crop.x + W / 2;
                const cy = crop.y + H / 2;
                page.drawText(text, {
                  x: cx - dx,
                  y: cy - dy,
                  size: fontSize,
                  font: font,
                  color: window.PDFLib.rgb(rgbColor.r, rgbColor.g, rgbColor.b),
                  opacity: opacity,
                  rotate: window.PDFLib.degrees(rotationDeg)
                });
              } else {
                const stepX = Math.max(160, textW + 60);
                const stepY = Math.max(140, textH + 80);
                for (let x = crop.x - W * 0.5; x < crop.x + W * 1.5; x += stepX) {
                  for (let y = crop.y - H * 0.5; y < crop.y + H * 1.5; y += stepY) {
                    page.drawText(text, {
                      x: x - dx,
                      y: y - dy,
                      size: fontSize * 0.75,
                      font: font,
                      color: window.PDFLib.rgb(rgbColor.r, rgbColor.g, rgbColor.b),
                      opacity: opacity,
                      rotate: window.PDFLib.degrees(rotationDeg)
                    });
                  }
                }
              }
            };
          } else {
            // Unicode / Urdu: render text to PNG canvas and embed
            const renderedCanvas = renderTextToCanvasPng(text, fontSize, colorHex, isBold);
            const embeddedPng = await pdfLibDoc.embedPng(renderedCanvas.dataUrl);

            drawWatermarkOnPage = (page) => {
              const crop = page.getCropBox() || page.getMediaBox();
              const W = crop.width;
              const H = crop.height;
              const imgW = renderedCanvas.widthPt;
              const imgH = renderedCanvas.heightPt;

              const rad = (rotationDeg * Math.PI) / 180;
              const dx = (imgW / 2) * Math.cos(rad) - (imgH / 2) * Math.sin(rad);
              const dy = (imgW / 2) * Math.sin(rad) + (imgH / 2) * Math.cos(rad);

              if (!isTiled) {
                const cx = crop.x + W / 2;
                const cy = crop.y + H / 2;
                page.drawImage(embeddedPng, {
                  x: cx - dx,
                  y: cy - dy,
                  width: imgW,
                  height: imgH,
                  opacity: opacity,
                  rotate: window.PDFLib.degrees(rotationDeg)
                });
              } else {
                const stepX = Math.max(160, imgW + 60);
                const stepY = Math.max(140, imgH + 80);
                for (let x = crop.x - W * 0.5; x < crop.x + W * 1.5; x += stepX) {
                  for (let y = crop.y - H * 0.5; y < crop.y + H * 1.5; y += stepY) {
                    page.drawImage(embeddedPng, {
                      x: x - dx,
                      y: y - dy,
                      width: imgW * 0.75,
                      height: imgH * 0.75,
                      opacity: opacity,
                      rotate: window.PDFLib.degrees(rotationDeg)
                    });
                  }
                }
              }
            };
          }
        } else if (activeMode === 'image') {
          if (!uploadedLogoImage) {
            throw new Error('Please choose an image or logo to use as watermark.');
          }

          let embeddedLogo = null;
          if (uploadedLogoImage.src.startsWith('data:image/png')) {
            embeddedLogo = await pdfLibDoc.embedPng(uploadedLogoImage.src);
          } else {
            // Convert to PNG canvas to guarantee alpha channel support
            const c = document.createElement('canvas');
            c.width = uploadedLogoImage.naturalWidth || 200;
            c.height = uploadedLogoImage.naturalHeight || 100;
            const ctx = c.getContext('2d');
            ctx.drawImage(uploadedLogoImage, 0, 0);
            embeddedLogo = await pdfLibDoc.embedPng(c.toDataURL('image/png'));
          }

          const scalePct = parseFloat(wmScaleSlider ? wmScaleSlider.value : '50') / 100;

          drawWatermarkOnPage = (page) => {
            const crop = page.getCropBox() || page.getMediaBox();
            const W = crop.width;
            const H = crop.height;
            const imgW = (embeddedLogo.width * 0.5) * scalePct;
            const imgH = (embeddedLogo.height * 0.5) * scalePct;

            const rad = (rotationDeg * Math.PI) / 180;
            const dx = (imgW / 2) * Math.cos(rad) - (imgH / 2) * Math.sin(rad);
            const dy = (imgW / 2) * Math.sin(rad) + (imgH / 2) * Math.cos(rad);

            if (!isTiled) {
              const cx = crop.x + W / 2;
              const cy = crop.y + H / 2;
              page.drawImage(embeddedLogo, {
                x: cx - dx,
                y: cy - dy,
                width: imgW,
                height: imgH,
                opacity: opacity,
                rotate: window.PDFLib.degrees(rotationDeg)
              });
            } else {
              const stepX = Math.max(160, imgW + 80);
              const stepY = Math.max(140, imgH + 80);
              for (let x = crop.x - W * 0.5; x < crop.x + W * 1.5; x += stepX) {
                for (let y = crop.y - H * 0.5; y < crop.y + H * 1.5; y += stepY) {
                  page.drawImage(embeddedLogo, {
                    x: x - dx,
                    y: y - dy,
                    width: imgW * 0.6,
                    height: imgH * 0.6,
                    opacity: opacity,
                    rotate: window.PDFLib.degrees(rotationDeg)
                  });
                }
              }
            }
          };
        }

        let exportPdfBytes = null;

        if (!isBehind) {
          // On Top of Content: direct draw on existing pages
          const pages = pdfLibDoc.getPages();
          targetPages.forEach(idx => {
            drawWatermarkOnPage(pages[idx]);
          });
          exportPdfBytes = await pdfLibDoc.save();
        } else {
          // Behind Content: embed source pages into a new document
          // Watermark is drawn FIRST, then source page is drawn on top
          const newDoc = await window.PDFLib.PDFDocument.create();

          for (let i = 0; i < totalPages; i++) {
            const origPage = pdfLibDoc.getPage(i);
            const crop = origPage.getCropBox() || origPage.getMediaBox();
            const [embedded] = await newDoc.embedPage(origPage);

            const newPage = newDoc.addPage([crop.width, crop.height]);
            newPage.setRotation(origPage.getRotation());

            if (targetPages.has(i)) {
              drawWatermarkOnPage(newPage);
            }

            newPage.drawPage(embedded, {
              x: 0,
              y: 0,
              width: crop.width,
              height: crop.height
            });
          }
          exportPdfBytes = await newDoc.save();
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
        showError(err.message || 'An error occurred while adding the watermark.');
      } finally {
        if (actionExecuteBtn) {
          actionExecuteBtn.disabled = false;
          actionExecuteBtn.textContent = 'Save & Download Watermarked PDF';
        }
      }
    }

    if (actionExecuteBtn) actionExecuteBtn.addEventListener('click', executeWatermarkExport);

    if (resultDownloadBtn) {
      resultDownloadBtn.addEventListener('click', () => {
        if (!finalDownloadBlob) return;
        const fileName = `${originalBaseName}-watermarked.pdf`;
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

    /* Upload Drag & Drop */
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
