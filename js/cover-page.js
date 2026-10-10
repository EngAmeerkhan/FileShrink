/**
 * FileShrink - Assignment Cover Page Generator Engine (/js/cover-page.js)
 * Full A4 300 DPI canvas rendering (2480 x 3508 px) with vector layout styles,
 * RTL (Urdu/Arabic) bidirectional text support, word wrapping, and PDF/JPG/Print exports.
 */

(function () {
  'use strict';

  // A4 Standard Dimensions at 300 DPI
  const A4_WIDTH = 2480;
  const A4_HEIGHT = 3508;

  // RTL Detection Regex (Arabic, Urdu, Persian, Hebrew)
  function isRTL(text) {
    if (!text) return false;
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
  }

  // Safe text cleanup
  function cleanText(val) {
    if (val === undefined || val === null) return '';
    return String(val).trim();
  }

  /* ==========================================================================
     CANVAS MULTILINE TEXT WRAPPER WITH RTL SUPPORT
     ========================================================================== */
  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, align = 'center') {
    if (!text) return y;

    const rtl = isRTL(text);
    const prevAlign = ctx.textAlign;
    const prevDir = ctx.direction;

    ctx.textAlign = align;
    ctx.direction = rtl ? 'rtl' : 'ltr';

    const words = text.split(/\s+/);
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + (line ? ' ' : '') + words[n];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n];
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ctx.fillText(line, x, currentY);
      currentY += lineHeight;
    }

    ctx.textAlign = prevAlign;
    ctx.direction = prevDir;
    return currentY;
  }

  /* ==========================================================================
     CORE COVER PAGE GENERATOR
     ========================================================================== */
  function initCoverPageGenerator() {
    const canvas = document.getElementById('coverCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = A4_WIDTH;
    canvas.height = A4_HEIGHT;

    // Form Inputs
    const institutionInput = document.getElementById('institutionInput');
    const departmentInput = document.getElementById('departmentInput');
    const courseInput = document.getElementById('courseInput');
    const assignmentTitleInput = document.getElementById('assignmentTitleInput');
    const studentNameInput = document.getElementById('studentNameInput');
    const rollNoInput = document.getElementById('rollNoInput');
    const sectionInput = document.getElementById('sectionInput');
    const teacherInput = document.getElementById('teacherInput');
    const dateInput = document.getElementById('dateInput');
    const logoInput = document.getElementById('logoInput');
    const removeLogoBtn = document.getElementById('removeLogoBtn');
    const logoPreviewThumb = document.getElementById('logoPreviewThumb');

    // Controls
    const layoutBtns = document.querySelectorAll('.cover-layout-btn');
    const colorSwatches = document.querySelectorAll('.color-swatch');
    const customColorInput = document.getElementById('customColorInput');
    const fontSelect = document.getElementById('fontSelect');

    // Buttons
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const downloadJpgBtn = document.getElementById('downloadJpgBtn');
    const printBtn = document.getElementById('printBtn');

    // State
    let currentLayout = 'classic'; // 'classic' | 'modern' | 'minimal' | 'bordered'
    let currentAccent = '#1e3a8a'; // default navy
    let currentFont = 'serif'; // 'serif' | 'sans-serif' | 'mono'
    let loadedLogoImg = null;

    // Default Date to Today (YYYY-MM-DD)
    if (dateInput && !dateInput.value) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      dateInput.value = `${yyyy}-${mm}-${dd}`;
    }

    // Font Family Mapping
    function getFontFamily(fontKey) {
      if (fontKey === 'sans-serif') {
        return '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
      } else if (fontKey === 'mono') {
        return '"Courier New", Courier, monospace';
      }
      return '"Times New Roman", Times, Georgia, serif';
    }

    // Handle Logo Upload & Resize
    if (logoInput) {
      logoInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (evt) {
          const img = new Image();
          img.onload = function () {
            // Scale down if oversized (max dimension 700px)
            const maxDim = 700;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              const ratio = Math.min(maxDim / w, maxDim / h);
              w = Math.round(w * ratio);
              h = Math.round(h * ratio);
            }
            const downCanvas = document.createElement('canvas');
            downCanvas.width = w;
            downCanvas.height = h;
            const downCtx = downCanvas.getContext('2d');
            downCtx.drawImage(img, 0, 0, w, h);

            const scaledImg = new Image();
            scaledImg.onload = function () {
              loadedLogoImg = scaledImg;
              if (logoPreviewThumb) {
                logoPreviewThumb.src = downCanvas.toDataURL('image/png');
                logoPreviewThumb.classList.add('has-image');
              }
              if (removeLogoBtn) removeLogoBtn.style.display = 'inline-flex';
              renderCanvas();
            };
            scaledImg.src = downCanvas.toDataURL('image/png');
          };
          img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    if (removeLogoBtn) {
      removeLogoBtn.addEventListener('click', function () {
        loadedLogoImg = null;
        if (logoInput) logoInput.value = '';
        if (logoPreviewThumb) {
          logoPreviewThumb.src = '';
          logoPreviewThumb.classList.remove('has-image');
        }
        removeLogoBtn.style.display = 'none';
        renderCanvas();
      });
    }

    // Layout Buttons
    layoutBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        layoutBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentLayout = this.getAttribute('data-layout');
        renderCanvas();
      });
    });

    // Color Swatches
    colorSwatches.forEach(swatch => {
      swatch.addEventListener('click', function () {
        colorSwatches.forEach(s => s.classList.remove('active'));
        this.classList.add('active');
        currentAccent = this.getAttribute('data-color');
        if (customColorInput) customColorInput.value = currentAccent;
        renderCanvas();
      });
    });

    if (customColorInput) {
      customColorInput.addEventListener('input', function () {
        currentAccent = this.value;
        colorSwatches.forEach(s => s.classList.remove('active'));
        renderCanvas();
      });
    }

    // Font Select
    if (fontSelect) {
      fontSelect.addEventListener('change', function () {
        currentFont = this.value;
        renderCanvas();
      });
    }

    // Input Listeners
    const allTextInputs = [
      institutionInput, departmentInput, courseInput, assignmentTitleInput,
      studentNameInput, rollNoInput, sectionInput, teacherInput, dateInput
    ];
    allTextInputs.forEach(inp => {
      if (inp) {
        inp.addEventListener('input', renderCanvas);
      }
    });

    /* ==========================================================================
       CANVAS RENDERING LOGIC
       ========================================================================== */
    function renderCanvas() {
      const family = getFontFamily(currentFont);
      const accent = currentAccent;

      const institution = cleanText(institutionInput ? institutionInput.value : '');
      const department = cleanText(departmentInput ? departmentInput.value : '');
      const course = cleanText(courseInput ? courseInput.value : '');
      const assignmentTitle = cleanText(assignmentTitleInput ? assignmentTitleInput.value : '');
      const studentName = cleanText(studentNameInput ? studentNameInput.value : '');
      const rollNo = cleanText(rollNoInput ? rollNoInput.value : '');
      const section = cleanText(sectionInput ? sectionInput.value : '');
      const teacher = cleanText(teacherInput ? teacherInput.value : '');
      const dateVal = cleanText(dateInput ? dateInput.value : '');

      // 1. Clear background (Pure White)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

      // 2. Render Selected Layout
      if (currentLayout === 'modern') {
        renderModernLayout();
      } else if (currentLayout === 'minimal') {
        renderMinimalLayout();
      } else if (currentLayout === 'bordered') {
        renderBorderedLayout();
      } else {
        renderClassicLayout();
      }

      /* ----------------------------------------------------
         LAYOUT 1: CLASSIC
         ---------------------------------------------------- */
      function renderClassicLayout() {
        let cursorY = 240;

        // Institution Header
        if (institution) {
          ctx.fillStyle = accent;
          ctx.font = `bold 68px ${family}`;
          cursorY = drawWrappedText(ctx, institution, A4_WIDTH / 2, cursorY, 2000, 90, 'center');
          cursorY += 10;
        }

        // Department
        if (department) {
          ctx.fillStyle = '#475569';
          ctx.font = `500 48px ${family}`;
          cursorY = drawWrappedText(ctx, department, A4_WIDTH / 2, cursorY, 1900, 70, 'center');
          cursorY += 20;
        }

        // Optional Logo
        if (loadedLogoImg) {
          const maxLogoH = 340;
          const maxLogoW = 340;
          const ratio = Math.min(maxLogoW / loadedLogoImg.width, maxLogoH / loadedLogoImg.height);
          const lw = loadedLogoImg.width * ratio;
          const lh = loadedLogoImg.height * ratio;
          const lx = (A4_WIDTH - lw) / 2;
          ctx.drawImage(loadedLogoImg, lx, cursorY + 20, lw, lh);
          cursorY += lh + 60;
        } else {
          cursorY += 120;
        }

        // Decorative Accent Rule
        ctx.strokeStyle = accent;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo((A4_WIDTH / 2) - 200, cursorY);
        ctx.lineTo((A4_WIDTH / 2) + 200, cursorY);
        ctx.stroke();
        cursorY += 120;

        // Course Info
        if (course) {
          ctx.fillStyle = '#1e293b';
          ctx.font = `bold 52px ${family}`;
          cursorY = drawWrappedText(ctx, course, A4_WIDTH / 2, cursorY, 1900, 75, 'center');
          cursorY += 40;
        }

        // Assignment Title / Number
        if (assignmentTitle) {
          ctx.fillStyle = accent;
          ctx.font = `bold 82px ${family}`;
          cursorY = drawWrappedText(ctx, assignmentTitle, A4_WIDTH / 2, cursorY, 2000, 110, 'center');
          cursorY += 60;
        }

        // Details Panel (Submitted By / To)
        const detailsBoxY = Math.max(cursorY + 60, 2050);
        renderTwoColumnDetails(detailsBoxY, 1900, 'center');

        // Date at bottom
        if (dateVal) {
          ctx.fillStyle = '#64748b';
          ctx.font = `44px ${family}`;
          ctx.textAlign = 'center';
          ctx.fillText(`Date: ${dateVal}`, A4_WIDTH / 2, 3260);
        }
      }

      /* ----------------------------------------------------
         LAYOUT 2: MODERN
         ---------------------------------------------------- */
      function renderModernLayout() {
        // Top Modern Color Banner
        ctx.fillStyle = accent;
        ctx.fillRect(0, 0, A4_WIDTH, 480);

        let bannerTextY = 220;
        if (institution) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold 72px ${family}`;
          bannerTextY = drawWrappedText(ctx, institution, 180, bannerTextY, 2100, 90, 'left');
        }
        if (department) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = `500 48px ${family}`;
          drawWrappedText(ctx, department, 180, bannerTextY + 10, 2100, 65, 'left');
        }

        let cursorY = 680;

        // Logo
        if (loadedLogoImg) {
          const maxLogoH = 300;
          const maxLogoW = 300;
          const ratio = Math.min(maxLogoW / loadedLogoImg.width, maxLogoH / loadedLogoImg.height);
          const lw = loadedLogoImg.width * ratio;
          const lh = loadedLogoImg.height * ratio;
          ctx.drawImage(loadedLogoImg, 180, cursorY, lw, lh);
          cursorY += lh + 60;
        }

        // Left Vertical Color Bar
        ctx.fillStyle = accent;
        ctx.fillRect(180, cursorY, 16, 320);

        // Course & Assignment Title
        let titleBlockY = cursorY + 70;
        if (course) {
          ctx.fillStyle = '#64748b';
          ctx.font = `bold 48px ${family}`;
          titleBlockY = drawWrappedText(ctx, course, 230, titleBlockY, 2000, 65, 'left');
          titleBlockY += 20;
        }

        if (assignmentTitle) {
          ctx.fillStyle = '#0f172a';
          ctx.font = `bold 86px ${family}`;
          titleBlockY = drawWrappedText(ctx, assignmentTitle, 230, titleBlockY, 2000, 115, 'left');
        }

        // Modern Card Container for Details
        const cardY = 2000;
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(180, cardY, A4_WIDTH - 360, 1050, [24]);
        ctx.fill();
        ctx.stroke();

        renderTwoColumnDetails(cardY + 120, A4_WIDTH - 360, 'card');

        // Date
        if (dateVal) {
          ctx.fillStyle = '#64748b';
          ctx.font = `44px ${family}`;
          ctx.textAlign = 'right';
          ctx.fillText(`Date: ${dateVal}`, A4_WIDTH - 240, cardY + 960);
        }
      }

      /* ----------------------------------------------------
         LAYOUT 3: MINIMAL
         ---------------------------------------------------- */
      function renderMinimalLayout() {
        let cursorY = 400;

        // Logo if present
        if (loadedLogoImg) {
          const maxLogoH = 260;
          const maxLogoW = 260;
          const ratio = Math.min(maxLogoW / loadedLogoImg.width, maxLogoH / loadedLogoImg.height);
          const lw = loadedLogoImg.width * ratio;
          const lh = loadedLogoImg.height * ratio;
          ctx.drawImage(loadedLogoImg, 220, cursorY, lw, lh);
          cursorY += lh + 80;
        }

        // Institution & Department
        if (institution) {
          ctx.fillStyle = '#0f172a';
          ctx.font = `600 58px ${family}`;
          cursorY = drawWrappedText(ctx, institution, 220, cursorY, 2000, 80, 'left');
          cursorY += 10;
        }
        if (department) {
          ctx.fillStyle = '#64748b';
          ctx.font = `44px ${family}`;
          cursorY = drawWrappedText(ctx, department, 220, cursorY, 2000, 65, 'left');
          cursorY += 80;
        }

        // Thin Minimal Accent Rule
        ctx.strokeStyle = accent;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(220, cursorY);
        ctx.lineTo(A4_WIDTH - 220, cursorY);
        ctx.stroke();
        cursorY += 140;

        // Assignment Title
        if (assignmentTitle) {
          ctx.fillStyle = accent;
          ctx.font = `bold 92px ${family}`;
          cursorY = drawWrappedText(ctx, assignmentTitle, 220, cursorY, 2000, 120, 'left');
          cursorY += 20;
        }

        if (course) {
          ctx.fillStyle = '#334155';
          ctx.font = `bold 52px ${family}`;
          cursorY = drawWrappedText(ctx, course, 220, cursorY, 2000, 75, 'left');
        }

        // Details at bottom left/right
        const detailsY = Math.max(cursorY + 120, 2150);
        renderTwoColumnDetails(detailsY, 2000, 'minimal');

        // Date
        if (dateVal) {
          ctx.fillStyle = '#64748b';
          ctx.font = `44px ${family}`;
          ctx.textAlign = 'left';
          ctx.fillText(`Date: ${dateVal}`, 220, 3240);
        }
      }

      /* ----------------------------------------------------
         LAYOUT 4: BORDERED
         ---------------------------------------------------- */
      function renderBorderedLayout() {
        // Outer Framing Borders
        ctx.strokeStyle = accent;
        ctx.lineWidth = 16;
        ctx.strokeRect(100, 100, A4_WIDTH - 200, A4_HEIGHT - 200);

        ctx.strokeStyle = accent;
        ctx.lineWidth = 4;
        ctx.strokeRect(130, 130, A4_WIDTH - 260, A4_HEIGHT - 260);

        let cursorY = 320;

        // Institution Header
        if (institution) {
          ctx.fillStyle = accent;
          ctx.font = `bold 66px ${family}`;
          cursorY = drawWrappedText(ctx, institution, A4_WIDTH / 2, cursorY, 1900, 88, 'center');
          cursorY += 10;
        }

        if (department) {
          ctx.fillStyle = '#334155';
          ctx.font = `500 48px ${family}`;
          cursorY = drawWrappedText(ctx, department, A4_WIDTH / 2, cursorY, 1850, 70, 'center');
          cursorY += 20;
        }

        // Logo
        if (loadedLogoImg) {
          const maxLogoH = 320;
          const maxLogoW = 320;
          const ratio = Math.min(maxLogoW / loadedLogoImg.width, maxLogoH / loadedLogoImg.height);
          const lw = loadedLogoImg.width * ratio;
          const lh = loadedLogoImg.height * ratio;
          const lx = (A4_WIDTH - lw) / 2;
          ctx.drawImage(loadedLogoImg, lx, cursorY + 20, lw, lh);
          cursorY += lh + 60;
        } else {
          cursorY += 100;
        }

        // Center Box Framing for Assignment
        const boxTop = cursorY + 40;
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = accent;
        ctx.lineWidth = 4;
        ctx.strokeRect(300, boxTop, A4_WIDTH - 600, 480);
        ctx.fillRect(300, boxTop, A4_WIDTH - 600, 480);

        let insideBoxY = boxTop + 140;
        if (course) {
          ctx.fillStyle = '#475569';
          ctx.font = `bold 48px ${family}`;
          insideBoxY = drawWrappedText(ctx, course, A4_WIDTH / 2, insideBoxY, A4_WIDTH - 700, 70, 'center');
          insideBoxY += 20;
        }
        if (assignmentTitle) {
          ctx.fillStyle = accent;
          ctx.font = `bold 76px ${family}`;
          drawWrappedText(ctx, assignmentTitle, A4_WIDTH / 2, insideBoxY, A4_WIDTH - 700, 100, 'center');
        }

        // Details below
        renderTwoColumnDetails(boxTop + 620, 1800, 'center');

        // Date
        if (dateVal) {
          ctx.fillStyle = '#475569';
          ctx.font = `44px ${family}`;
          ctx.textAlign = 'center';
          ctx.fillText(`Date: ${dateVal}`, A4_WIDTH / 2, 3180);
        }
      }

      /* ----------------------------------------------------
         HELPER: TWO-COLUMN DETAILS RENDERING
         ---------------------------------------------------- */
      function renderTwoColumnDetails(startY, width, styleMode) {
        // Collect student items
        const studentItems = [];
        if (studentName) studentItems.push({ label: 'Name', val: studentName });
        if (rollNo) studentItems.push({ label: 'Roll / Reg No', val: rollNo });
        if (section) studentItems.push({ label: 'Section / Semester', val: section });

        // Collect teacher items
        const teacherItems = [];
        if (teacher) teacherItems.push({ label: 'Submitted To', val: teacher });

        if (studentItems.length === 0 && teacherItems.length === 0) return;

        const leftX = styleMode === 'card' ? 260 : (styleMode === 'minimal' ? 220 : 340);
        const rightX = styleMode === 'card' ? A4_WIDTH - 900 : (styleMode === 'minimal' ? A4_WIDTH - 950 : A4_WIDTH / 2 + 120);

        // 1. Submitted By Column
        let y1 = startY;
        if (studentItems.length > 0) {
          ctx.fillStyle = accent;
          ctx.font = `bold 50px ${family}`;
          ctx.textAlign = 'left';
          ctx.direction = isRTL(studentName) ? 'rtl' : 'ltr';
          ctx.fillText('Submitted By:', leftX, y1);
          y1 += 70;

          studentItems.forEach(item => {
            ctx.fillStyle = '#1e293b';
            ctx.font = `44px ${family}`;
            ctx.direction = isRTL(item.val) ? 'rtl' : 'ltr';
            drawWrappedText(ctx, `${item.label}: ${item.val}`, leftX, y1, 800, 60, 'left');
            y1 += 70;
          });
        }

        // 2. Submitted To Column
        let y2 = startY;
        if (teacherItems.length > 0) {
          ctx.fillStyle = accent;
          ctx.font = `bold 50px ${family}`;
          ctx.textAlign = 'left';
          ctx.direction = isRTL(teacher) ? 'rtl' : 'ltr';
          ctx.fillText('Submitted To:', rightX, y2);
          y2 += 70;

          teacherItems.forEach(item => {
            ctx.fillStyle = '#1e293b';
            ctx.font = `44px ${family}`;
            ctx.direction = isRTL(item.val) ? 'rtl' : 'ltr';
            drawWrappedText(ctx, `${item.val}`, rightX, y2, 800, 60, 'left');
            y2 += 70;
          });
        }
      }
    }

    // Initial render
    renderCanvas();

    /* ==========================================================================
       EXPORT HANDLERS (PDF, JPG, PRINT)
       ========================================================================== */
    // Download as PDF
    if (downloadPdfBtn) {
      downloadPdfBtn.addEventListener('click', function () {
        try {
          if (!window.jspdf || !window.jspdf.jsPDF) {
            alert('PDF library is loading. Please try again in a moment.');
            return;
          }
          const { jsPDF } = window.jspdf;
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4' // standard 210 x 297 mm
          });
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
          pdf.save('assignment-cover-page.pdf');
        } catch (e) {
          alert('Could not generate PDF: ' + e.message);
        }
      });
    }

    // Download as JPG
    if (downloadJpgBtn) {
      downloadJpgBtn.addEventListener('click', function () {
        try {
          canvas.toBlob(function (blob) {
            if (blob) {
              if (window.downloadBlob) {
                window.downloadBlob(blob, 'assignment-cover-page.jpg', 'image/jpeg');
              } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'assignment-cover-page.jpg';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 4000);
              }
            }
          }, 'image/jpeg', 0.95);
        } catch (e) {
          alert('Could not export JPG: ' + e.message);
        }
      });
    }

    // Print
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        try {
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Print Assignment Cover Page</title>
                <style>
                  @page { size: A4 portrait; margin: 0; }
                  body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; }
                  img { width: 100vw; height: auto; max-height: 100vh; object-fit: contain; }
                </style>
              </head>
              <body>
                <img src="${imgData}" onload="window.print(); window.close();" />
              </body>
              </html>
            `);
            printWindow.document.close();
          } else {
            window.print();
          }
        } catch (e) {
          window.print();
        }
      });
    }
  }

  window.initCoverPageGenerator = initCoverPageGenerator;

})();
