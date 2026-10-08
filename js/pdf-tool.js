/**
 * FileShrink - PDF Compression Engine (js/pdf-tool.js)
 * Client-side multi-page PDF rasterization & re-encoding using pdf.js and jsPDF
 */

(function () {
  'use strict';

  // Configure pdf.js worker from CDNJS
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  window.initPdfTool = function (config) {
    const targetKB = config.targetKB || 100;
    const targetBytes = targetKB * 1024;
    const suffix = config.outputSuffix || `${targetKB}kb`;

    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadArea = document.getElementById('uploadArea');
    const processingArea = document.getElementById('processingArea');
    const progressStatusEl = document.getElementById('progressStatus');
    const progressBarEl = document.getElementById('progressBar');
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');
    const errorMessage = document.getElementById('errorMessage');

    const originalSizeEl = document.getElementById('originalSize');
    const compressedSizeEl = document.getElementById('compressedSize');
    const sizeSavedEl = document.getElementById('sizeSaved');
    const pageCountEl = document.getElementById('pageCount');
    const statusNoteEl = document.getElementById('statusNote');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');

    // Step indicators
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    let currentResultBlob = null;
    let currentFileName = `document-${suffix}.pdf`;

    function setStep(step) {
      if (step1) step1.className = 'step-item' + (step === 1 ? ' active' : (step > 1 ? ' completed' : ''));
      if (step2) step2.className = 'step-item' + (step === 2 ? ' active' : (step > 2 ? ' completed' : ''));
      if (step3) step3.className = 'step-item' + (step === 3 ? ' active' : '');
    }

    function resetTool() {
      if (fileInput) fileInput.value = '';
      currentResultBlob = null;
      if (uploadArea) uploadArea.classList.remove('is-hidden');
      if (processingArea) processingArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.add('is-hidden');
      if (errorArea) errorArea.classList.add('is-hidden');
      if (statusNoteEl) statusNoteEl.classList.add('is-hidden');
      if (progressBarEl) progressBarEl.style.width = '0%';
      setStep(1);
    }

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

    function setProgress(msg, percent) {
      if (progressStatusEl) progressStatusEl.textContent = msg;
      if (progressBarEl && percent !== undefined) progressBarEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }

    // Render single PDF page to canvas with exact dimensions
    async function renderPageToCanvas(pdfDoc, pageNum, scale) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      // White background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      return { canvas, width: viewport.width, height: viewport.height, unscaledWidth: viewport.width / scale, unscaledHeight: viewport.height / scale };
    }

    // Build PDF with jsPDF preserving page orientation
    async function buildPdfBlob(pageCanvases, quality) {
      const { jsPDF } = window.jspdf;
      let doc = null;

      for (let i = 0; i < pageCanvases.length; i++) {
        const item = pageCanvases[i];
        const isLandscape = item.width > item.height;
        const orientation = isLandscape ? 'landscape' : 'portrait';

        if (i === 0) {
          doc = new jsPDF({
            orientation: orientation,
            unit: 'px',
            format: [item.width, item.height],
            compress: true
          });
        } else {
          doc.addPage([item.width, item.height], orientation);
        }

        const imgData = item.canvas.toDataURL('image/jpeg', quality);
        doc.addImage(imgData, 'JPEG', 0, 0, item.width, item.height, undefined, 'FAST');
      }

      return doc.output('blob');
    }

    // Main PDF Compression Routine
    async function compressPdf(file) {
      const originalBytes = file.size;
      const originalBaseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      currentFileName = `${originalBaseName}-${suffix}.pdf`;

      if (originalBytes <= targetBytes) {
        currentResultBlob = file;
        showSuccessResult(file, originalBytes, originalBytes, true, 1);
        return;
      }

      if (!window.pdfjsLib || !window.jspdf) {
        showError('PDF engine is still loading. Please try again in a few seconds.');
        return;
      }

      setProgress('Reading PDF document...', 10);
      const arrayBuffer = await file.arrayBuffer();
      let pdfDoc;

      try {
        pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      } catch (err) {
        showError('Could not read PDF. The document may be password-protected or damaged.');
        return;
      }

      const numPages = pdfDoc.numPages;
      if (numPages === 0) {
        showError('The PDF document contains no pages.');
        return;
      }

      // Loop scales from 1.5 down to 0.5 and qualities from 0.9 down to 0.1
      const scaleCandidates = [1.5, 1.2, 1.0, 0.8, 0.6, 0.5];
      const qualityCandidates = [0.9, 0.75, 0.6, 0.45, 0.3, 0.15, 0.1];
      let bestBlob = null;

      const totalSteps = scaleCandidates.length * qualityCandidates.length;
      let currentStep = 0;

      for (let sIdx = 0; sIdx < scaleCandidates.length; sIdx++) {
        const curScale = scaleCandidates[sIdx];
        
        // Render all pages for this scale
        const pageCanvases = [];
        for (let p = 1; p <= numPages; p++) {
          const pageProgressPct = 10 + Math.round(((p - 1) / numPages) * 40);
          setProgress(`Page ${p} of ${numPages}`, pageProgressPct);
          const rendered = await renderPageToCanvas(pdfDoc, p, curScale);
          pageCanvases.push(rendered);
        }

        // Test qualities with this scale
        for (let qIdx = 0; qIdx < qualityCandidates.length; qIdx++) {
          const curQuality = qualityCandidates[qIdx];
          currentStep++;
          const compressionProgressPct = 50 + Math.round((currentStep / totalSteps) * 45);
          setProgress(`Optimizing quality...`, compressionProgressPct);

          const blob = await buildPdfBlob(pageCanvases, curQuality);

          if (blob.size <= targetBytes) {
            bestBlob = blob;
            // First match at highest quality/scale under target
            break;
          }

          if (!bestBlob || blob.size < bestBlob.size) {
            bestBlob = blob;
          }
        }

        if (bestBlob && bestBlob.size <= targetBytes) {
          break;
        }
      }

      setProgress('Done!', 100);

      if (!bestBlob) {
        showError(`This PDF is too large to shrink to ${targetKB} KB. Try a larger size like 200 KB or 500 KB.`);
        return;
      }

      currentResultBlob = bestBlob;
      showSuccessResult(bestBlob, originalBytes, bestBlob.size, false, numPages);
    }

    function showSuccessResult(blob, originalSize, newSize, isAlreadySmaller, pages) {
      if (uploadArea) uploadArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.add('is-hidden');
      if (errorArea) errorArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.remove('is-hidden');

      if (originalSizeEl) originalSizeEl.textContent = window.formatBytes(originalSize);
      if (compressedSizeEl) compressedSizeEl.textContent = window.formatBytes(newSize);
      if (pageCountEl) pageCountEl.textContent = `${pages} Page${pages > 1 ? 's' : ''}`;

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
          statusNoteEl.textContent = `Your PDF is already ${window.formatBytes(originalSize)}, which is under the ${targetKB} KB target.`;
          statusNoteEl.classList.remove('is-hidden');
        } else if (newSize > targetBytes) {
          const nextTarget = targetKB === 100 ? '200 KB' : (targetKB === 200 ? '500 KB' : '1 MB');
          statusNoteEl.textContent = `Compressed to lowest possible size (${window.formatBytes(newSize)}). For an exact fit, try our ${nextTarget} tool.`;
          statusNoteEl.classList.remove('is-hidden');
        } else {
          statusNoteEl.classList.add('is-hidden');
        }
      }

      setStep(3);
    }

    function handleFile(file) {
      if (!file) return;

      if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
        showError('Please upload a valid PDF file.');
        return;
      }

      // Warn above 50 MB
      if (file.size > 50 * 1024 * 1024) {
        if (!confirm('This PDF is over 50 MB and may take 1-2 minutes on mobile devices. Continue?')) {
          return;
        }
      }

      if (errorArea) errorArea.classList.add('is-hidden');
      if (uploadArea) uploadArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.remove('is-hidden');
      setStep(2);

      setTimeout(() => {
        compressPdf(file).catch(() => {
          showError('An error occurred during PDF compression. Please try again.');
        });
      }, 50);
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
