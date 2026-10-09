/**
 * FileShrink - Images to PDF Tool Engine (js/images-to-pdf-tool.js)
 * Convert multiple photos to PDF with reordering, rotation, page sizes, and size limits
 */

(function () {
  'use strict';

  window.initImagesToPdfTool = function () {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadArea = document.getElementById('uploadArea');
    const processingArea = document.getElementById('processingArea');
    const processingStatus = document.getElementById('processingStatus');
    const resultArea = document.getElementById('resultArea');
    const errorArea = document.getElementById('errorArea');
    const errorMessage = document.getElementById('errorMessage');

    const fileListEl = document.getElementById('imagesFileList');
    const addMoreBtn = document.getElementById('addMoreBtn');
    const generatePdfBtn = document.getElementById('generatePdfBtn');
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    const marginSelect = document.getElementById('marginSelect');
    const targetKbInput = document.getElementById('targetKbInput');
    const quickKbBtns = document.querySelectorAll('.quick-kb-btn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const resetBtn = document.getElementById('resetBtn');
    const finalSizeLabel = document.getElementById('finalPdfSize');

    // Step indicators
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    let imageItems = []; // Array of { file, name, size, rotation (0, 90, 180, 270), url, imgElement }
    let generatedPdfBlob = null;

    function setStep(step) {
      if (step1) step1.className = 'step-item' + (step === 1 ? ' active' : (step > 1 ? ' completed' : ''));
      if (step2) step2.className = 'step-item' + (step === 2 ? ' active' : (step > 2 ? ' completed' : ''));
      if (step3) step3.className = 'step-item' + (step === 3 ? ' active' : '');
    }

    function resetTool() {
      if (fileInput) fileInput.value = '';
      imageItems.forEach(i => { if (i.url) URL.revokeObjectURL(i.url); });
      imageItems = [];
      generatedPdfBlob = null;
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

    function renderImageList() {
      if (!fileListEl) return;
      fileListEl.innerHTML = '';

      if (imageItems.length === 0) {
        resetTool();
        return;
      }

      imageItems.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'file-item-card';
        card.innerHTML = `
          <div class="file-item-left">
            <img src="${item.url}" alt="${item.name}" class="file-item-thumb" style="transform: rotate(${item.rotation}deg);">
            <div class="file-item-info">
              <div class="file-item-name">${item.name}</div>
              <div class="file-item-meta">${window.formatBytes(item.size)} &bull; Rotation: ${item.rotation}&deg;</div>
            </div>
          </div>
          <div class="file-item-actions">
            <button type="button" class="btn-icon btn-rotate" title="Rotate 90&deg;">&#8635;</button>
            <button type="button" class="btn-icon btn-move move-up" title="Move Up" ${index === 0 ? 'disabled' : ''}>&uarr;</button>
            <button type="button" class="btn-icon btn-move move-down" title="Move Down" ${index === imageItems.length - 1 ? 'disabled' : ''}>&darr;</button>
            <button type="button" class="btn-icon btn-remove" title="Remove">&times;</button>
          </div>
        `;

        card.querySelector('.btn-rotate').addEventListener('click', () => {
          item.rotation = (item.rotation + 90) % 360;
          renderImageList();
        });

        card.querySelector('.move-up').addEventListener('click', () => {
          if (index > 0) {
            const tmp = imageItems[index];
            imageItems[index] = imageItems[index - 1];
            imageItems[index - 1] = tmp;
            renderImageList();
          }
        });

        card.querySelector('.move-down').addEventListener('click', () => {
          if (index < imageItems.length - 1) {
            const tmp = imageItems[index];
            imageItems[index] = imageItems[index + 1];
            imageItems[index + 1] = tmp;
            renderImageList();
          }
        });

        card.querySelector('.btn-remove').addEventListener('click', () => {
          URL.revokeObjectURL(item.url);
          imageItems.splice(index, 1);
          renderImageList();
        });

        fileListEl.appendChild(card);
      });
    }

    async function handleIncomingImages(files) {
      if (!files || files.length === 0) return;
      if (errorArea) errorArea.classList.add('is-hidden');

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!/\.(jpe?g|png|webp)$/i.test(file.name) && !file.type.startsWith('image/')) {
          continue;
        }

        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        try {
          await new Promise((res, rej) => {
            img.onload = () => res();
            img.onerror = () => rej(new Error('Image decode error'));
            img.src = objectUrl;
          });

          imageItems.push({
            file: file,
            name: file.name,
            size: file.size,
            rotation: 0,
            url: objectUrl,
            imgElement: img
          });
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          showError(`Could not load image ${file.name}`);
        }
      }

      if (imageItems.length > 0) {
        if (uploadArea) uploadArea.classList.add('is-hidden');
        if (resultArea) resultArea.classList.remove('is-hidden');
        renderImageList();
        setStep(2);
      }
    }

    // Quick target KB buttons
    if (quickKbBtns && quickKbBtns.length > 0) {
      quickKbBtns.forEach(btn => {
        btn.addEventListener('click', function () {
          const kb = this.getAttribute('data-kb');
          if (kb && targetKbInput) {
            if (targetKbInput.value === kb) {
              targetKbInput.value = '';
              quickKbBtns.forEach(b => b.classList.remove('active'));
            } else {
              targetKbInput.value = kb;
              quickKbBtns.forEach(b => b.classList.remove('active'));
              this.classList.add('active');
            }
          }
        });
      });
    }

    // Helper: draw rotated image to canvas
    function getOrientedCanvas(img, rotation, scale = 1.0) {
      const canvas = document.createElement('canvas');
      const is90or270 = rotation === 90 || rotation === 270;
      const w = is90or270 ? img.naturalHeight : img.naturalWidth;
      const h = is90or270 ? img.naturalWidth : img.naturalHeight;

      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      if (is90or270) {
        ctx.drawImage(img, -canvas.height / 2, -canvas.width / 2, canvas.height, canvas.width);
      } else {
        ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
      }
      ctx.restore();

      return canvas;
    }

    // Build PDF with optional target KB constraint
    async function createPdfFromImages() {
      if (imageItems.length === 0) {
        showError('Please upload at least one image.');
        return;
      }

      if (!window.jspdf || !window.jspdf.jsPDF) {
        showError('PDF creation library loading. Please try again.');
        return;
      }

      if (errorArea) errorArea.classList.add('is-hidden');
      if (resultArea) resultArea.classList.add('is-hidden');
      if (processingArea) processingArea.classList.remove('is-hidden');

      const isA4 = pageSizeSelect ? pageSizeSelect.value === 'a4' : false;
      const hasMargin = marginSelect ? marginSelect.value === 'small' : false;
      const marginMm = hasMargin ? 10 : 0;
      const targetKb = targetKbInput && targetKbInput.value ? parseFloat(targetKbInput.value) : null;
      const targetBytes = targetKb ? targetKb * 1024 : null;

      try {
        let bestBlob = null;
        let qualitySteps = targetBytes ? [0.92, 0.80, 0.65, 0.50, 0.35, 0.20] : [0.92];
        let scaleSteps = targetBytes ? [1.0, 0.8, 0.6, 0.4] : [1.0];

        const { jsPDF } = window.jspdf;

        outerLoop:
        for (let s of scaleSteps) {
          for (let q of qualitySteps) {
            if (processingStatus) {
              processingStatus.textContent = targetBytes ? `Optimizing quality to fit under ${targetKb} KB...` : 'Building PDF document...';
            }

            // Create fresh PDF
            const firstCanvas = getOrientedCanvas(imageItems[0].imgElement, imageItems[0].rotation, s);
            let doc;

            if (isA4) {
              doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            } else {
              const orient = firstCanvas.width >= firstCanvas.height ? 'landscape' : 'portrait';
              doc = new jsPDF({
                orientation: orient,
                unit: 'pt',
                format: [firstCanvas.width, firstCanvas.height]
              });
            }

            for (let i = 0; i < imageItems.length; i++) {
              if (i > 0) {
                if (isA4) {
                  doc.addPage('a4', 'portrait');
                } else {
                  const c = getOrientedCanvas(imageItems[i].imgElement, imageItems[i].rotation, s);
                  const orient = c.width >= c.height ? 'landscape' : 'portrait';
                  doc.addPage([c.width, c.height], orient);
                }
              }

              const canvas = getOrientedCanvas(imageItems[i].imgElement, imageItems[i].rotation, s);
              const imgData = canvas.toDataURL('image/jpeg', q);

              if (isA4) {
                const a4Width = 210 - (marginMm * 2);
                const a4Height = 297 - (marginMm * 2);
                const imgRatio = canvas.width / canvas.height;
                const pageRatio = a4Width / a4Height;

                let drawW, drawH;
                if (imgRatio > pageRatio) {
                  drawW = a4Width;
                  drawH = a4Width / imgRatio;
                } else {
                  drawH = a4Height;
                  drawW = a4Height * imgRatio;
                }
                const drawX = marginMm + (a4Width - drawW) / 2;
                const drawY = marginMm + (a4Height - drawH) / 2;
                doc.addImage(imgData, 'JPEG', drawX, drawY, drawW, drawH);
              } else {
                doc.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
              }
            }

            const pdfArray = doc.output('arraybuffer');
            const blob = new Blob([pdfArray], { type: 'application/pdf' });

            if (!targetBytes || blob.size <= targetBytes) {
              bestBlob = blob;
              break outerLoop;
            }
            bestBlob = blob;
          }
        }

        generatedPdfBlob = bestBlob;

        if (processingArea) processingArea.classList.add('is-hidden');
        if (resultArea) resultArea.classList.remove('is-hidden');

        const successCard = document.getElementById('imagesPdfSuccessCard');
        if (successCard) successCard.classList.remove('is-hidden');
        if (finalSizeLabel) finalSizeLabel.textContent = window.formatBytes(generatedPdfBlob.size);

        setStep(3);
      } catch (err) {
        if (processingArea) processingArea.classList.add('is-hidden');
        if (resultArea) resultArea.classList.remove('is-hidden');
        showError('Could not create PDF from images.');
      }
    }

    // Attach File Event Listeners
    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files.length > 0) {
          handleIncomingImages(e.target.files);
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
          handleIncomingImages(e.dataTransfer.files);
        }
      });
    }

    if (generatePdfBtn) {
      generatePdfBtn.addEventListener('click', createPdfFromImages);
    }

    if (downloadPdfBtn) {
      downloadPdfBtn.addEventListener('click', function () {
        if (generatedPdfBlob) {
          window.downloadBlob(generatedPdfBlob, 'images.pdf');
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', resetTool);
    }

    resetTool();
  };
})();
