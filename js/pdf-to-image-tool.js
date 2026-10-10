/**
 * FileShrink - PDF to Image Converter Engine (js/pdf-to-image-tool.js)
 * High-performance PDF page rendering to JPG / PNG with batch ZIP export
 */

(function () {
  'use strict';

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  window.initPdfToImageTool = function (config) {
    const format = (config.format || 'jpg').toLowerCase();
    const isPng = format === 'png';
    const mimeType = isPng ? 'image/png' : 'image/jpeg';
    const fileExt = isPng ? 'png' : 'jpg';

    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadArea = document.getElementById('uploadArea');
    const processingArea = document.getElementById('processingArea');
    const progressStatus = document.getElementById('progressStatus');
    const progressBar = document.getElementById('progressBar');
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');
    const errorMessage = document.getElementById('errorMessage');
    const statusNote = document.getElementById('statusNote');

    const pagesGrid = document.getElementById('pdfPagesGrid');
    const batchZipBtn = document.getElementById('batchZipBtn');
    const resetBtn = document.getElementById('resetBtn');
    const qualitySelect = document.getElementById('renderQualitySelect');

    // Step indicators
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    let renderedPages = []; // Array of { blob, name, url, pageNum }
    let currentPdfDoc = null;
    let baseFileName = 'document';

    function setStep(step) {
      if (step1) step1.className = 'step-item' + (step === 1 ? ' active' : (step > 1 ? ' completed' : ''));
      if (step2) step2.className = 'step-item' + (step === 2 ? ' active' : (step > 2 ? ' completed' : ''));
      if (step3) step3.className = 'step-item' + (step === 3 ? ' active' : '');
    }

    function resetTool() {
      if (fileInput) fileInput.value = '';
      renderedPages.forEach(p => {
        if (p.url) URL.revokeObjectURL(p.url);
      });
      renderedPages = [];
      currentPdfDoc = null;
      if (uploadArea) uploadArea.classList.remove('is-hidden');
      if (processingArea) processingArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.add('is-hidden');
      if (errorArea) errorArea.classList.add('is-hidden');
      if (statusNote) statusNote.classList.add('is-hidden');
      if (progressBar) progressBar.style.width = '0%';
      if (pagesGrid) pagesGrid.innerHTML = '';
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
      if (progressStatus) progressStatus.textContent = msg;
      if (progressBar && percent !== undefined) {
        progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
      }
    }

    async function processPdf(file) {
      if (!file) return;

      if (file.size === 0) {
        showError('The selected file is empty (0 KB). Please choose a valid PDF file.');
        return;
      }

      if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        showError('Please select a valid PDF file.');
        return;
      }

      baseFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');

      // Warn if file > 50 MB
      if (file.size > 50 * 1024 * 1024) {
        if (statusNote) {
          statusNote.textContent = 'Note: This large PDF (> 50 MB) may take longer to process on mobile devices.';
          statusNote.classList.remove('is-hidden');
        }
      } else if (statusNote) {
        statusNote.classList.add('is-hidden');
      }

      if (errorArea) errorArea.classList.add('is-hidden');
      if (uploadArea) uploadArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.remove('is-hidden');
      setStep(2);

      const isHighQuality = qualitySelect ? qualitySelect.value === 'high' : false;
      const renderScale = isHighQuality ? 2.0 : 1.5;
      const imageQuality = isHighQuality ? 0.95 : 0.85;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
        currentPdfDoc = await loadingTask.promise;
        const numPages = currentPdfDoc.numPages;

        if (numPages === 0) {
          showError('The uploaded PDF does not contain any readable pages.');
          return;
        }

        renderedPages = [];

        for (let i = 1; i <= numPages; i++) {
          setProgress(`Rendering page ${i} of ${numPages}...`, Math.round((i / numPages) * 100));

          const page = await currentPdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: renderScale });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');

          // Always fill white background
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({ canvasContext: ctx, viewport: viewport }).promise;

          let blob = await new Promise(resolve => {
            if (isPng) {
              canvas.toBlob(b => resolve(b), 'image/png');
            } else {
              canvas.toBlob(b => resolve(b), 'image/jpeg', imageQuality);
            }
          });

          if (!blob) {
            try {
              const dataUrl = canvas.toDataURL(mimeType, isPng ? undefined : imageQuality);
              const res = await fetch(dataUrl);
              blob = await res.blob();
            } catch (fbErr) {
              // ignore
            }
          }

          if (!blob) throw new Error(`Could not render page ${i}`);

          if (blob.type !== mimeType) {
            blob = new Blob([blob], { type: mimeType });
          }

          const pageFileName = `${baseFileName}-page-${i}.${fileExt}`;
          const url = URL.createObjectURL(blob);

          renderedPages.push({
            blob: blob,
            name: pageFileName,
            url: url,
            pageNum: i
          });
        }

        renderPageResults();
      } catch (err) {
        showError('Could not convert PDF. The file may be password protected or corrupted.');
      }
    }

    function renderPageResults() {
      if (processingArea) processingArea.classList.add('is-hidden');
      if (uploadArea) uploadArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.remove('is-hidden');
      setStep(3);

      if (pagesGrid) {
        pagesGrid.innerHTML = '';
        renderedPages.forEach((pageItem) => {
          const card = document.createElement('div');
          card.className = 'page-card';
          card.innerHTML = `
            <img src="${pageItem.url}" alt="Page ${pageItem.pageNum}" class="page-card-canvas">
            <div class="page-card-num">Page ${pageItem.pageNum} (${window.formatBytes(pageItem.blob.size)})</div>
            <button type="button" class="btn btn-primary btn-chip" style="margin-top:6px;width:100%;">Download</button>
          `;

          card.querySelector('button').addEventListener('click', function () {
            window.downloadBlob(pageItem.blob, pageItem.name, mimeType);
          });

          pagesGrid.appendChild(card);
        });
      }

      if (batchZipBtn) {
        if (renderedPages.length > 1) {
          batchZipBtn.classList.remove('is-hidden');
          batchZipBtn.onclick = async function () {
            if (typeof window.JSZip !== 'function') {
              showError('ZIP library loading. Please download pages individually.');
              return;
            }
            batchZipBtn.disabled = true;
            const origText = batchZipBtn.textContent;
            batchZipBtn.textContent = 'Generating ZIP...';

            try {
              const zip = new window.JSZip();
              renderedPages.forEach(p => {
                zip.file(p.name, p.blob);
              });
              const zipBlob = await zip.generateAsync({ type: 'blob' });
              window.downloadBlob(zipBlob, `${baseFileName}-pages.zip`);
            } catch (zErr) {
              showError('Failed to create ZIP package.');
            } finally {
              batchZipBtn.disabled = false;
              batchZipBtn.textContent = origText;
            }
          };
        } else {
          batchZipBtn.classList.add('is-hidden');
        }
      }
    }

    // Attach File Event Listeners
    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
          processPdf(e.target.files[0]);
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
          processPdf(e.dataTransfer.files[0]);
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', resetTool);
    }

    resetTool();
  };
})();
