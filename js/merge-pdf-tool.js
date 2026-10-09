/**
 * FileShrink - PDF Merge Engine (js/merge-pdf-tool.js)
 * High-speed vector PDF merging using pdf-lib with selectable text preservation
 */

(function () {
  'use strict';

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  window.initMergePdfTool = function () {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadArea = document.getElementById('uploadArea');
    const processingArea = document.getElementById('processingArea');
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');
    const errorMessage = document.getElementById('errorMessage');

    const fileListEl = document.getElementById('pdfFileList');
    const totalFilesLabel = document.getElementById('totalFilesLabel');
    const combinedSizeLabel = document.getElementById('combinedSizeLabel');
    const mergeBtn = document.getElementById('mergeBtn');
    const addMoreBtn = document.getElementById('addMoreBtn');
    const downloadMergedBtn = document.getElementById('downloadMergedBtn');
    const resetBtn = document.getElementById('resetBtn');

    // Step indicators
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    let pdfFiles = []; // Array of { file, name, size, pageCount, arrayBuffer }
    let mergedPdfBlob = null;

    function setStep(step) {
      if (step1) step1.className = 'step-item' + (step === 1 ? ' active' : (step > 1 ? ' completed' : ''));
      if (step2) step2.className = 'step-item' + (step === 2 ? ' active' : (step > 2 ? ' completed' : ''));
      if (step3) step3.className = 'step-item' + (step === 3 ? ' active' : '');
    }

    function resetTool() {
      if (fileInput) fileInput.value = '';
      pdfFiles = [];
      mergedPdfBlob = null;
      if (uploadArea) uploadArea.classList.remove('is-hidden');
      if (processingArea) processingArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.add('is-hidden');
      if (errorArea) errorArea.classList.add('is-hidden');
      if (fileListEl) fileListEl.innerHTML = '';
      setStep(1);
    }

    function showError(msg) {
      if (errorArea) {
        errorArea.classList.remove('is-hidden');
        if (errorMessage) errorMessage.textContent = msg;
      }
    }

    function updateSummary() {
      const totalSize = pdfFiles.reduce((acc, f) => acc + f.size, 0);
      const totalPages = pdfFiles.reduce((acc, f) => acc + (f.pageCount || 1), 0);

      if (totalFilesLabel) totalFilesLabel.textContent = `${pdfFiles.length} files (${totalPages} total pages)`;
      if (combinedSizeLabel) combinedSizeLabel.textContent = window.formatBytes(totalSize);
    }

    function renderFileList() {
      if (!fileListEl) return;
      fileListEl.innerHTML = '';

      if (pdfFiles.length === 0) {
        resetTool();
        return;
      }

      pdfFiles.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'file-item-card';
        row.draggable = true;
        row.innerHTML = `
          <div class="file-item-left">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--danger);flex-shrink:0;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <div class="file-item-info">
              <div class="file-item-name">${item.name}</div>
              <div class="file-item-meta">${item.pageCount} page(s) &bull; ${window.formatBytes(item.size)}</div>
            </div>
          </div>
          <div class="file-item-actions">
            <button type="button" class="btn-icon btn-move move-up" title="Move Up" ${index === 0 ? 'disabled' : ''}>&uarr;</button>
            <button type="button" class="btn-icon btn-move move-down" title="Move Down" ${index === pdfFiles.length - 1 ? 'disabled' : ''}>&darr;</button>
            <button type="button" class="btn-icon btn-remove" title="Remove">&times;</button>
          </div>
        `;

        // Up button
        row.querySelector('.move-up').addEventListener('click', () => {
          if (index > 0) {
            const temp = pdfFiles[index];
            pdfFiles[index] = pdfFiles[index - 1];
            pdfFiles[index - 1] = temp;
            renderFileList();
          }
        });

        // Down button
        row.querySelector('.move-down').addEventListener('click', () => {
          if (index < pdfFiles.length - 1) {
            const temp = pdfFiles[index];
            pdfFiles[index] = pdfFiles[index + 1];
            pdfFiles[index + 1] = temp;
            renderFileList();
          }
        });

        // Remove button
        row.querySelector('.btn-remove').addEventListener('click', () => {
          pdfFiles.splice(index, 1);
          renderFileList();
        });

        fileListEl.appendChild(row);
      });

      updateSummary();
    }

    async function handleIncomingFiles(files) {
      if (!files || files.length === 0) return;
      if (errorArea) errorArea.classList.add('is-hidden');

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.toLowerCase().endsWith('.pdf') && !file.type.includes('pdf')) {
          continue;
        }

        try {
          const buffer = await file.arrayBuffer();
          let pageCount = 1;
          if (window.pdfjsLib) {
            const doc = await window.pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
            pageCount = doc.numPages;
          }

          pdfFiles.push({
            file: file,
            name: file.name,
            size: file.size,
            pageCount: pageCount,
            arrayBuffer: buffer
          });
        } catch (err) {
          showError(`Could not read "${file.name}".`);
        }
      }

      if (pdfFiles.length > 0) {
        if (uploadArea) uploadArea.classList.add('is-hidden');
        if (resultArea) resultArea.classList.remove('is-hidden');
        renderFileList();
        setStep(2);
      }
    }

    async function mergePdfs() {
      if (pdfFiles.length < 2) {
        showError('Please upload at least 2 PDF files to combine.');
        return;
      }

      if (!window.PDFLib) {
        showError('PDF engine loading. Please try again.');
        return;
      }

      if (errorArea) errorArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.remove('is-hidden');

      try {
        const { PDFDocument } = window.PDFLib;
        const mergedDoc = await PDFDocument.create();

        for (let i = 0; i < pdfFiles.length; i++) {
          const srcDoc = await PDFDocument.load(pdfFiles[i].arrayBuffer);
          const pageIndices = srcDoc.getPageIndices();
          const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices);
          copiedPages.forEach(p => mergedDoc.addPage(p));
        }

        const mergedBytes = await mergedDoc.save();
        mergedPdfBlob = new Blob([mergedBytes], { type: 'application/pdf' });

        if (processingArea) processingArea.classList.add('is-hidden');
        if (resultArea) resultArea.classList.remove('is-hidden');

        const mergedSuccessCard = document.getElementById('mergedSuccessCard');
        if (mergedSuccessCard) mergedSuccessCard.classList.remove('is-hidden');
        const mergedSizeEl = document.getElementById('mergedFinalSize');
        if (mergedSizeEl) mergedSizeEl.textContent = window.formatBytes(mergedPdfBlob.size);

        setStep(3);
      } catch (err) {
        if (processingArea) processingArea.classList.add('is-hidden');
        if (resultArea) resultArea.classList.remove('is-hidden');
        showError('Failed to merge PDFs. One of the documents may be encrypted.');
      }
    }

    // Attach File Event Listeners
    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files.length > 0) {
          handleIncomingFiles(e.target.files);
        }
      });
    }

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    if (addMoreBtn && fileInput) {
      addMoreBtn.addEventListener('click', () => fileInput.click());
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
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleIncomingFiles(e.dataTransfer.files);
        }
      });
    }

    if (mergeBtn) {
      mergeBtn.addEventListener('click', mergePdfs);
    }

    if (downloadMergedBtn) {
      downloadMergedBtn.addEventListener('click', function () {
        if (mergedPdfBlob) {
          window.downloadBlob(mergedPdfBlob, 'merged.pdf');
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', resetTool);
    }

    resetTool();
  };
})();
