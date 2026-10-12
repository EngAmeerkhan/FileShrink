/**
 * FileShrink - Shared Receipt Engine (/js/receipt-tool.js)
 * High-resolution 300 DPI Canvas rendering for Rent & Payment Receipts
 * Supports full RTL (Urdu & Arabic), jsPDF export, JSZip batching, and signature pad.
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. CONFIGURATION & CONSTANTS
     ========================================================================== */
  const RECEIPT_CONFIG = {
    dpi: 300,
    a4WidthPx: 2480,   // A4 at 300 DPI (210mm)
    a4HeightPx: 3508,  // A4 at 300 DPI (297mm)
    marginPx: 120,     // ~10mm border margin
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Nastaliq Urdu', 'Noto Sans Arabic', Arial, sans-serif",
    defaultCurrency: 'PKR',
    defaultNumberStyle: 'lakh'
  };

  /* ==========================================================================
     2. SETTINGS & LOCAL STORAGE (ONLY Number Style & Currency Label)
     ========================================================================== */
  function getReceiptSettings() {
    let numStyle = RECEIPT_CONFIG.defaultNumberStyle;
    let currency = RECEIPT_CONFIG.defaultCurrency;

    try {
      const sStyle = localStorage.getItem('fs_property_num_style');
      if (sStyle === 'standard' || sStyle === 'lakh') numStyle = sStyle;

      const sCurr = localStorage.getItem('fs_property_currency');
      if (['PKR', 'INR', 'USD', 'none'].includes(sCurr)) currency = sCurr;
    } catch (e) {
      // LocalStorage access restricted in private mode
    }

    return { numStyle, currency };
  }

  function saveReceiptSetting(key, val) {
    const allowed = ['fs_property_num_style', 'fs_property_currency'];
    if (!allowed.includes(key)) return;
    try {
      localStorage.setItem(key, String(val));
    } catch (e) {
      // Ignore storage errors
    }
  }

  /* ==========================================================================
     3. NUMBER & CURRENCY FORMATTERS + AMOUNT IN WORDS
     ========================================================================== */
  function formatMoneyNumber(num, style = 'lakh', currency = 'PKR', decimals = 0) {
    if (num === null || num === undefined || !Number.isFinite(num) || Number.isNaN(num)) return '0';
    const locale = style === 'lakh' ? 'en-IN' : 'en-US';
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(num * factor) / factor;
    const numStr = rounded.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    if (currency === 'none') return numStr;
    return currency + ' ' + numStr;
  }

  function getCurrencyWord(curr) {
    if (curr === 'PKR' || curr === 'INR') return 'Rupees';
    if (curr === 'USD') return 'Dollars';
    return '';
  }

  function numberToWords(num, style = 'lakh', currency = 'PKR') {
    if (num === null || num === undefined || isNaN(num)) return '';
    num = Number(num);
    const currWord = getCurrencyWord(currency);
    if (num === 0) {
      return 'Zero' + (currWord ? ' ' + currWord : '') + ' only';
    }

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function twoDigits(n) {
      if (n < 20) return ones[n];
      const t = tens[Math.floor(n / 10)];
      const o = ones[n % 10];
      return t + (o ? '-' + o : '');
    }

    function threeDigits(n) {
      const h = Math.floor(n / 100);
      const rem = n % 100;
      let res = '';
      if (h > 0) res += ones[h] + ' Hundred';
      if (rem > 0) {
        if (res) res += ' ';
        res += twoDigits(rem);
      }
      return res;
    }

    const intPart = Math.floor(Math.abs(num));
    const decPart = Math.round((Math.abs(num) - intPart) * 100);

    let words = '';

    if (style === 'lakh') {
      // Pakistani / Indian numbering (Crore, Lakh, Thousand)
      let n = intPart;
      const crore = Math.floor(n / 10000000);
      n %= 10000000;
      const lakh = Math.floor(n / 100000);
      n %= 100000;
      const thousand = Math.floor(n / 1000);
      n %= 1000;
      const remainder = n;

      const parts = [];
      if (crore > 0) parts.push((crore >= 100 ? threeDigits(crore) : twoDigits(crore)) + ' Crore');
      if (lakh > 0) parts.push(twoDigits(lakh) + ' Lakh');
      if (thousand > 0) parts.push(twoDigits(thousand) + ' Thousand');
      if (remainder > 0) parts.push(threeDigits(remainder));
      words = parts.join(' ');
    } else {
      // International numbering (Billion, Million, Thousand)
      let n = intPart;
      const billion = Math.floor(n / 1000000000);
      n %= 1000000000;
      const million = Math.floor(n / 1000000);
      n %= 1000000;
      const thousand = Math.floor(n / 1000);
      n %= 1000;
      const remainder = n;

      const parts = [];
      if (billion > 0) parts.push(threeDigits(billion) + ' Billion');
      if (million > 0) parts.push(threeDigits(million) + ' Million');
      if (thousand > 0) parts.push(threeDigits(thousand) + ' Thousand');
      if (remainder > 0) parts.push(threeDigits(remainder));
      words = parts.join(' ');
    }

    if (!words) words = 'Zero';
    if (currWord) words += ' ' + currWord;
    if (decPart > 0) words += ' and ' + decPart + '/100';

    return words + ' only';
  }

  /* ==========================================================================
     4. DATE & MONTH UTILITIES
     ========================================================================== */
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  function getDaysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function getCalculatedReceiptDate(year, monthIndex, targetDay) {
    const maxDays = getDaysInMonth(year, monthIndex);
    const actualDay = Math.min(Math.max(1, targetDay), maxDays);
    const mName = MONTH_NAMES[monthIndex];
    return `${actualDay} ${mName} ${year}`;
  }

  function generateMonthRange(startYear, startMonth, endYear, endMonth) {
    const list = [];
    let y = Number(startYear);
    let m = Number(startMonth);
    const targetY = Number(endYear);
    const targetM = Number(endMonth);

    while (y < targetY || (y === targetY && m <= targetM)) {
      list.push({ year: y, monthIndex: m, label: `${MONTH_NAMES[m]} ${y}` });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
      if (list.length >= 12) break; // Limit to maximum 12 months as per specification
    }
    return list;
  }

  /* ==========================================================================
     5. RTL (URDU & ARABIC) & CANVAS TEXT RENDERING
     ========================================================================== */
  function isRTL(text) {
    if (!text) return false;
    // Arabic, Urdu, Persian Unicode block check
    return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    if (!text) return [];
    const words = String(text).trim().split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine ? (currentLine + ' ' + words[i]) : words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = words[i];
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  /* ==========================================================================
     6. SIGNATURE PAD CONTROLLER (Draw, Upload, White BG option)
     ========================================================================== */
  function initSignaturePad(canvasEl, clearBtnEl, fileInputEl, whiteBgCheckEl, onChangeCallback) {
    if (!canvasEl) return { getImageData: () => null, clear: () => {} };

    const ctx = canvasEl.getContext('2d');
    let isDrawing = false;
    let hasDrawn = false;
    let uploadedImg = null;

    // Set canvas dimensions
    canvasEl.width = 440;
    canvasEl.height = 180;

    function resetPad() {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      hasDrawn = false;
      uploadedImg = null;
      if (fileInputEl) fileInputEl.value = '';
      if (typeof onChangeCallback === 'function') onChangeCallback();
    }

    function getPos(e) {
      const rect = canvasEl.getBoundingClientRect();
      const scaleX = canvasEl.width / rect.width;
      const scaleY = canvasEl.height / rect.height;
      let clientX = e.clientX;
      let clientY = e.clientY;

      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    function startDraw(e) {
      e.preventDefault();
      isDrawing = true;
      hasDrawn = true;
      uploadedImg = null; // Drawing overrides upload
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
    }

    function drawMove(e) {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }

    function stopDraw(e) {
      if (!isDrawing) return;
      isDrawing = false;
      if (typeof onChangeCallback === 'function') onChangeCallback();
    }

    canvasEl.addEventListener('pointerdown', startDraw);
    canvasEl.addEventListener('pointermove', drawMove);
    window.addEventListener('pointerup', stopDraw);
    canvasEl.addEventListener('touchstart', startDraw, { passive: false });
    canvasEl.addEventListener('touchmove', drawMove, { passive: false });
    window.addEventListener('touchend', stopDraw);

    if (clearBtnEl) {
      clearBtnEl.addEventListener('click', resetPad);
    }

    // Signature file upload
    if (fileInputEl) {
      fileInputEl.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (evt) {
          const img = new Image();
          img.onload = function () {
            uploadedImg = img;
            hasDrawn = true;
            ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

            // Fit image into pad keeping aspect ratio
            const scale = Math.min((canvasEl.width - 20) / img.width, (canvasEl.height - 20) / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (canvasEl.width - w) / 2;
            const y = (canvasEl.height - h) / 2;

            ctx.drawImage(img, x, y, w, h);
            if (typeof onChangeCallback === 'function') onChangeCallback();
          };
          img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    function getImage() {
      if (!hasDrawn) return null;

      // Create an offscreen canvas to process white background
      const offCanvas = document.createElement('canvas');
      offCanvas.width = canvasEl.width;
      offCanvas.height = canvasEl.height;
      const offCtx = offCanvas.getContext('2d');

      const useWhiteBg = whiteBgCheckEl ? whiteBgCheckEl.checked : true;
      if (useWhiteBg) {
        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
      }
      offCtx.drawImage(canvasEl, 0, 0);

      const outImg = new Image();
      outImg.src = offCanvas.toDataURL('image/png');
      return outImg;
    }

    return {
      getImage,
      clear: resetPad,
      hasSignature: () => hasDrawn
    };
  }

  /* ==========================================================================
     7. SHARED CANVAS DRAWING PRIMITIVES
     ========================================================================== */
  function drawReceiptBox(ctx, x, y, width, height, title, receiptNo, dateStr, showStampBox, signatureImg, signatoryName, signatoryRole = 'Landlord') {
    // Outer border with subtle double line
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, width, height);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 10, y + 10, width - 20, height - 20);

    // Header Band
    const headerHeight = 160;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x + 12, y + 12, width - 24, headerHeight);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 12 + headerHeight);
    ctx.lineTo(x + width - 12, y + 12 + headerHeight);
    ctx.stroke();

    // Title
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 64px ${RECEIPT_CONFIG.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ctx.fillText(title, x + 50, y + 105);

    // Receipt Number & Date (Top Right)
    ctx.font = `600 34px ${RECEIPT_CONFIG.fontFamily}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.fillText(`Receipt No: ${receiptNo}`, x + width - 50, y + 75);
    ctx.fillText(`Date: ${dateStr}`, x + width - 50, y + 125);

    // Optional "Stamp Here" Box (Bottom Left)
    if (showStampBox) {
      const stampW = 240;
      const stampH = 260;
      const stampX = x + 60;
      const stampY = y + height - stampH - 70;

      ctx.save();
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(stampX, stampY, stampW, stampH);
      ctx.fillStyle = '#64748b';
      ctx.font = `500 24px ${RECEIPT_CONFIG.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText('AFFIX STAMP', stampX + stampW / 2, stampY + stampH / 2 - 10);
      ctx.fillText('(IF REQUIRED)', stampX + stampW / 2, stampY + stampH / 2 + 25);
      ctx.restore();
    }

    // Signature Area (Bottom Right)
    const sigLineW = 460;
    const sigLineX = x + width - sigLineW - 60;
    const sigLineY = y + height - 100;

    // Draw signature image if present
    if (signatureImg && signatureImg.complete && signatureImg.naturalWidth > 0) {
      const sigImgH = 130;
      const sigImgW = Math.min(sigLineW - 40, (sigImgH / signatureImg.naturalHeight) * signatureImg.naturalWidth);
      ctx.drawImage(signatureImg, sigLineX + (sigLineW - sigImgW) / 2, sigLineY - sigImgH - 10, sigImgW, sigImgH);
    }

    // Signature line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sigLineX, sigLineY);
    ctx.lineTo(sigLineX + sigLineW, sigLineY);
    ctx.stroke();

    // Signatory name and label
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 30px ${RECEIPT_CONFIG.fontFamily}`;
    ctx.textAlign = 'center';
    const isNameRTL = isRTL(signatoryName);
    ctx.direction = isNameRTL ? 'rtl' : 'ltr';
    ctx.fillText(signatoryName || 'Authorized Signature', sigLineX + sigLineW / 2, sigLineY + 38);

    ctx.fillStyle = '#64748b';
    ctx.font = `500 24px ${RECEIPT_CONFIG.fontFamily}`;
    ctx.direction = 'ltr';
    ctx.fillText(`${signatoryRole} Signature`, sigLineX + sigLineW / 2, sigLineY + 70);
  }

  /* ==========================================================================
     8. RENT RECEIPT DRAWING ENGINE
     ========================================================================== */
  function renderRentReceiptPage(ctx, receiptTop, receiptBottom, showStampBox, signatureImg) {
    // Fill pure white A4 background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, RECEIPT_CONFIG.a4WidthPx, RECEIPT_CONFIG.a4HeightPx);

    const W = RECEIPT_CONFIG.a4WidthPx - (RECEIPT_CONFIG.marginPx * 2);
    const H = 1530; // Height per receipt half
    const topY = RECEIPT_CONFIG.marginPx;
    const botY = RECEIPT_CONFIG.marginPx + H + 120;

    // Draw Top Receipt
    if (receiptTop) {
      drawSingleRentReceipt(ctx, RECEIPT_CONFIG.marginPx, topY, W, H, receiptTop, showStampBox, signatureImg);
    }

    // Cut line between receipts
    if (receiptTop && receiptBottom) {
      const cutY = RECEIPT_CONFIG.marginPx + H + 60;
      ctx.save();
      ctx.setLineDash([16, 12]);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(RECEIPT_CONFIG.marginPx, cutY);
      ctx.lineTo(RECEIPT_CONFIG.marginPx + W, cutY);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 24px ${RECEIPT_CONFIG.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText('✂  CUT HERE ALONG THE LINE', RECEIPT_CONFIG.a4WidthPx / 2, cutY - 12);
      ctx.restore();
    }

    // Draw Bottom Receipt
    if (receiptBottom) {
      drawSingleRentReceipt(ctx, RECEIPT_CONFIG.marginPx, botY, W, H, receiptBottom, showStampBox, signatureImg);
    }
  }

  function drawSingleRentReceipt(ctx, x, y, width, height, data, showStampBox, signatureImg) {
    drawReceiptBox(
      ctx, x, y, width, height,
      'RENT RECEIPT',
      data.receiptNo,
      data.dateStr,
      showStampBox,
      signatureImg,
      data.landlordName,
      'Landlord'
    );

    // Period & Amount Bar
    const barY = y + 185;
    const barH = 130;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(x + 30, barY, width - 60, barH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 30, barY, width - 60, barH);

    // Period tag (Left)
    ctx.fillStyle = '#1e3a8a';
    ctx.font = `bold 38px ${RECEIPT_CONFIG.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ctx.fillText(`Rent for ${data.periodStr}`, x + 60, barY + 80);

    // Formatted Amount box (Right)
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 52px ${RECEIPT_CONFIG.fontFamily}`;
    ctx.textAlign = 'right';
    ctx.fillText(data.formattedAmount, x + width - 60, barY + 85);

    // Statement Text: "Received with thanks from ___ the sum of ___ as rent for ___ for the property at ___."
    const contentY = barY + barH + 50;
    const maxContentW = width - 100;
    ctx.fillStyle = '#1e293b';
    ctx.font = `34px ${RECEIPT_CONFIG.fontFamily}`;
    ctx.textAlign = 'left';

    // Amount words string
    const amtWordsText = data.showAmountWords && data.amountWords ? `(${data.amountWords})` : '';
    const fullStatement = `Received with thanks from ${data.tenantName} the sum of ${data.formattedAmount}${amtWordsText ? ' ' + amtWordsText : ''} as rent for ${data.periodStr} for the property at ${data.propertyAddress}.`;

    // Wrap statement gracefully
    const statementLines = wrapCanvasText(ctx, fullStatement, maxContentW);
    let curY = contentY;
    const isStatementRTL = isRTL(data.tenantName) || isRTL(data.propertyAddress);

    ctx.save();
    statementLines.forEach(line => {
      if (isStatementRTL) {
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.fillText(line, x + width - 50, curY);
      } else {
        ctx.direction = 'ltr';
        ctx.textAlign = 'left';
        ctx.fillText(line, x + 50, curY);
      }
      curY += 50;
    });
    ctx.restore();

    // Details Grid (Payment Mode, Cheque No, Landlord ID, Notes)
    curY += 30;
    const detailsBoxY = curY;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 50, detailsBoxY, width - 100, 160);

    ctx.fillStyle = '#475569';
    ctx.font = `600 28px ${RECEIPT_CONFIG.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';

    // Payment Mode
    ctx.fillText(`Payment Mode:`, x + 70, detailsBoxY + 50);
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`${data.paymentModeLabel}`, x + 310, detailsBoxY + 50);

    // Landlord CNIC / ID (if provided)
    if (data.landlordId) {
      ctx.fillStyle = '#475569';
      ctx.fillText(`Landlord ID:`, x + 800, detailsBoxY + 50);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`${data.landlordId}`, x + 1000, detailsBoxY + 50);
    }

    // Notes / Cheque reference (second row in details)
    ctx.fillStyle = '#475569';
    if (data.chequeNo) {
      ctx.fillText(`Cheque No:`, x + 70, detailsBoxY + 115);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`${data.chequeNo}`, x + 310, detailsBoxY + 115);
    } else if (data.notes) {
      ctx.fillText(`Notes:`, x + 70, detailsBoxY + 115);
      ctx.fillStyle = '#0f172a';
      const notesWrapped = wrapCanvasText(ctx, data.notes, width - 500);
      ctx.fillText(notesWrapped[0] || '', x + 200, detailsBoxY + 115);
    } else {
      ctx.fillText(`Status:`, x + 70, detailsBoxY + 115);
      ctx.fillStyle = '#166534';
      ctx.fillText(`Payment Received in Full`, x + 200, detailsBoxY + 115);
    }
  }

  /* ==========================================================================
     9. PAYMENT RECEIPT DRAWING ENGINE
     ========================================================================== */
  function renderPaymentReceiptPage(ctx, data, isDuplicateMode, showStampBox, signatureImg) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, RECEIPT_CONFIG.a4WidthPx, RECEIPT_CONFIG.a4HeightPx);

    const W = RECEIPT_CONFIG.a4WidthPx - (RECEIPT_CONFIG.marginPx * 2);

    if (isDuplicateMode) {
      // 2 Receipts on one page: Original (Top) & Duplicate (Bottom)
      const H = 1530;
      const topY = RECEIPT_CONFIG.marginPx;
      const botY = RECEIPT_CONFIG.marginPx + H + 120;

      const topData = Object.assign({}, data, { copyLabel: 'ORIGINAL / PAYER COPY' });
      drawSinglePaymentReceipt(ctx, RECEIPT_CONFIG.marginPx, topY, W, H, topData, showStampBox, signatureImg);

      // Cut line
      const cutY = RECEIPT_CONFIG.marginPx + H + 60;
      ctx.save();
      ctx.setLineDash([16, 12]);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(RECEIPT_CONFIG.marginPx, cutY);
      ctx.lineTo(RECEIPT_CONFIG.marginPx + W, cutY);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 24px ${RECEIPT_CONFIG.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText('✂  CUT HERE FOR SECOND COPY', RECEIPT_CONFIG.a4WidthPx / 2, cutY - 12);
      ctx.restore();

      const botData = Object.assign({}, data, { copyLabel: 'DUPLICATE / OFFICE COPY' });
      drawSinglePaymentReceipt(ctx, RECEIPT_CONFIG.marginPx, botY, W, H, botData, showStampBox, signatureImg);
    } else {
      // 1 Full Page / Centered Receipt
      const H = 2500;
      const startY = 500;
      const singleData = Object.assign({}, data, { copyLabel: '' });
      drawSinglePaymentReceipt(ctx, RECEIPT_CONFIG.marginPx, startY, W, H, singleData, showStampBox, signatureImg);
    }
  }

  function drawSinglePaymentReceipt(ctx, x, y, width, height, data, showStampBox, signatureImg) {
    const title = data.copyLabel ? `PAYMENT RECEIPT (${data.copyLabel})` : 'PAYMENT RECEIPT';
    drawReceiptBox(
      ctx, x, y, width, height,
      title,
      data.receiptNo,
      data.dateStr,
      showStampBox,
      signatureImg,
      data.receivedBy,
      'Authorized Receiver'
    );

    // Amount Banner
    const barY = y + 185;
    const barH = 130;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x + 30, barY, width - 60, barH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 30, barY, width - 60, barH);

    // Purpose Tag
    ctx.fillStyle = '#1e3a8a';
    ctx.font = `bold 36px ${RECEIPT_CONFIG.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ctx.fillText(`${data.presetTitle || 'Payment Receipt'}`, x + 60, barY + 80);

    // Formatted Amount
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 52px ${RECEIPT_CONFIG.fontFamily}`;
    ctx.textAlign = 'right';
    ctx.fillText(data.formattedAmount, x + width - 60, barY + 85);

    // Formal Statement
    const contentY = barY + barH + 50;
    const maxContentW = width - 100;
    ctx.fillStyle = '#1e293b';
    ctx.font = `34px ${RECEIPT_CONFIG.fontFamily}`;

    const amtWordsText = data.showAmountWords && data.amountWords ? `(${data.amountWords})` : '';
    let fullStatement = `Received with thanks from ${data.receivedFrom} the sum of ${data.formattedAmount} ${amtWordsText} on account of: ${data.purpose}.`;

    if (data.preset === 'token' && data.tokenTowards) {
      fullStatement += ` This is a token amount towards ${data.tokenTowards}.`;
    }

    const statementLines = wrapCanvasText(ctx, fullStatement, maxContentW);
    let curY = contentY;
    const isStatementRTL = isRTL(data.receivedFrom) || isRTL(data.purpose);

    ctx.save();
    statementLines.forEach(line => {
      if (isStatementRTL) {
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.fillText(line, x + width - 50, curY);
      } else {
        ctx.direction = 'ltr';
        ctx.textAlign = 'left';
        ctx.fillText(line, x + 50, curY);
      }
      curY += 50;
    });
    ctx.restore();

    // Part Payment Breakdown Table (if Part Payment preset)
    if (data.preset === 'part' && data.totalAgreed > 0) {
      curY += 20;
      const tableH = 120;
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(x + 50, curY, width - 100, tableH);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 50, curY, width - 100, tableH);

      const colW = (width - 100) / 3;
      ctx.textAlign = 'center';
      ctx.direction = 'ltr';

      // Header labels
      ctx.fillStyle = '#64748b';
      ctx.font = `600 24px ${RECEIPT_CONFIG.fontFamily}`;
      ctx.fillText('TOTAL AGREED AMOUNT', x + 50 + colW * 0.5, curY + 45);
      ctx.fillText('AMOUNT PAID NOW', x + 50 + colW * 1.5, curY + 45);
      ctx.fillText('REMAINING BALANCE', x + 50 + colW * 2.5, curY + 45);

      // Values
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 32px ${RECEIPT_CONFIG.fontFamily}`;
      ctx.fillText(data.formattedTotalAgreed, x + 50 + colW * 0.5, curY + 95);
      ctx.fillText(data.formattedAmount, x + 50 + colW * 1.5, curY + 95);

      ctx.fillStyle = data.balanceDue < 0 ? '#b91c1c' : '#1e3a8a';
      ctx.fillText(data.formattedBalanceDue, x + 50 + colW * 2.5, curY + 95);

      curY += tableH + 10;
    }

    // Payment Mode & Reference Row
    curY += 25;
    const detailsBoxY = curY;
    const detailsBoxH = 140;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 50, detailsBoxY, width - 100, detailsBoxH);

    ctx.fillStyle = '#475569';
    ctx.font = `600 28px ${RECEIPT_CONFIG.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';

    ctx.fillText(`Payment Mode:`, x + 70, detailsBoxY + 50);
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`${data.paymentModeLabel}`, x + 310, detailsBoxY + 50);

    if (data.referenceNo) {
      ctx.fillStyle = '#475569';
      ctx.fillText(`Reference / Cheque:`, x + 700, detailsBoxY + 50);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`${data.referenceNo}`, x + 1020, detailsBoxY + 50);
    }

    ctx.fillStyle = '#475569';
    ctx.fillText(`Received By:`, x + 70, detailsBoxY + 105);
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`${data.receivedBy}`, x + 310, detailsBoxY + 105);
  }

  /* ==========================================================================
     10. PDF & IMAGE EXPORT PIPELINE (jsPDF, JSZip, Print)
     ========================================================================== */
  function exportCanvasesToPdf(canvasList, filename = 'receipt.pdf') {
    if (!canvasList || canvasList.length === 0) return;
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('jsPDF library is loading. Please try again in a moment.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    canvasList.forEach((canvas, idx) => {
      if (idx > 0) pdf.addPage('a4', 'portrait');
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    });

    pdf.save(filename);
  }

  function exportCanvasesToJpg(canvasList, baseFilename = 'receipt') {
    if (!canvasList || canvasList.length === 0) return;

    if (canvasList.length === 1) {
      // Single page: direct JPG download
      const canvas = canvasList[0];
      canvas.toBlob(blob => {
        if (typeof window.downloadBlob === 'function') {
          window.downloadBlob(blob, `${baseFilename}.jpg`, 'image/jpeg');
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${baseFilename}.jpg`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/jpeg', 0.95);
      return;
    }

    // Multiple pages: ZIP package using JSZip
    if (typeof window.JSZip !== 'function') {
      alert('JSZip library is loading. Please try again in a moment.');
      return;
    }

    const zip = new window.JSZip();
    let processed = 0;

    canvasList.forEach((canvas, idx) => {
      canvas.toBlob(blob => {
        zip.file(`${baseFilename}-page-${idx + 1}.jpg`, blob);
        processed++;
        if (processed === canvasList.length) {
          zip.generateAsync({ type: 'blob' }).then(zipBlob => {
            if (typeof window.downloadBlob === 'function') {
              window.downloadBlob(zipBlob, `${baseFilename}-all-pages.zip`, 'application/zip');
            } else {
              const url = URL.createObjectURL(zipBlob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${baseFilename}-all-pages.zip`;
              a.click();
              URL.revokeObjectURL(url);
            }
          });
        }
      }, 'image/jpeg', 0.95);
    });
  }

  function printCanvases(canvasList) {
    if (!canvasList || canvasList.length === 0) return;
    const printWin = window.open('', '_blank');
    if (!printWin) {
      window.print();
      return;
    }

    let imgsHtml = '';
    canvasList.forEach(canvas => {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      imgsHtml += `<div style="page-break-after: always; width: 100%; height: 100%;"><img src="${dataUrl}" style="width: 100%; height: auto; display: block;" /></div>`;
    });

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Receipts</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; background: #fff; }
          </style>
        </head>
        <body>
          ${imgsHtml}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 1500);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  }

  /* ==========================================================================
     11. GLOBAL EXPOSURE
     ========================================================================== */
  window.ReceiptEngine = {
    RECEIPT_CONFIG,
    getReceiptSettings,
    saveReceiptSetting,
    formatMoneyNumber,
    numberToWords,
    getDaysInMonth,
    getCalculatedReceiptDate,
    generateMonthRange,
    isRTL,
    wrapCanvasText,
    initSignaturePad,
    renderRentReceiptPage,
    renderPaymentReceiptPage,
    exportCanvasesToPdf,
    exportCanvasesToJpg,
    printCanvases
  };

})();
