/**
 * FileShrink - Add Signature to PDF Engine (js/pdf-signature-tool.js)
 * Draw, type, or upload signature, drag and resize on PDF pages with boundary clamping,
 * and lossless vector embedding via pdf-lib with exact coordinate mapping.
 */

(function () {
  'use strict';

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  window.initPdfSignatureTool = function () {
    // DOM Elements - Containers & Steps
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const uploadArea = document.getElementById('uploadArea');
    const creatorArea = document.getElementById('creatorArea');
    const placementArea = document.getElementById('placementArea');
    const processingArea = document.getElementById('processingArea');
    const progressStatus = document.getElementById('progressStatus');
    const progressBar = document.getElementById('progressBar');
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');
    const errorMessage = document.getElementById('errorMessage');
    const warningArea = document.getElementById('warningArea');
    const warningMessage = document.getElementById('warningMessage');

    // Upload Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');

    // Signature Creation Tabs
    const tabDrawBtn = document.getElementById('tabDrawBtn');
    const tabTypeBtn = document.getElementById('tabTypeBtn');
    const tabUploadBtn = document.getElementById('tabUploadBtn');
    const panelDraw = document.getElementById('panelDraw');
    const panelType = document.getElementById('panelType');
    const panelUpload = document.getElementById('panelUpload');

    // Draw Tab Elements
    const drawCanvas = document.getElementById('drawCanvas');
    const drawUndoBtn = document.getElementById('drawUndoBtn');
    const drawClearBtn = document.getElementById('drawClearBtn');
    const drawThicknessSelect = document.getElementById('drawThickness');
    const colorDots = document.querySelectorAll('.sig-color-dot');

    // Type Tab Elements
    const typeNameInput = document.getElementById('typeNameInput');
    const fontCards = document.querySelectorAll('.sig-font-card');

    // Upload Tab Elements
    const sigFileInput = document.getElementById('sigFileInput');
    const sigUploadBtn = document.getElementById('sigUploadBtn');
    const removeBgCheckbox = document.getElementById('removeBgCheckbox');
    const bgThresholdSlider = document.getElementById('bgThresholdSlider');
    const sigUploadPreview = document.getElementById('sigUploadPreview');

    // Proceed to Step 3
    const proceedToPlacementBtn = document.getElementById('proceedToPlacementBtn');
    const backToSignatureBtn = document.getElementById('backToSignatureBtn');

    // Page Navigator in Placement
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageNumDisplay = document.getElementById('pageNumDisplay');

    // Interactive Stage Elements
    const stageContainer = document.getElementById('stageContainer');
    const stageInner = document.getElementById('stageInner');
    const previewCanvas = document.getElementById('previewCanvas');
    const interactiveOverlay = document.getElementById('interactiveOverlay');
    const placedSig = document.getElementById('placedSig');
    const placedSigImg = document.getElementById('placedSigImg');
    const sigResizeHandle = document.getElementById('sigResizeHandle');

    // Text Fields (Name & Date)
    const addNameFieldBtn = document.getElementById('addNameFieldBtn');
    const addDateFieldBtn = document.getElementById('addDateFieldBtn');
    const placedNameField = document.getElementById('placedNameField');
    const placedDateField = document.getElementById('placedDateField');

    // Scope & Execute
    const sigScopeSelect = document.getElementById('sigScopeSelect');
    const sigPageRangeGroup = document.getElementById('sigPageRangeGroup');
    const sigPageRangeInput = document.getElementById('sigPageRangeInput');
    const actionExecuteBtn = document.getElementById('actionExecuteBtn');
    const startAgainBtn = document.getElementById('startAgainBtn');
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
    let currentPageIndex = 0;
    let currentRenderTask = null;

    // Signature State
    let activeTab = 'draw';
    let penColor = '#000000';
    let penThickness = 3;
    let drawStrokes = [];
    let currentStroke = null;
    let isDrawing = false;
    let typedFont = 'Caveat';
    let uploadedRawImage = null; // Image element

    // Final signature image as transparent PNG data URL
    let signatureDataUrl = null;
    let signatureAspectRatio = 2.5; // width / height

    // Placement State in screen px relative to rendered stageInner
    let sigPlacementPx = {
      x: 50,
      y: 50,
      width: 150,
      height: 60
    };

    // Text field placement states
    let nameFieldState = {
      active: false,
      text: '',
      x: 50,
      y: 130,
      fontSize: 14,
      color: '#000000'
    };

    let dateFieldState = {
      active: false,
      text: '',
      x: 50,
      y: 170,
      fontSize: 14,
      color: '#000000'
    };

    let renderScale = 1.0;
    let visualPageWidth = 0;
    let visualPageHeight = 0;
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
      currentPageIndex = 0;
      drawStrokes = [];
      signatureDataUrl = null;
      uploadedRawImage = null;
      nameFieldState.active = false;
      dateFieldState.active = false;
      finalDownloadBlob = null;

      clearError();
      clearWarning();
      if (uploadArea) uploadArea.classList.remove('is-hidden');
      if (creatorArea) creatorArea.classList.add('is-hidden');
      if (placementArea) placementArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.add('is-hidden');
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
        if (creatorArea) creatorArea.classList.remove('is-hidden');

        initDrawCanvas();
        updateTypePreviews();
      } catch (err) {
        if (err.name === 'PasswordException' || (err.message && /password|encrypt/i.test(err.message))) {
          showError('This PDF is password-protected. Please remove the password before using this tool.');
        } else {
          showError(err.message || 'Could not read PDF. The file may be damaged or invalid.');
        }
      }
    }

    /* ==========================================================================
       STEP 2: SIGNATURE CREATION TABS (DRAW, TYPE, UPLOAD)
       ========================================================================== */

    // Tab Switching
    function switchTab(tab) {
      activeTab = tab;
      [tabDrawBtn, tabTypeBtn, tabUploadBtn].forEach(b => b && b.classList.remove('active'));
      [panelDraw, panelType, panelUpload].forEach(p => p && p.classList.remove('active'));

      if (tab === 'draw') {
        if (tabDrawBtn) tabDrawBtn.classList.add('active');
        if (panelDraw) panelDraw.classList.add('active');
        initDrawCanvas();
      } else if (tab === 'type') {
        if (tabTypeBtn) tabTypeBtn.classList.add('active');
        if (panelType) panelType.classList.add('active');
        updateTypePreviews();
      } else if (tab === 'upload') {
        if (tabUploadBtn) tabUploadBtn.classList.add('active');
        if (panelUpload) panelUpload.classList.add('active');
      }
    }

    if (tabDrawBtn) tabDrawBtn.addEventListener('click', () => switchTab('draw'));
    if (tabTypeBtn) tabTypeBtn.addEventListener('click', () => switchTab('type'));
    if (tabUploadBtn) tabUploadBtn.addEventListener('click', () => switchTab('upload'));

    // 1. Draw Tab Canvas Logic
    function initDrawCanvas() {
      if (!drawCanvas) return;
      const rect = drawCanvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      drawCanvas.width = Math.round((rect.width || 500) * dpr);
      drawCanvas.height = Math.round(180 * dpr);
      redrawCanvas();
    }

    function redrawCanvas() {
      if (!drawCanvas) return;
      const ctx = drawCanvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      drawStrokes.forEach(stroke => {
        if (stroke.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.thickness * dpr;

        ctx.moveTo(stroke.points[0].x * dpr, stroke.points[0].y * dpr);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x * dpr, stroke.points[i].y * dpr);
        }
        ctx.stroke();
      });
    }

    function getCanvasPos(e) {
      const rect = drawCanvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }

    if (drawCanvas) {
      const startDraw = (e) => {
        isDrawing = true;
        const pos = getCanvasPos(e);
        currentStroke = {
          color: penColor,
          thickness: penThickness,
          points: [pos]
        };
        drawStrokes.push(currentStroke);
        e.preventDefault();
      };

      const moveDraw = (e) => {
        if (!isDrawing || !currentStroke) return;
        const pos = getCanvasPos(e);
        currentStroke.points.push(pos);
        redrawCanvas();
        e.preventDefault();
      };

      const endDraw = () => {
        isDrawing = false;
        currentStroke = null;
      };

      drawCanvas.addEventListener('mousedown', startDraw);
      drawCanvas.addEventListener('mousemove', moveDraw);
      window.addEventListener('mouseup', endDraw);

      drawCanvas.addEventListener('touchstart', startDraw, { passive: false });
      drawCanvas.addEventListener('touchmove', moveDraw, { passive: false });
      window.addEventListener('touchend', endDraw);
    }

    if (drawUndoBtn) {
      drawUndoBtn.addEventListener('click', () => {
        drawStrokes.pop();
        redrawCanvas();
      });
    }

    if (drawClearBtn) {
      drawClearBtn.addEventListener('click', () => {
        drawStrokes = [];
        redrawCanvas();
      });
    }

    if (drawThicknessSelect) {
      drawThicknessSelect.addEventListener('change', () => {
        penThickness = parseInt(drawThicknessSelect.value, 10) || 3;
      });
    }

    colorDots.forEach(dot => {
      dot.addEventListener('click', () => {
        colorDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        penColor = dot.dataset.color || '#000000';
      });
    });

    // 2. Type Tab Logic
    function updateTypePreviews() {
      const name = (typeNameInput && typeNameInput.value.trim()) || 'Your Signature';
      fontCards.forEach(card => {
        const previewEl = card.querySelector('.sig-font-preview');
        const fontName = card.dataset.font;
        if (previewEl && fontName) {
          previewEl.style.fontFamily = `'${fontName}', cursive, sans-serif`;
          previewEl.textContent = name;
        }
      });
    }

    if (typeNameInput) {
      typeNameInput.addEventListener('input', updateTypePreviews);
    }

    fontCards.forEach(card => {
      card.addEventListener('click', () => {
        fontCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        typedFont = card.dataset.font || 'Caveat';
      });
    });

    // 3. Upload Tab Logic
    if (sigUploadBtn && sigFileInput) {
      sigUploadBtn.addEventListener('click', () => sigFileInput.click());
      sigFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
              uploadedRawImage = img;
              processUploadedSignature();
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    function processUploadedSignature() {
      if (!uploadedRawImage || !sigUploadPreview) return;
      const canvas = document.createElement('canvas');
      canvas.width = uploadedRawImage.naturalWidth || uploadedRawImage.width;
      canvas.height = uploadedRawImage.naturalHeight || uploadedRawImage.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(uploadedRawImage, 0, 0);

      const doRemoveBg = removeBgCheckbox ? removeBgCheckbox.checked : true;
      const threshold = bgThresholdSlider ? parseInt(bgThresholdSlider.value, 10) : 220;

      if (doRemoveBg) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Brightness formula
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          if (brightness > threshold) {
            data[i + 3] = 0; // Transparent
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }

      sigUploadPreview.src = canvas.toDataURL('image/png');
      sigUploadPreview.classList.remove('is-hidden');
    }

    if (removeBgCheckbox) removeBgCheckbox.addEventListener('change', processUploadedSignature);
    if (bgThresholdSlider) bgThresholdSlider.addEventListener('input', processUploadedSignature);

    // Generate Final Signature Transparent PNG
    function generateFinalSignatureBlob() {
      if (activeTab === 'draw') {
        if (drawStrokes.length === 0) {
          showError('Please draw your signature before continuing.');
          return false;
        }

        // Find bounding box of drawn strokes to trim excess whitespace
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        drawStrokes.forEach(s => {
          s.points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          });
        });

        if (minX >= maxX || minY >= maxY) {
          showError('Please draw your signature before continuing.');
          return false;
        }

        const padding = 10;
        const cropW = Math.max(20, maxX - minX + padding * 2);
        const cropH = Math.max(15, maxY - minY + padding * 2);

        const outCanvas = document.createElement('canvas');
        const scale = 2; // High-res
        outCanvas.width = Math.round(cropW * scale);
        outCanvas.height = Math.round(cropH * scale);
        const ctx = outCanvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        drawStrokes.forEach(s => {
          if (s.points.length < 2) return;
          ctx.beginPath();
          ctx.strokeStyle = s.color;
          ctx.lineWidth = s.thickness;
          ctx.moveTo(s.points[0].x - minX + padding, s.points[0].y - minY + padding);
          for (let i = 1; i < s.points.length; i++) {
            ctx.lineTo(s.points[i].x - minX + padding, s.points[i].y - minY + padding);
          }
          ctx.stroke();
        });

        signatureDataUrl = outCanvas.toDataURL('image/png');
        signatureAspectRatio = cropW / cropH;
        return true;
      } else if (activeTab === 'type') {
        const text = (typeNameInput && typeNameInput.value.trim()) || 'Signature';
        const outCanvas = document.createElement('canvas');
        outCanvas.width = 600;
        outCanvas.height = 180;
        const ctx = outCanvas.getContext('2d');
        ctx.font = `72px '${typedFont}', cursive, sans-serif`;
        ctx.fillStyle = penColor;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(text, 300, 90);

        signatureDataUrl = outCanvas.toDataURL('image/png');
        signatureAspectRatio = 600 / 180;
        return true;
      } else if (activeTab === 'upload') {
        if (!uploadedRawImage || !sigUploadPreview || !sigUploadPreview.src) {
          showError('Please select a signature image to upload.');
          return false;
        }
        signatureDataUrl = sigUploadPreview.src;
        const w = uploadedRawImage.naturalWidth || 200;
        const h = uploadedRawImage.naturalHeight || 80;
        signatureAspectRatio = w / Math.max(1, h);
        return true;
      }
      return false;
    }

    if (proceedToPlacementBtn) {
      proceedToPlacementBtn.addEventListener('click', async () => {
        clearError();
        if (!generateFinalSignatureBlob()) return;

        if (placedSigImg) placedSigImg.src = signatureDataUrl;

        if (creatorArea) creatorArea.classList.add('is-hidden');
        if (placementArea) placementArea.classList.remove('is-hidden');

        await renderPlacementPage();
      });
    }

    if (backToSignatureBtn) {
      backToSignatureBtn.addEventListener('click', () => {
        if (placementArea) placementArea.classList.add('is-hidden');
        if (creatorArea) creatorArea.classList.remove('is-hidden');
      });
    }

    /* ==========================================================================
       STEP 3: DRAG & RESIZE PLACEMENT ON PDF PAGES
       ========================================================================== */

    async function renderPlacementPage() {
      if (!pdfJsDoc) return;
      if (currentRenderTask) {
        try { currentRenderTask.cancel(); } catch (e) {}
      }

      updatePageNav();

      const page = await pdfJsDoc.getPage(currentPageIndex + 1);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      visualPageWidth = unscaledViewport.width;
      visualPageHeight = unscaledViewport.height;

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

      updatePlacedElementsUI();
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
          await renderPlacementPage();
        }
      });
    }

    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', async () => {
        if (currentPageIndex < totalPages - 1) {
          currentPageIndex++;
          await renderPlacementPage();
        }
      });
    }

    function updatePlacedElementsUI() {
      if (!placedSig) return;
      // Clamp signature coordinates to page boundary
      sigPlacementPx.width = Math.min(sigPlacementPx.width, canvasWidth);
      sigPlacementPx.height = Math.round(sigPlacementPx.width / signatureAspectRatio);

      sigPlacementPx.x = Math.max(0, Math.min(canvasWidth - sigPlacementPx.width, sigPlacementPx.x));
      sigPlacementPx.y = Math.max(0, Math.min(canvasHeight - sigPlacementPx.height, sigPlacementPx.y));

      placedSig.style.left = `${sigPlacementPx.x}px`;
      placedSig.style.top = `${sigPlacementPx.y}px`;
      placedSig.style.width = `${sigPlacementPx.width}px`;
      placedSig.style.height = `${sigPlacementPx.height}px`;

      // Update Text Fields
      if (placedNameField) {
        placedNameField.classList.toggle('is-hidden', !nameFieldState.active);
        if (nameFieldState.active) {
          placedNameField.style.left = `${nameFieldState.x}px`;
          placedNameField.style.top = `${nameFieldState.y}px`;
          placedNameField.textContent = nameFieldState.text;
        }
      }

      if (placedDateField) {
        placedDateField.classList.toggle('is-hidden', !dateFieldState.active);
        if (dateFieldState.active) {
          placedDateField.style.left = `${dateFieldState.x}px`;
          placedDateField.style.top = `${dateFieldState.y}px`;
          placedDateField.textContent = dateFieldState.text;
        }
      }
    }

    // Interactive Dragging & Resizing for Signature Stamp
    let isMovingSig = false;
    let isResizingSig = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialSigPos = { x: 0, y: 0, w: 0, h: 0 };

    if (placedSig) {
      placedSig.addEventListener('mousedown', (e) => {
        if (e.target === sigResizeHandle) {
          isResizingSig = true;
        } else {
          isMovingSig = true;
        }
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialSigPos = { ...sigPlacementPx };
        e.preventDefault();
        window.addEventListener('mousemove', onSigDragMove);
        window.addEventListener('mouseup', onSigDragEnd);
      });

      placedSig.addEventListener('touchstart', (e) => {
        if (e.target === sigResizeHandle) {
          isResizingSig = true;
        } else {
          isMovingSig = true;
        }
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        initialSigPos = { ...sigPlacementPx };
        e.preventDefault();
        window.addEventListener('touchmove', onSigDragMove, { passive: false });
        window.addEventListener('touchend', onSigDragEnd);
      }, { passive: false });
    }

    function onSigDragMove(e) {
      if (!isMovingSig && !isResizingSig) return;
      e.preventDefault();
      const curX = e.clientX || (e.touches && e.touches[0].clientX);
      const curY = e.clientY || (e.touches && e.touches[0].clientY);
      const dx = curX - dragStartX;
      const dy = curY - dragStartY;

      if (isMovingSig) {
        // Clamp strictly within canvas boundary so signature never leaves the page
        const newX = Math.max(0, Math.min(canvasWidth - initialSigPos.width, initialSigPos.x + dx));
        const newY = Math.max(0, Math.min(canvasHeight - initialSigPos.height, initialSigPos.y + dy));
        sigPlacementPx.x = newX;
        sigPlacementPx.y = newY;
      } else if (isResizingSig) {
        const minW = 40;
        const maxW = canvasWidth - initialSigPos.x;
        const newW = Math.max(minW, Math.min(maxW, initialSigPos.w + dx));
        const newH = Math.round(newW / signatureAspectRatio);

        if (initialSigPos.y + newH <= canvasHeight) {
          sigPlacementPx.width = newW;
          sigPlacementPx.height = newH;
        }
      }

      updatePlacedElementsUI();
    }

    function onSigDragEnd() {
      isMovingSig = false;
      isResizingSig = false;
      window.removeEventListener('mousemove', onSigDragMove);
      window.removeEventListener('mouseup', onSigDragEnd);
      window.removeEventListener('touchmove', onSigDragMove);
      window.removeEventListener('touchend', onSigDragEnd);
    }

    // Draggable Text Fields (Name & Date)
    function setupDraggableField(el, state) {
      if (!el) return;
      let isDragging = false;
      let startX = 0, startY = 0, initX = 0, initY = 0;

      const onStart = (e) => {
        isDragging = true;
        startX = e.clientX || (e.touches && e.touches[0].clientX);
        startY = e.clientY || (e.touches && e.touches[0].clientY);
        initX = state.x;
        initY = state.y;
        e.preventDefault();
        e.stopPropagation();

        const onMove = (ev) => {
          if (!isDragging) return;
          ev.preventDefault();
          const cx = ev.clientX || (ev.touches && ev.touches[0].clientX);
          const cy = ev.clientY || (ev.touches && ev.touches[0].clientY);
          const elW = el.offsetWidth || 100;
          const elH = el.offsetHeight || 30;

          state.x = Math.max(0, Math.min(canvasWidth - elW, initX + (cx - startX)));
          state.y = Math.max(0, Math.min(canvasHeight - elH, initY + (cy - startY)));
          el.style.left = `${state.x}px`;
          el.style.top = `${state.y}px`;
        };

        const onEnd = () => {
          isDragging = false;
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onEnd);
          window.removeEventListener('touchmove', onMove);
          window.removeEventListener('touchend', onEnd);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
      };

      el.addEventListener('mousedown', onStart);
      el.addEventListener('touchstart', onStart, { passive: false });
    }

    setupDraggableField(placedNameField, nameFieldState);
    setupDraggableField(placedDateField, dateFieldState);

    if (addNameFieldBtn) {
      addNameFieldBtn.addEventListener('click', () => {
        nameFieldState.active = !nameFieldState.active;
        nameFieldState.text = (typeNameInput && typeNameInput.value.trim()) || 'Full Name';
        updatePlacedElementsUI();
      });
    }

    if (addDateFieldBtn) {
      addDateFieldBtn.addEventListener('click', () => {
        dateFieldState.active = !dateFieldState.active;
        const now = new Date();
        dateFieldState.text = now.toISOString().split('T')[0];
        updatePlacedElementsUI();
      });
    }

    if (sigScopeSelect && sigPageRangeGroup) {
      sigScopeSelect.addEventListener('change', () => {
        sigPageRangeGroup.classList.toggle('is-hidden', sigScopeSelect.value !== 'range');
      });
    }

    /* ==========================================================================
       EXPORT & DOWNLOAD WITH PDF-LIB (EXACT ROTATION & OFFSET MAPPING)
       ========================================================================== */

    function getPdfPlacementForVisualRect(page, vx, vy, vw, vh) {
      const crop = page.getCropBox() || page.getMediaBox();
      const cropX = crop.x;
      const cropY = crop.y;
      const W = crop.width;
      const H = crop.height;
      const rot = ((page.getRotation().angle % 360) + 360) % 360;

      let x = cropX;
      let y = cropY;
      let width = vw;
      let height = vh;
      let rotateAngle = 0;

      if (rot === 0) {
        x = cropX + vx;
        y = cropY + H - vy - vh;
        width = vw;
        height = vh;
        rotateAngle = 0;
      } else if (rot === 90) {
        // Visual width = H, Visual height = W
        x = cropX + W - vy - vh;
        y = cropY + vx + vw;
        width = vw;
        height = vh;
        rotateAngle = 270; // 270 deg CCW
      } else if (rot === 180) {
        x = cropX + W - vx;
        y = cropY + vy + vh;
        width = vw;
        height = vh;
        rotateAngle = 180;
      } else if (rot === 270) {
        x = cropX + vy + vh;
        y = cropY + H - vx - vw;
        width = vw;
        height = vh;
        rotateAngle = 90;
      }

      return { x, y, width, height, rotateAngle };
    }

    async function executeSignatureExport() {
      if (actionExecuteBtn) {
        actionExecuteBtn.disabled = true;
        actionExecuteBtn.textContent = 'Signing PDF...';
      }

      try {
        const sigPngImage = await pdfLibDoc.embedPng(signatureDataUrl);
        const standardFont = await pdfLibDoc.embedFont(window.PDFLib.StandardFonts.Helvetica);

        // Convert signature visual coords from screen px to visual PDF pt
        const sigVisualX = sigPlacementPx.x / renderScale;
        const sigVisualY = sigPlacementPx.y / renderScale;
        const sigVisualW = sigPlacementPx.width / renderScale;
        const sigVisualH = sigPlacementPx.height / renderScale;

        // Scope determination
        const scope = sigScopeSelect ? sigScopeSelect.value : 'current';
        let targetPages = new Set();
        if (scope === 'current') {
          targetPages.add(currentPageIndex);
        } else if (scope === 'all') {
          for (let i = 0; i < totalPages; i++) targetPages.add(i);
        } else if (scope === 'last') {
          targetPages.add(totalPages - 1);
        } else if (scope === 'range') {
          const parts = (sigPageRangeInput ? sigPageRangeInput.value : '').split(',');
          parts.forEach(p => {
            const num = parseInt(p.trim(), 10);
            if (!isNaN(num) && num >= 1 && num <= totalPages) targetPages.add(num - 1);
          });
          if (targetPages.size === 0) targetPages.add(currentPageIndex);
        }

        const libPages = pdfLibDoc.getPages();

        targetPages.forEach(pIdx => {
          const page = libPages[pIdx];
          const pos = getPdfPlacementForVisualRect(page, sigVisualX, sigVisualY, sigVisualW, sigVisualH);

          page.drawImage(sigPngImage, {
            x: pos.x,
            y: pos.y,
            width: pos.width,
            height: pos.height,
            rotate: window.PDFLib.degrees(pos.rotateAngle)
          });

          // Draw selectable vector name field
          if (nameFieldState.active) {
            const nameVisualX = nameFieldState.x / renderScale;
            const nameVisualY = nameFieldState.y / renderScale;
            const namePos = getPdfPlacementForVisualRect(page, nameVisualX, nameVisualY, 150, 20);

            page.drawText(nameFieldState.text, {
              x: namePos.x,
              y: namePos.y,
              size: nameFieldState.fontSize,
              font: standardFont,
              color: window.PDFLib.rgb(0, 0, 0),
              rotate: window.PDFLib.degrees(namePos.rotateAngle)
            });
          }

          // Draw selectable vector date field
          if (dateFieldState.active) {
            const dateVisualX = dateFieldState.x / renderScale;
            const dateVisualY = dateFieldState.y / renderScale;
            const datePos = getPdfPlacementForVisualRect(page, dateVisualX, dateVisualY, 150, 20);

            page.drawText(dateFieldState.text, {
              x: datePos.x,
              y: datePos.y,
              size: dateFieldState.fontSize,
              font: standardFont,
              color: window.PDFLib.rgb(0, 0, 0),
              rotate: window.PDFLib.degrees(datePos.rotateAngle)
            });
          }
        });

        const exportPdfBytes = await pdfLibDoc.save();
        finalDownloadBlob = new Blob([exportPdfBytes], { type: 'application/pdf' });
        if (finalDownloadUrl) URL.revokeObjectURL(finalDownloadUrl);
        finalDownloadUrl = URL.createObjectURL(finalDownloadBlob);

        if (resultPageCountEl) resultPageCountEl.textContent = `${totalPages} pages`;
        if (resultFileSizeEl) {
          resultFileSizeEl.textContent = window.formatBytes ? window.formatBytes(finalDownloadBlob.size) : `${Math.round(finalDownloadBlob.size / 1024)} KB`;
        }

        if (placementArea) placementArea.classList.add('is-hidden');
        if (resultArea) resultArea.classList.remove('is-hidden');
        setStep(3);
      } catch (err) {
        showError(err.message || 'An error occurred while signing the PDF.');
      } finally {
        if (actionExecuteBtn) {
          actionExecuteBtn.disabled = false;
          actionExecuteBtn.textContent = 'Save & Download Signed PDF';
        }
      }
    }

    if (actionExecuteBtn) actionExecuteBtn.addEventListener('click', executeSignatureExport);

    if (resultDownloadBtn) {
      resultDownloadBtn.addEventListener('click', () => {
        if (!finalDownloadBlob) return;
        const fileName = `${originalBaseName}-signed.pdf`;
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
