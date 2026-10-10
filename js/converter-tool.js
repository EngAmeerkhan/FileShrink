/**
 * FileShrink - Image Format Converter Engine (js/converter-tool.js)
 * Client-side batch image conversion with Canvas, JSZip, and HEIC support
 */

(function () {
  'use strict';

  window.initConverterTool = function (config) {
    if (!config) config = {};
    const toFormat = (config.toFormat || config.format || config.to || config.outputFormat || 'png').toLowerCase();
    const fromFormat = (config.fromFormat || config.inputFormat || config.from || 'jpeg').toLowerCase();
    const isPng = toFormat === 'png';
    const isWebp = toFormat === 'webp';
    const outputMime = isPng ? 'image/png' : (isWebp ? 'image/webp' : 'image/jpeg');
    const outputExt = isPng ? 'png' : (isWebp ? 'webp' : 'jpg');
    const defaultQuality = typeof config.quality === 'number' ? config.quality : 0.92;

    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadArea = document.getElementById('uploadArea');
    const processingArea = document.getElementById('processingArea');
    const processingText = document.getElementById('processingText');
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');
    const errorMessage = document.getElementById('errorMessage');

    const fileListEl = document.getElementById('convertedFileList');
    const singleResultCard = document.getElementById('singleResultCard');
    const singlePreviewImg = document.getElementById('singlePreviewImg');
    const singleOriginalSize = document.getElementById('singleOriginalSize');
    const singleNewSize = document.getElementById('singleNewSize');
    const singleDownloadBtn = document.getElementById('singleDownloadBtn');
    const batchZipBtn = document.getElementById('batchZipBtn');
    const resetBtn = document.getElementById('resetBtn');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValueLabel = document.getElementById('qualityValueLabel');

    // Step indicators
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    let convertedFiles = []; // Array of { blob, name, originalSize, newSize, url }
    let rawFiles = [];

    function setStep(step) {
      if (step1) step1.className = 'step-item' + (step === 1 ? ' active' : (step > 1 ? ' completed' : ''));
      if (step2) step2.className = 'step-item' + (step === 2 ? ' active' : (step > 2 ? ' completed' : ''));
      if (step3) step3.className = 'step-item' + (step === 3 ? ' active' : '');
    }

    function resetTool() {
      if (fileInput) fileInput.value = '';
      convertedFiles.forEach(f => {
        if (f.url) URL.revokeObjectURL(f.url);
      });
      convertedFiles = [];
      rawFiles = [];
      if (singlePreviewImg) singlePreviewImg.src = '';
      if (singleOriginalSize) singleOriginalSize.textContent = '0 KB';
      if (singleNewSize) singleNewSize.textContent = '0 KB';
      if (uploadArea) uploadArea.classList.remove('is-hidden');
      if (processingArea) processingArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.add('is-hidden');
      if (errorArea) errorArea.classList.add('is-hidden');
      if (fileListEl) fileListEl.innerHTML = '';
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

    function getSelectedQuality() {
      if (!qualitySlider) return defaultQuality;
      const q = parseFloat(qualitySlider.value);
      return isNaN(q) ? defaultQuality : Math.max(0.1, Math.min(1.0, q));
    }

    if (qualitySlider && qualityValueLabel) {
      qualitySlider.addEventListener('input', function () {
        qualityValueLabel.textContent = Math.round(parseFloat(this.value) * 100) + '%';
      });
    }

    // Convert HEIC file to standard blob if needed
    async function normalizeFileBlob(file) {
      if (!file || file.size === 0) {
        throw new Error(`The file "${file ? file.name : 'selected'}" is empty (0 KB). Please choose a valid image.`);
      }
      const nameLower = file.name.toLowerCase();
      if (nameLower.endsWith('.heic') || nameLower.endsWith('.heif') || file.type.includes('heic') || file.type.includes('heif')) {
        if (typeof window.heic2any !== 'function') {
          throw new Error('HEIC converter library is loading. Please try again.');
        }
        try {
          const res = await window.heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.95
          });
          return Array.isArray(res) ? res[0] : res;
        } catch (heicErr) {
          throw new Error(`Could not decode HEIC file: ${file.name}. It may be corrupted or unsupported.`);
        }
      }
      return file;
    }

    // Convert a single image file via HTML5 Canvas
    async function convertSingleFile(file, quality) {
      if (!file || file.size === 0) {
        throw new Error(`The file "${file ? file.name : 'selected'}" is empty (0 KB). Please choose a valid image.`);
      }
      const normalizedBlob = await normalizeFileBlob(file);
      const img = new Image();
      const objectUrl = URL.createObjectURL(normalizedBlob);

      try {
        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load ${file.name}. It may be corrupted or unsupported.`));
          img.src = objectUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');

        // White background for JPG conversion to prevent transparent areas from turning black
        if (outputMime === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        let blob = await new Promise(resolve => {
          if (outputMime === 'image/png') {
            // PNG does not accept quality parameter
            canvas.toBlob(b => resolve(b), 'image/png');
          } else {
            canvas.toBlob(b => resolve(b), outputMime, quality);
          }
        });

        // Browser fallback if toBlob returned null
        if (!blob) {
          try {
            const dataUrl = canvas.toDataURL(outputMime, outputMime === 'image/png' ? undefined : quality);
            const res = await fetch(dataUrl);
            blob = await res.blob();
          } catch (fbErr) {
            // ignore
          }
        }

        if (!blob) {
          throw new Error(`Failed to convert ${file.name}`);
        }

        // Guarantee strict target MIME type on the resulting Blob
        if (blob.type !== outputMime) {
          blob = new Blob([blob], { type: outputMime });
        }

        const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        const outName = `${baseName}.${outputExt}`;
        const previewUrl = URL.createObjectURL(blob);

        return {
          blob: blob,
          name: outName,
          originalSize: file.size,
          newSize: blob.size,
          url: previewUrl
        };
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }

    // Process list of files
    async function processFiles(files) {
      if (!files || files.length === 0) return;
      rawFiles = Array.from(files);

      if (errorArea) errorArea.classList.add('is-hidden');
      if (uploadArea) uploadArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.remove('is-hidden');
      setStep(2);

      const quality = getSelectedQuality();
      convertedFiles = [];

      try {
        for (let i = 0; i < rawFiles.length; i++) {
          if (processingText) {
            processingText.textContent = `Converting ${i + 1} of ${rawFiles.length}...`;
          }
          const item = await convertSingleFile(rawFiles[i], quality);
          convertedFiles.push(item);
        }
        renderResults();
      } catch (err) {
        showError(err.message || 'An error occurred during conversion.');
      }
    }

    // Render results view
    function renderResults() {
      if (processingArea) processingArea.classList.add('is-hidden');
      if (uploadArea) uploadArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.remove('is-hidden');
      setStep(3);

      if (convertedFiles.length === 1) {
        const item = convertedFiles[0];
        if (singleResultCard) singleResultCard.classList.remove('is-hidden');
        if (fileListEl) fileListEl.classList.add('is-hidden');
        if (batchZipBtn) batchZipBtn.classList.add('is-hidden');

        if (singlePreviewImg) singlePreviewImg.src = item.url;
        if (singleOriginalSize) singleOriginalSize.textContent = window.formatBytes(item.originalSize);
        if (singleNewSize) singleNewSize.textContent = window.formatBytes(item.newSize);

        if (singleDownloadBtn) {
          singleDownloadBtn.onclick = function () {
            window.downloadBlob(item.blob, item.name, outputMime);
          };
        }
      } else {
        if (singleResultCard) singleResultCard.classList.add('is-hidden');
        if (fileListEl) {
          fileListEl.classList.remove('is-hidden');
          fileListEl.innerHTML = '';

          convertedFiles.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = 'file-item-card';
            row.innerHTML = `
              <div class="file-item-left">
                <img src="${item.url}" alt="${item.name}" class="file-item-thumb">
                <div class="file-item-info">
                  <div class="file-item-name">${item.name}</div>
                  <div class="file-item-meta">${window.formatBytes(item.originalSize)} &rarr; <strong>${window.formatBytes(item.newSize)}</strong></div>
                </div>
              </div>
              <div class="file-item-actions">
                <button type="button" class="btn btn-primary btn-chip" data-idx="${idx}">Download</button>
              </div>
            `;

            row.querySelector('[data-idx]').addEventListener('click', function () {
              window.downloadBlob(item.blob, item.name, outputMime);
            });

            fileListEl.appendChild(row);
          });
        }

        if (batchZipBtn) {
          batchZipBtn.classList.remove('is-hidden');
          batchZipBtn.onclick = async function () {
            if (typeof window.JSZip !== 'function') {
              showError('ZIP library loading. Please try downloading files individually.');
              return;
            }
            batchZipBtn.disabled = true;
            const originalText = batchZipBtn.textContent;
            batchZipBtn.textContent = 'Building ZIP...';

            try {
              const zip = new window.JSZip();
              convertedFiles.forEach(f => {
                zip.file(f.name, f.blob);
              });
              const zipBlob = await zip.generateAsync({ type: 'blob' });
              window.downloadBlob(zipBlob, `converted-images.zip`);
            } catch (zErr) {
              showError('Failed to create ZIP package.');
            } finally {
              batchZipBtn.disabled = false;
              batchZipBtn.textContent = originalText;
            }
          };
        }
      }
    }

    // Attach File Event Listeners
    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files.length > 0) {
          processFiles(e.target.files);
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
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          processFiles(e.dataTransfer.files);
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', resetTool);
    }

    resetTool();
  };
})();
