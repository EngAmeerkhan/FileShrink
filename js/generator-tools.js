/**
 * FileShrink - Shared Generator Tools Engine (js/generator-tools.js)
 * Clean, client-side generation for Wi-Fi QR Codes, Barcodes, and WhatsApp Links.
 * Reuses shared styles, zero tracking, zero server uploads.
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. CONFIGURATION & PLATFORM LIMITS
     ========================================================================== */
  const GENERATOR_CONFIG = {
    // Wi-Fi QR limits: IEEE 802.11 SSID max 32 octets (verify against the platform's current guidance)
    wifi: {
      maxSsidBytes: 32,
      defaultSecurity: 'WPA',
      defaultEcc: 'M',
      defaultSize: 320,
      minContrastRatio: 3.0 // WCAG minimum for graphical components
    },
    // Barcode specifications: GS1 General Specifications & ISO/IEC 15417 (verify against the platform's current guidance)
    barcode: {
      defaultType: 'CODE128',
      defaultBarWidth: 2,
      defaultHeight: 100,
      defaultMargin: 10,
      code39Regex: /^[0-9A-Z \-\.\$\/\+\%]+$/,
      code128Regex: /^[\x20-\x7E]+$/
    },
    // WhatsApp Phone Limits: ITU-T E.164 standard 7 to 15 digits (verify against the platform's current guidance)
    whatsapp: {
      minDigits: 7,
      maxDigits: 15,
      defaultCountry: '92',
      commonCountries: [
        { name: 'Pakistan (+92)', code: '92' },
        { name: 'India (+91)', code: '91' },
        { name: 'United States / Canada (+1)', code: '1' },
        { name: 'United Kingdom (+44)', code: '44' },
        { name: 'United Arab Emirates (+971)', code: '971' },
        { name: 'Saudi Arabia (+966)', code: '966' },
        { name: 'Australia (+61)', code: '61' },
        { name: 'Germany (+49)', code: '49' },
        { name: 'Malaysia (+60)', code: '60' },
        { name: 'Bangladesh (+880)', code: '880' },
        { name: 'Other (Custom Code)', code: 'other' }
      ]
    }
  };

  /* ==========================================================================
     2. SHARED HELPERS
     ========================================================================== */

  // Relative luminance and contrast calculation for accessibility check
  function hexToRgb(hex) {
    let cleanHex = hex.replace('#', '').trim();
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const num = parseInt(cleanHex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function getLuminance(rgb) {
    const a = [rgb.r, rgb.g, rgb.b].map(v => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  function getContrastRatio(hex1, hex2) {
    try {
      const l1 = getLuminance(hexToRgb(hex1));
      const l2 = getLuminance(hexToRgb(hex2));
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    } catch (e) {
      return 21; // fallback
    }
  }

  function showToastMessage(msg) {
    const existing = document.getElementById('genToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'genToast';
    toast.className = 'calc-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function triggerDownloadBlob(blob, filename) {
    if (typeof window.downloadBlob === 'function') {
      window.downloadBlob(blob, filename);
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 4000);
    }
  }


  /* ==========================================================================
     3. WI-FI QR CODE GENERATOR
     ========================================================================== */

  // Escape special characters in Wi-Fi SSID and password: \ ; , : "
  function escapeWifiField(str) {
    if (!str) return '';
    return str.replace(/([\\;,:\"])/g, '\\$1');
  }

  function buildWifiPayload(ssid, password, security, isHidden) {
    let auth = 'WPA';
    if (security === 'WEP') auth = 'WEP';
    else if (security === 'none') auth = 'nopass';

    const escapedSsid = escapeWifiField(ssid);
    let payload = `WIFI:T:${auth};S:${escapedSsid};`;

    if (security !== 'none' && password) {
      const escapedPassword = escapeWifiField(password);
      payload += `P:${escapedPassword};`;
    }

    if (isHidden) {
      payload += 'H:true;';
    }

    payload += ';';
    return payload;
  }

  function initWifiQrCodeGenerator() {
    const ssidInput = document.getElementById('wifiSsidInput');
    const passwordInput = document.getElementById('wifiPasswordInput');
    const securitySelect = document.getElementById('wifiSecuritySelect');
    const hiddenCheckbox = document.getElementById('wifiHiddenCheckbox');
    const togglePasswordBtn = document.getElementById('toggleWifiPasswordBtn');

    const qrSizeSelect = document.getElementById('wifiQrSizeSelect');
    const qrEccSelect = document.getElementById('wifiQrEccSelect');
    const qrFgColorInput = document.getElementById('wifiQrFgColor');
    const qrBgColorInput = document.getElementById('wifiQrBgColor');
    const qrMarginSelect = document.getElementById('wifiQrMarginSelect');

    const canvasEl = document.getElementById('wifiQrCanvas');
    const svgWrapEl = document.getElementById('wifiQrSvgWrap');
    const payloadTextEl = document.getElementById('wifiPayloadText');
    const contrastWarnEl = document.getElementById('wifiContrastWarn');
    const messageEl = document.getElementById('wifiMessage');

    const downloadPngBtn = document.getElementById('downloadWifiPngBtn');
    const downloadSvgBtn = document.getElementById('downloadWifiSvgBtn');
    const printBtn = document.getElementById('printWifiCardBtn');
    const copyPayloadBtn = document.getElementById('copyWifiPayloadBtn');

    if (!ssidInput || !canvasEl) return;

    let currentSvgString = '';

    // Show/hide password
    if (togglePasswordBtn && passwordInput) {
      togglePasswordBtn.addEventListener('click', () => {
        const isPassword = passwordInput.getAttribute('type') === 'password';
        passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
        togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        togglePasswordBtn.innerHTML = isPassword
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
      });
    }

    // Toggle password field disabled when security is none
    if (securitySelect) {
      securitySelect.addEventListener('change', () => {
        const isNone = securitySelect.value === 'none';
        if (passwordInput) {
          passwordInput.disabled = isNone;
          const parentGroup = passwordInput.closest('.calc-form-group');
          if (parentGroup) {
            parentGroup.style.opacity = isNone ? '0.45' : '1';
          }
        }
        renderWifiQr();
      });
    }

    function renderWifiQr() {
      const ssid = ssidInput.value.trim();
      const password = passwordInput ? passwordInput.value : '';
      const security = securitySelect ? securitySelect.value : 'WPA';
      const isHidden = hiddenCheckbox ? hiddenCheckbox.checked : false;

      if (!ssid) {
        if (messageEl) messageEl.textContent = 'Please enter your Wi-Fi network name (SSID).';
        if (payloadTextEl) payloadTextEl.textContent = '—';
        return;
      }

      if (messageEl) messageEl.textContent = '';

      const payload = buildWifiPayload(ssid, password, security, isHidden);
      if (payloadTextEl) payloadTextEl.textContent = payload;

      // Color and contrast check
      const fgColor = (qrFgColorInput ? qrFgColorInput.value : '#000000') || '#000000';
      const bgColor = (qrBgColorInput ? qrBgColorInput.value : '#ffffff') || '#ffffff';
      const contrast = getContrastRatio(fgColor, bgColor);

      if (contrastWarnEl) {
        if (contrast < GENERATOR_CONFIG.wifi.minContrastRatio) {
          contrastWarnEl.style.display = 'block';
          contrastWarnEl.textContent = `Warning: Low color contrast (${contrast.toFixed(1)}:1). Darker foreground on light background is strongly recommended for scanning.`;
        } else {
          contrastWarnEl.style.display = 'none';
        }
      }

      // Generate QR Code with qrcode-generator
      const ecc = (qrEccSelect ? qrEccSelect.value : 'M') || 'M';
      const margin = parseInt(qrMarginSelect ? qrMarginSelect.value : '4', 10);
      const targetSize = parseInt(qrSizeSelect ? qrSizeSelect.value : '320', 10);

      try {
        if (typeof window.qrcode !== 'function') {
          if (messageEl) messageEl.textContent = 'QR code library is loading... please wait.';
          return;
        }

        const qr = window.qrcode(0, ecc);
        qr.addData(payload);
        qr.make();

        const count = qr.getModuleCount();
        const totalModules = count + margin * 2;
        const cellSize = Math.max(2, Math.floor(targetSize / totalModules));
        const finalPixelSize = totalModules * cellSize;

        // Draw on Canvas
        canvasEl.width = finalPixelSize;
        canvasEl.height = finalPixelSize;
        const ctx = canvasEl.getContext('2d');

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, finalPixelSize, finalPixelSize);

        ctx.fillStyle = fgColor;
        for (let r = 0; r < count; r++) {
          for (let c = 0; c < count; c++) {
            if (qr.isDark(r, c)) {
              ctx.fillRect((c + margin) * cellSize, (r + margin) * cellSize, cellSize, cellSize);
            }
          }
        }

        // Build Clean SVG
        let pathData = '';
        for (let r = 0; r < count; r++) {
          for (let c = 0; c < count; c++) {
            if (qr.isDark(r, c)) {
              pathData += `M${c + margin},${r + margin}h1v1h-1z `;
            }
          }
        }

        currentSvgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" width="${finalPixelSize}" height="${finalPixelSize}">
          <rect width="${totalModules}" height="${totalModules}" fill="${bgColor}"/>
          <path d="${pathData.trim()}" fill="${fgColor}"/>
        </svg>`;

        if (svgWrapEl) {
          svgWrapEl.innerHTML = currentSvgString;
        }

      } catch (err) {
        if (messageEl) messageEl.textContent = 'Unable to generate QR code with current options: ' + err.message;
      }
    }

    // Bind input listeners
    [ssidInput, passwordInput, qrSizeSelect, qrEccSelect, qrFgColorInput, qrBgColorInput, qrMarginSelect].forEach(el => {
      if (el) {
        el.addEventListener('input', renderWifiQr);
        el.addEventListener('change', renderWifiQr);
      }
    });

    if (hiddenCheckbox) {
      hiddenCheckbox.addEventListener('change', renderWifiQr);
    }

    // Download PNG
    if (downloadPngBtn) {
      downloadPngBtn.addEventListener('click', () => {
        const ssid = (ssidInput.value.trim() || 'wifi').replace(/[^a-zA-Z0-9_-]/g, '_');
        canvasEl.toBlob((blob) => {
          if (blob) {
            triggerDownloadBlob(blob, `wifi-qr-${ssid}.png`);
            showToastMessage('Wi-Fi QR Code PNG downloaded.');
          }
        }, 'image/png');
      });
    }

    // Download SVG
    if (downloadSvgBtn) {
      downloadSvgBtn.addEventListener('click', () => {
        if (!currentSvgString) return;
        const ssid = (ssidInput.value.trim() || 'wifi').replace(/[^a-zA-Z0-9_-]/g, '_');
        const blob = new Blob([currentSvgString], { type: 'image/svg+xml;charset=utf-8' });
        triggerDownloadBlob(blob, `wifi-qr-${ssid}.svg`);
        showToastMessage('Wi-Fi QR Code SVG downloaded.');
      });
    }

    // Copy Payload
    if (copyPayloadBtn) {
      copyPayloadBtn.addEventListener('click', () => {
        if (!payloadTextEl || payloadTextEl.textContent === '—') return;
        navigator.clipboard.writeText(payloadTextEl.textContent).then(() => {
          showToastMessage('Payload copied to clipboard.');
        }).catch(() => {
          showToastMessage('Failed to copy payload.');
        });
      });
    }

    // Print Wi-Fi Card
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        const ssid = ssidInput.value.trim() || 'Wi-Fi Network';
        const password = passwordInput ? passwordInput.value : '';
        const security = securitySelect ? securitySelect.value : 'WPA';
        const dataUrl = canvasEl.toDataURL('image/png');

        const printWindow = window.open('', '_blank', 'width=650,height=700');
        if (!printWindow) {
          showToastMessage('Popup blocked. Please allow popups to print Wi-Fi card.');
          return;
        }

        printWindow.document.write(`<!DOCTYPE html>
        <html>
        <head>
          <title>Wi-Fi Access Card - ${ssid}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; }
            .card { background: #ffffff; border: 2px solid #e2e8f0; border-radius: 16px; padding: 32px; text-align: center; max-width: 380px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
            h1 { font-size: 20px; margin: 0 0 6px 0; color: #0f172a; }
            p { font-size: 14px; color: #64748b; margin: 0 0 20px 0; }
            .qr-wrap img { width: 240px; height: 240px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .details { margin-top: 20px; font-size: 14px; text-align: left; background: #f1f5f9; padding: 12px 16px; border-radius: 8px; }
            .details div { margin-bottom: 6px; }
            .details strong { color: #1e293b; }
            @media print { body { background: none; } .card { box-shadow: none; border: 1px solid #000; } }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Wi-Fi Network Access</h1>
            <p>Scan this QR code with your phone camera to connect automatically.</p>
            <div class="qr-wrap"><img src="${dataUrl}" alt="Wi-Fi QR Code"></div>
            <div class="details">
              <div><strong>Network (SSID):</strong> ${ssid}</div>
              <div><strong>Security:</strong> ${security}</div>
              ${security !== 'none' && password ? `<div><strong>Password:</strong> ${password}</div>` : ''}
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          <\/script>
        </body>
        </html>`);
        printWindow.document.close();
      });
    }

    renderWifiQr();
  }


  /* ==========================================================================
     4. BARCODE GENERATOR
     ========================================================================== */

  // EAN-13 Check Digit Calculation & Verification
  function calculateEan13CheckDigit(digits12) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const d = parseInt(digits12[i], 10);
      sum += (i % 2 === 0) ? d : (d * 3);
    }
    return (10 - (sum % 10)) % 10;
  }

  function validateEan13(rawVal) {
    const clean = rawVal.replace(/\s+/g, '');
    if (!/^\d+$/.test(clean)) {
      return { valid: false, error: 'EAN-13 barcodes require numbers only (no letters or symbols).' };
    }
    if (clean.length === 12) {
      const check = calculateEan13CheckDigit(clean);
      return { valid: true, fullValue: clean + check, checkDigit: check, isCalculated: true };
    }
    if (clean.length === 13) {
      const prefix = clean.slice(0, 12);
      const expectedCheck = calculateEan13CheckDigit(prefix);
      const enteredCheck = parseInt(clean[12], 10);
      if (enteredCheck !== expectedCheck) {
        return {
          valid: false,
          error: `Invalid check digit: entered ${enteredCheck}, expected ${expectedCheck} for prefix ${prefix}.`
        };
      }
      return { valid: true, fullValue: clean, checkDigit: enteredCheck, isCalculated: false };
    }
    return { valid: false, error: `EAN-13 requires 12 digits (check digit will be added) or 13 verified digits. Currently entered: ${clean.length} digits.` };
  }

  // UPC-A Check Digit Calculation & Verification
  function calculateUpcCheckDigit(digits11) {
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      const d = parseInt(digits11[i], 10);
      sum += (i % 2 === 0) ? (d * 3) : d;
    }
    return (10 - (sum % 10)) % 10;
  }

  function validateUpcA(rawVal) {
    const clean = rawVal.replace(/\s+/g, '');
    if (!/^\d+$/.test(clean)) {
      return { valid: false, error: 'UPC-A barcodes require numbers only (no letters or symbols).' };
    }
    if (clean.length === 11) {
      const check = calculateUpcCheckDigit(clean);
      return { valid: true, fullValue: clean + check, checkDigit: check, isCalculated: true };
    }
    if (clean.length === 12) {
      const prefix = clean.slice(0, 11);
      const expectedCheck = calculateUpcCheckDigit(prefix);
      const enteredCheck = parseInt(clean[11], 10);
      if (enteredCheck !== expectedCheck) {
        return {
          valid: false,
          error: `Invalid check digit: entered ${enteredCheck}, expected ${expectedCheck} for prefix ${prefix}.`
        };
      }
      return { valid: true, fullValue: clean, checkDigit: enteredCheck, isCalculated: false };
    }
    return { valid: false, error: `UPC-A requires 11 digits (check digit will be added) or 12 verified digits. Currently entered: ${clean.length} digits.` };
  }

  function validateCode39(rawVal) {
    if (!rawVal) return { valid: false, error: 'Please enter a value for Code 39.' };
    const invalidChars = [];
    for (let i = 0; i < rawVal.length; i++) {
      const ch = rawVal[i];
      if (!GENERATOR_CONFIG.barcode.code39Regex.test(ch)) {
        if (!invalidChars.includes(ch)) invalidChars.push(ch);
      }
    }
    if (invalidChars.length > 0) {
      return {
        valid: false,
        error: `Code 39 only supports uppercase letters (A-Z), numbers (0-9), and characters - . $ / + % [space]. Unsupported characters: "${invalidChars.join(' ')}"`
      };
    }
    return { valid: true, fullValue: rawVal };
  }

  function validateCode128(rawVal) {
    if (!rawVal) return { valid: false, error: 'Please enter a value for Code 128.' };
    if (!GENERATOR_CONFIG.barcode.code128Regex.test(rawVal)) {
      return { valid: false, error: 'Code 128 accepts standard printable ASCII characters.' };
    }
    return { valid: true, fullValue: rawVal };
  }

  function initBarcodeGenerator() {
    const typeSelect = document.getElementById('barcodeTypeSelect');
    const valueInput = document.getElementById('barcodeValueInput');

    const widthInput = document.getElementById('barcodeWidthInput');
    const heightInput = document.getElementById('barcodeHeightInput');
    const showTextCheckbox = document.getElementById('barcodeShowTextCheckbox');
    const colorInput = document.getElementById('barcodeColorInput');
    const bgInput = document.getElementById('barcodeBgInput');
    const marginInput = document.getElementById('barcodeMarginInput');

    const svgEl = document.getElementById('barcodeSvg');
    const canvasEl = document.getElementById('barcodeCanvas');
    const fullValueDisplay = document.getElementById('barcodeFullValue');
    const messageEl = document.getElementById('barcodeMessage');

    const downloadPngBtn = document.getElementById('downloadBarcodePngBtn');
    const downloadSvgBtn = document.getElementById('downloadBarcodeSvgBtn');
    const printBtn = document.getElementById('printBarcodeBtn');
    const copyValueBtn = document.getElementById('copyBarcodeValueBtn');

    if (!typeSelect || !valueInput || !svgEl) return;

    let currentValidatedValue = '';

    function renderBarcode() {
      const type = typeSelect.value;
      const rawVal = valueInput.value.trim();

      if (!rawVal) {
        if (messageEl) messageEl.textContent = 'Please enter a barcode value.';
        if (fullValueDisplay) fullValueDisplay.textContent = '—';
        svgEl.style.display = 'none';
        return;
      }

      let validationResult = { valid: false, error: 'Invalid barcode value.' };

      if (type === 'EAN13') {
        validationResult = validateEan13(rawVal);
      } else if (type === 'UPC') {
        validationResult = validateUpcA(rawVal);
      } else if (type === 'CODE39') {
        validationResult = validateCode39(rawVal);
      } else {
        validationResult = validateCode128(rawVal);
      }

      if (!validationResult.valid) {
        if (messageEl) messageEl.textContent = validationResult.error;
        if (fullValueDisplay) fullValueDisplay.textContent = '—';
        svgEl.style.display = 'none';
        currentValidatedValue = '';
        return;
      }

      if (messageEl) messageEl.textContent = '';
      currentValidatedValue = validationResult.fullValue;

      if (fullValueDisplay) {
        if (validationResult.checkDigit !== undefined) {
          fullValueDisplay.innerHTML = `<strong>${validationResult.fullValue}</strong> (Check digit: <span style="color:var(--primary); font-weight:700;">${validationResult.checkDigit}</span>)`;
        } else {
          fullValueDisplay.textContent = currentValidatedValue;
        }
      }

      // Read visual options
      const barWidth = parseFloat(widthInput ? widthInput.value : '2') || 2;
      const barHeight = parseInt(heightInput ? heightInput.value : '100', 10) || 100;
      const displayValue = showTextCheckbox ? showTextCheckbox.checked : true;
      const lineColor = (colorInput ? colorInput.value : '#000000') || '#000000';
      const background = (bgInput ? bgInput.value : '#ffffff') || '#ffffff';
      const margin = parseInt(marginInput ? marginInput.value : '10', 10);

      try {
        if (typeof window.JsBarcode !== 'function') {
          if (messageEl) messageEl.textContent = 'Barcode engine is loading...';
          return;
        }

        svgEl.style.display = 'block';
        window.JsBarcode(svgEl, currentValidatedValue, {
          format: type,
          width: barWidth,
          height: barHeight,
          displayValue: displayValue,
          lineColor: lineColor,
          background: background,
          margin: Number.isNaN(margin) ? 10 : margin,
          fontSize: 16,
          textMargin: 4,
          valid: function (valid) {
            if (!valid && messageEl) {
              messageEl.textContent = 'Could not generate barcode for this value with selected format.';
              svgEl.style.display = 'none';
            }
          }
        });

      } catch (err) {
        if (messageEl) messageEl.textContent = 'Barcode generation error: ' + err.message;
        svgEl.style.display = 'none';
      }
    }

    // Helper to render SVG to offscreen canvas for PNG export
    function svgToCanvas(callback) {
      if (!svgEl || svgEl.style.display === 'none') return;
      const svgXml = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = function () {
        const bbox = svgEl.getBoundingClientRect();
        const canvas = canvasEl || document.createElement('canvas');
        canvas.width = bbox.width * 2; // high res
        canvas.height = bbox.height * 2;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(callback, 'image/png');
      };
      img.src = url;
    }

    // Bind inputs
    [typeSelect, valueInput, widthInput, heightInput, showTextCheckbox, colorInput, bgInput, marginInput].forEach(el => {
      if (el) {
        el.addEventListener('input', renderBarcode);
        el.addEventListener('change', renderBarcode);
      }
    });

    // Download PNG
    if (downloadPngBtn) {
      downloadPngBtn.addEventListener('click', () => {
        if (!currentValidatedValue) {
          showToastMessage('Please enter a valid barcode value first.');
          return;
        }
        svgToCanvas((blob) => {
          if (blob) {
            const safeName = currentValidatedValue.replace(/[^a-zA-Z0-9_-]/g, '_');
            triggerDownloadBlob(blob, `barcode-${safeName}.png`);
            showToastMessage('Barcode PNG downloaded.');
          }
        });
      });
    }

    // Download SVG
    if (downloadSvgBtn) {
      downloadSvgBtn.addEventListener('click', () => {
        if (!currentValidatedValue || !svgEl || svgEl.style.display === 'none') {
          showToastMessage('Please enter a valid barcode value first.');
          return;
        }
        const svgXml = new XMLSerializer().serializeToString(svgEl);
        const blob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
        const safeName = currentValidatedValue.replace(/[^a-zA-Z0-9_-]/g, '_');
        triggerDownloadBlob(blob, `barcode-${safeName}.svg`);
        showToastMessage('Barcode SVG downloaded.');
      });
    }

    // Copy Value
    if (copyValueBtn) {
      copyValueBtn.addEventListener('click', () => {
        if (!currentValidatedValue) return;
        navigator.clipboard.writeText(currentValidatedValue).then(() => {
          showToastMessage('Barcode value copied to clipboard.');
        }).catch(() => {
          showToastMessage('Failed to copy value.');
        });
      });
    }

    // Print Barcode Label
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        if (!currentValidatedValue || !svgEl || svgEl.style.display === 'none') {
          showToastMessage('Please enter a valid barcode first.');
          return;
        }
        const svgXml = new XMLSerializer().serializeToString(svgEl);
        const printWindow = window.open('', '_blank', 'width=600,height=500');
        if (!printWindow) {
          showToastMessage('Popup blocked. Please allow popups to print barcode.');
          return;
        }
        printWindow.document.write(`<!DOCTYPE html>
        <html>
        <head>
          <title>Barcode Label - ${currentValidatedValue}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fff; }
            .label { border: 1px dashed #cbd5e1; padding: 24px; text-align: center; border-radius: 8px; }
            .label svg { max-width: 100%; height: auto; }
            @media print { body { background: none; } .label { border: none; } }
          </style>
        </head>
        <body>
          <div class="label">
            ${svgXml}
          </div>
          <script>
            window.onload = function() { window.print(); }
          <\/script>
        </body>
        </html>`);
        printWindow.document.close();
      });
    }

    renderBarcode();
  }


  /* ==========================================================================
     5. WHATSAPP LINK GENERATOR
     ========================================================================== */

  function cleanWhatsappNumber(countryCodeStr, localNumStr) {
    let countryDigits = (countryCodeStr || '').replace(/\D/g, '');
    let localDigits = (localNumStr || '').replace(/\D/g, '');

    // Remove ONE leading 0 from the local number
    if (localDigits.startsWith('0')) {
      localDigits = localDigits.substring(1);
    }

    const totalDigits = countryDigits + localDigits;
    return {
      countryDigits,
      localDigits,
      totalDigits
    };
  }

  function buildWhatsappLink(countryCodeStr, localNumStr, messageStr) {
    const { totalDigits } = cleanWhatsappNumber(countryCodeStr, localNumStr);

    if (totalDigits.length < GENERATOR_CONFIG.whatsapp.minDigits || totalDigits.length > GENERATOR_CONFIG.whatsapp.maxDigits) {
      return {
        error: `Total phone number must be between ${GENERATOR_CONFIG.whatsapp.minDigits} and ${GENERATOR_CONFIG.whatsapp.maxDigits} digits. Currently entered: ${totalDigits.length} digits.`,
        totalDigits
      };
    }

    let link = `https://wa.me/${totalDigits}`;
    if (messageStr && messageStr.trim().length > 0) {
      link += `?text=${encodeURIComponent(messageStr)}`;
    }
    return {
      link,
      totalDigits
    };
  }

  function initWhatsappLinkGenerator() {
    const countrySelect = document.getElementById('waCountrySelect');
    const customCountryWrap = document.getElementById('waCustomCountryWrap');
    const customCountryInput = document.getElementById('waCustomCountryInput');
    const localPhoneInput = document.getElementById('waLocalPhoneInput');
    const messageInput = document.getElementById('waMessageInput');

    const linkOutputEl = document.getElementById('waLinkOutput');
    const qrCanvasEl = document.getElementById('waQrCanvas');
    const messageEl = document.getElementById('waMessage');

    const copyLinkBtn = document.getElementById('copyWaLinkBtn');
    const openLinkBtn = document.getElementById('openWaLinkBtn');
    const downloadQrBtn = document.getElementById('downloadWaQrBtn');

    if (!countrySelect || !localPhoneInput || !linkOutputEl) return;

    let currentLink = '';

    // Handle "Other" custom country code toggle
    if (countrySelect && customCountryWrap) {
      countrySelect.addEventListener('change', () => {
        const isOther = countrySelect.value === 'other';
        customCountryWrap.style.display = isOther ? 'block' : 'none';
        renderWhatsappLink();
      });
    }

    function getSelectedCountryCode() {
      if (countrySelect.value === 'other') {
        return customCountryInput ? customCountryInput.value : '';
      }
      return countrySelect.value;
    }

    function renderWhatsappLink() {
      const countryCode = getSelectedCountryCode();
      const localPhone = localPhoneInput.value;
      const message = messageInput ? messageInput.value : '';

      if (!localPhone.trim()) {
        if (messageEl) messageEl.textContent = 'Please enter a phone number.';
        if (linkOutputEl) linkOutputEl.value = '—';
        currentLink = '';
        if (qrCanvasEl) {
          const ctx = qrCanvasEl.getContext('2d');
          ctx.clearRect(0, 0, qrCanvasEl.width, qrCanvasEl.height);
        }
        return;
      }

      const res = buildWhatsappLink(countryCode, localPhone, message);

      if (res.error) {
        if (messageEl) messageEl.textContent = res.error;
        if (linkOutputEl) linkOutputEl.value = '—';
        currentLink = '';
        if (qrCanvasEl) {
          const ctx = qrCanvasEl.getContext('2d');
          ctx.clearRect(0, 0, qrCanvasEl.width, qrCanvasEl.height);
        }
        return;
      }

      if (messageEl) messageEl.textContent = '';
      currentLink = res.link;
      if (linkOutputEl) linkOutputEl.value = currentLink;

      // Render QR Code of link with qrcode-generator
      if (qrCanvasEl && typeof window.qrcode === 'function') {
        try {
          const qr = window.qrcode(0, 'M');
          qr.addData(currentLink);
          qr.make();

          const count = qr.getModuleCount();
          const margin = 3;
          const totalModules = count + margin * 2;
          const cellSize = Math.max(3, Math.floor(220 / totalModules));
          const size = totalModules * cellSize;

          qrCanvasEl.width = size;
          qrCanvasEl.height = size;
          const ctx = qrCanvasEl.getContext('2d');

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);

          ctx.fillStyle = '#059669'; // WhatsApp emerald green brand tint
          for (let r = 0; r < count; r++) {
            for (let c = 0; c < count; c++) {
              if (qr.isDark(r, c)) {
                ctx.fillRect((c + margin) * cellSize, (r + margin) * cellSize, cellSize, cellSize);
              }
            }
          }
        } catch (e) {
          // ignore qr preview error
        }
      }
    }

    // Listeners
    [countrySelect, customCountryInput, localPhoneInput, messageInput].forEach(el => {
      if (el) {
        el.addEventListener('input', renderWhatsappLink);
        el.addEventListener('change', renderWhatsappLink);
      }
    });

    // Copy Link Button
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        if (!currentLink) {
          showToastMessage('Please enter a valid phone number first.');
          return;
        }
        navigator.clipboard.writeText(currentLink).then(() => {
          showToastMessage('WhatsApp link copied to clipboard.');
        }).catch(() => {
          showToastMessage('Failed to copy link.');
        });
      });
    }

    // Open Link Button
    if (openLinkBtn) {
      openLinkBtn.addEventListener('click', () => {
        if (!currentLink) {
          showToastMessage('Please enter a valid phone number first.');
          return;
        }
        window.open(currentLink, '_blank', 'noopener,noreferrer');
      });
    }

    // Download QR Code PNG
    if (downloadQrBtn && qrCanvasEl) {
      downloadQrBtn.addEventListener('click', () => {
        if (!currentLink) {
          showToastMessage('Please enter a valid phone number first.');
          return;
        }
        qrCanvasEl.toBlob((blob) => {
          if (blob) {
            triggerDownloadBlob(blob, 'whatsapp-chat-qr.png');
            showToastMessage('WhatsApp QR Code PNG downloaded.');
          }
        }, 'image/png');
      });
    }

    renderWhatsappLink();
  }


  /* ==========================================================================
     6. GLOBAL EXPOSURE & AUTO-INITIALIZATION
     ========================================================================== */
  window.GENERATOR_CONFIG = GENERATOR_CONFIG;
  window.escapeWifiField = escapeWifiField;
  window.buildWifiPayload = buildWifiPayload;
  window.calculateEan13CheckDigit = calculateEan13CheckDigit;
  window.validateEan13 = validateEan13;
  window.calculateUpcCheckDigit = calculateUpcCheckDigit;
  window.validateUpcA = validateUpcA;
  window.validateCode39 = validateCode39;
  window.validateCode128 = validateCode128;
  window.cleanWhatsappNumber = cleanWhatsappNumber;
  window.buildWhatsappLink = buildWhatsappLink;

  window.initWifiQrCodeGenerator = initWifiQrCodeGenerator;
  window.initBarcodeGenerator = initBarcodeGenerator;
  window.initWhatsappLinkGenerator = initWhatsappLinkGenerator;

})();
