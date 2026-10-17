/* ==========================================================================
   FileShrink - Shared Business Document Engine (js/business-doc.js)
   Reused across /quotation-maker/ and /invoice-generator/
   ========================================================================== */

/**
 * Platform Limits & Technical Specifications
 * Rule 8: Platform limits and official standards must carry the required comment.
 */
const BUSINESS_DOC_CONFIG = {
  // ISO 216 standard paper dimensions: A4 is 210 x 297 mm (verify against the platform's current guidance)
  a4WidthMm: 210,
  a4HeightMm: 297,
  a4WidthPt: 595.28,
  a4HeightPt: 841.89,
  marginPt: 40,
  maxItemsPerPage: 22,
  defaultCurrency: 'PKR',
  defaultNumberStyle: 'standard',
  defaultValidityDays: 30,
  storageKey: 'fileshrink_saved_business_profile'
};

// Month Names for Date Formatting
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Format a YYYY-MM-DD string into "D MMMM YYYY"
 */
function formatDateReadable(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr;
  return `${d} ${MONTH_NAMES[m]} ${y}`;
}

/**
 * Add N days to a YYYY-MM-DD date and return readable formatted string
 */
function addDaysToDate(dateStr, days) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  const date = new Date(y, m, d);
  date.setDate(date.getDate() + Number(days));
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Check if text contains non-Latin characters (e.g. Urdu, Arabic, CJK)
 * Standard Latin-1 / WinAnsi max code is 255. Characters above 255 cannot be drawn in default jsPDF fonts.
 */
function hasNonLatinCharacters(text) {
  if (!text) return false;
  const str = String(text);
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 255) {
      return true;
    }
  }
  return false;
}

/**
 * Amount in Words converter matching ReceiptEngine specifications
 */
function convertNumberToWords(num, style = 'standard', currency = 'PKR') {
  if (num === null || num === undefined || isNaN(num)) return '';
  num = Number(num);

  function getCurrencyWord(curr) {
    if (curr === 'PKR' || curr === 'INR') return 'Rupees';
    if (curr === 'USD') return 'Dollars';
    if (curr === 'AED') return 'Dirhams';
    if (curr === 'GBP') return 'Pounds';
    if (curr === 'EUR') return 'Euros';
    return '';
  }

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

/**
 * Number formatter with 2 decimal places and locale commas
 */
function formatCurrencyNumber(val, style = 'standard', currency = 'PKR', decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return '0.00';
  const num = Number(val);
  const locale = style === 'lakh' ? 'en-IN' : 'en-US';
  const numStr = num.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  if (!currency || currency === 'none') return numStr;
  return currency + ' ' + numStr;
}

/**
 * Shared Business Document Engine Class
 */
class BusinessDocEngine {
  constructor(docType = 'quotation') {
    this.docType = docType; // 'quotation' or 'invoice'
    this.items = [];
    this.logoData = '';
    this.signatureData = '';
    this.clientSignatureData = '';
    this.currentTemplate = 'classic';
    this.accentColor = '#2563eb';
    this.isStorageEnabled = false;

    // Default item
    this.addItem({ description: 'Professional Services', qty: 1, unitPrice: 1000, discountPercent: 0 });
  }

  addItem(item = { description: '', qty: 1, unitPrice: 0, discountPercent: 0 }) {
    this.items.push({
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      description: item.description || '',
      qty: Number(item.qty) || 1,
      unitPrice: Number(item.unitPrice) || 0,
      discountPercent: Number(item.discountPercent) || 0
    });
  }

  removeItem(index) {
    if (this.items.length > 1) {
      this.items.splice(index, 1);
    }
  }

  moveItem(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= this.items.length) return;
    const temp = this.items[index];
    this.items[index] = this.items[target];
    this.items[target] = temp;
  }

  calculateTotals(options = {}) {
    const {
      overallDiscount = 0,
      discountType = 'percent', // 'percent' or 'amount'
      taxRate = 0,
      shipping = 0,
      amountPaid = 0
    } = options;

    let subtotal = 0;
    const calculatedItems = this.items.map(item => {
      const gross = item.qty * item.unitPrice;
      const lineDisc = (item.discountPercent > 0) ? gross * (item.discountPercent / 100) : 0;
      // Round line total to 2 decimals
      const lineTotal = Math.round((gross - lineDisc) * 100) / 100;
      subtotal += lineTotal;
      return { ...item, lineTotal };
    });

    subtotal = Math.round(subtotal * 100) / 100;

    let discountAmount = 0;
    if (discountType === 'percent') {
      discountAmount = Math.round(subtotal * (Number(overallDiscount) / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(subtotal, Math.round(Number(overallDiscount) * 100) / 100);
    }

    const discountedSubtotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    // Tax is calculated on the discounted amount
    const taxAmount = Math.round(discountedSubtotal * (Number(taxRate) / 100) * 100) / 100;

    // Shipping is not taxed
    const shippingAmount = Math.round(Number(shipping) * 100) / 100;

    const total = Math.round((discountedSubtotal + taxAmount + shippingAmount) * 100) / 100;

    const balanceDue = Math.max(0, Math.round((total - Number(amountPaid)) * 100) / 100);

    return {
      items: calculatedItems,
      subtotal,
      discountAmount,
      discountedSubtotal,
      taxAmount,
      shippingAmount,
      total,
      balanceDue
    };
  }

  hasNonLatin(formData) {
    const values = [
      formData.businessName, formData.businessAddress, formData.businessPhone, formData.businessEmail,
      formData.taxIdLabel, formData.taxIdValue,
      formData.clientName, formData.clientAddress, formData.clientContact,
      formData.docNumber, formData.notes, formData.terms, formData.bankDetails
    ];
    this.items.forEach(it => values.push(it.description));
    return values.some(v => hasNonLatinCharacters(v));
  }

  saveBusinessProfile(data) {
    if (!this.isStorageEnabled) return;
    try {
      const profile = {
        name: data.businessName || '',
        address: data.businessAddress || '',
        phone: data.businessPhone || '',
        email: data.businessEmail || '',
        taxLabel: data.taxIdLabel || '',
        taxValue: data.taxIdValue || '',
        logo: this.logoData || '',
        nextNumber: data.nextDocNumber || ''
      };
      localStorage.setItem(BUSINESS_DOC_CONFIG.storageKey, JSON.stringify(profile));
    } catch (err) {
      console.warn('LocalStorage save failed:', err);
    }
  }

  loadBusinessProfile() {
    try {
      const raw = localStorage.getItem(BUSINESS_DOC_CONFIG.storageKey);
      if (raw) return JSON.parse(raw);
    } catch (err) {
      console.warn('LocalStorage load failed:', err);
    }
    return null;
  }

  clearBusinessProfile() {
    try {
      localStorage.removeItem(BUSINESS_DOC_CONFIG.storageKey);
    } catch (err) {
      console.warn('LocalStorage clear failed:', err);
    }
  }

  /**
   * Export to PDF with jsPDF real text (or canvas fallback for Urdu/Arabic)
   */
  async exportPdf(formData, totals, filename) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('PDF generation library is loading. Please try again.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const isNonLatin = this.hasNonLatin(formData);

    if (isNonLatin) {
      // Non-Latin fallback: render live preview element to canvas then PDF
      await this.exportCanvasPdf(filename);
      return;
    }

    // Latin Real-Text Vector jsPDF Generator (small file, selectable text, repeated headers)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = BUSINESS_DOC_CONFIG.a4WidthPt;
    const pageHeight = BUSINESS_DOC_CONFIG.a4HeightPt;
    const margin = BUSINESS_DOC_CONFIG.marginPt;
    const printableWidth = pageWidth - (margin * 2);
    const bottomLimit = pageHeight - margin - 30;

    let currentY = margin;

    // Helper for table header
    const drawTableHeader = (yPos) => {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, yPos, printableWidth, 20, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);

      doc.text('ITEM & DESCRIPTION', margin + 6, yPos + 13);
      doc.text('QTY', margin + 280, yPos + 13, { align: 'right' });
      doc.text('PRICE', margin + 350, yPos + 13, { align: 'right' });
      doc.text('DISC %', margin + 410, yPos + 13, { align: 'right' });
      doc.text('TOTAL', margin + printableWidth - 6, yPos + 13, { align: 'right' });

      doc.setDrawColor(203, 213, 225);
      doc.line(margin, yPos + 20, margin + printableWidth, yPos + 20);
      return yPos + 20;
    };

    // Header Block (Page 1)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235);
    const titleText = this.docType === 'quotation' ? 'PRICE QUOTATION' : 'INVOICE';
    doc.text(titleText, margin, currentY + 18);

    if (this.logoData) {
      try {
        doc.addImage(this.logoData, 'PNG', margin + printableWidth - 80, currentY, 80, 45);
      } catch (e) {
        // Logo add fallback
      }
    }

    currentY += 38;

    // Meta details (Doc number, date, valid/due date)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);

    const docNumLabel = this.docType === 'quotation' ? 'Quotation #' : 'Invoice #';
    doc.text(`${docNumLabel} ${formData.docNumber}`, margin, currentY);
    doc.text(`Date: ${formatDateReadable(formData.docDate)}`, margin, currentY + 13);

    if (this.docType === 'quotation' && formData.validUntil) {
      doc.text(`Valid Until: ${formData.validUntil}`, margin, currentY + 26);
    } else if (this.docType === 'invoice' && formData.dueDate) {
      doc.text(`Due Date: ${formData.dueDate}`, margin, currentY + 26);
    }

    currentY += 45;

    // Sender & Client Two-Column Block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('FROM:', margin, currentY);
    doc.text('BILL TO:', margin + 260, currentY);

    currentY += 13;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    doc.text(formData.businessName || '', margin, currentY);
    doc.text(formData.clientName || '', margin + 260, currentY);

    currentY += 11;
    doc.text(formData.businessAddress || '', margin, currentY);
    doc.text(formData.clientAddress || '', margin + 260, currentY);

    currentY += 11;
    const bizContact = [formData.businessPhone, formData.businessEmail].filter(Boolean).join(' | ');
    doc.text(bizContact, margin, currentY);
    doc.text(formData.clientContact || '', margin + 260, currentY);

    if (formData.taxIdValue) {
      currentY += 11;
      doc.text(`${formData.taxIdLabel || 'Tax ID'}: ${formData.taxIdValue}`, margin, currentY);
    }

    currentY += 24;

    // Draw Table Header
    currentY = drawTableHeader(currentY);

    // Items Loop with automatic multi-page splitting & repeated headers
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    totals.items.forEach((item, idx) => {
      const descLines = doc.splitTextToSize(item.description, 250);
      const rowHeight = Math.max(18, (descLines.length * 11) + 8);

      if (currentY + rowHeight > bottomLimit) {
        doc.addPage();
        currentY = margin;
        currentY = drawTableHeader(currentY);
      }

      doc.setTextColor(15, 23, 42);
      doc.text(descLines, margin + 6, currentY + 11);
      doc.text(String(item.qty), margin + 280, currentY + 11, { align: 'right' });
      doc.text(formatCurrencyNumber(item.unitPrice, formData.numberStyle, 'none'), margin + 350, currentY + 11, { align: 'right' });
      doc.text(item.discountPercent ? `${item.discountPercent}%` : '-', margin + 410, currentY + 11, { align: 'right' });
      doc.text(formatCurrencyNumber(item.lineTotal, formData.numberStyle, 'none'), margin + printableWidth - 6, currentY + 11, { align: 'right' });

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, currentY + rowHeight, margin + printableWidth, currentY + rowHeight);

      currentY += rowHeight;
    });

    // Totals Block check page fit
    const totalsBlockHeight = 120;
    if (currentY + totalsBlockHeight > bottomLimit) {
      doc.addPage();
      currentY = margin;
    }

    currentY += 15;

    // Totals Table (Right Aligned)
    const totalsLeft = margin + printableWidth - 220;
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    doc.text('Subtotal:', totalsLeft, currentY);
    doc.text(formatCurrencyNumber(totals.subtotal, formData.numberStyle, formData.currency), margin + printableWidth - 6, currentY, { align: 'right' });

    if (totals.discountAmount > 0) {
      currentY += 13;
      doc.text('Overall Discount:', totalsLeft, currentY);
      doc.text('-' + formatCurrencyNumber(totals.discountAmount, formData.numberStyle, formData.currency), margin + printableWidth - 6, currentY, { align: 'right' });
    }

    if (totals.taxAmount > 0 || formData.taxRate > 0) {
      currentY += 13;
      const taxLabel = `${formData.taxLabel || 'Tax'} (${formData.taxRate}%):`;
      doc.text(taxLabel, totalsLeft, currentY);
      doc.text(formatCurrencyNumber(totals.taxAmount, formData.numberStyle, formData.currency), margin + printableWidth - 6, currentY, { align: 'right' });
    }

    if (totals.shippingAmount > 0) {
      currentY += 13;
      doc.text('Shipping & Handling:', totalsLeft, currentY);
      doc.text(formatCurrencyNumber(totals.shippingAmount, formData.numberStyle, formData.currency), margin + printableWidth - 6, currentY, { align: 'right' });
    }

    currentY += 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(37, 99, 235);
    doc.text('TOTAL:', totalsLeft, currentY);
    doc.text(formatCurrencyNumber(totals.total, formData.numberStyle, formData.currency), margin + printableWidth - 6, currentY, { align: 'right' });

    if (this.docType === 'invoice' && formData.amountPaid > 0) {
      currentY += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text('Amount Paid:', totalsLeft, currentY);
      doc.text(formatCurrencyNumber(formData.amountPaid, formData.numberStyle, formData.currency), margin + printableWidth - 6, currentY, { align: 'right' });

      currentY += 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('Balance Due:', totalsLeft, currentY);
      doc.text(formatCurrencyNumber(totals.balanceDue, formData.numberStyle, formData.currency), margin + printableWidth - 6, currentY, { align: 'right' });
    }

    // Amount in Words
    if (formData.showWords) {
      currentY += 18;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const words = convertNumberToWords(totals.total, formData.numberStyle, formData.currency);
      doc.text(`Amount in Words: ${words}`, margin, currentY);
    }

    // Notes and Terms
    if (formData.notes || formData.terms || formData.bankDetails) {
      currentY += 22;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);

      if (formData.notes) {
        doc.text(`Notes: ${formData.notes}`, margin, currentY);
        currentY += 11;
      }
      if (formData.terms) {
        doc.text(`Terms: ${formData.terms}`, margin, currentY);
        currentY += 11;
      }
      if (formData.bankDetails) {
        doc.text(`Payment Details: ${formData.bankDetails}`, margin, currentY);
      }
    }

    // Signature image if present
    if (this.signatureData) {
      try {
        doc.addImage(this.signatureData, 'PNG', margin + printableWidth - 140, currentY + 10, 120, 45);
      } catch (e) {}
    }

    doc.save(filename);
  }

  /**
   * Fallback for documents containing Non-Latin text (e.g. Urdu/Arabic)
   * Converts the live HTML preview into a high-resolution image PDF.
   */
  async exportCanvasPdf(filename) {
    const previewEl = document.getElementById('documentPreviewSheet');
    if (!previewEl) return;

    // Use html2canvas if available, or SVG/Canvas drawing
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    // Rasterize HTML preview using SVG foreignObject or native canvas
    const canvas = await this.htmlToCanvas(previewEl);
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    doc.addImage(imgData, 'JPEG', 0, 0, BUSINESS_DOC_CONFIG.a4WidthPt, BUSINESS_DOC_CONFIG.a4HeightPt);
    doc.save(filename);
  }

  async htmlToCanvas(element) {
    // High-resolution rasterizer via SVG foreignObject
    const width = 800;
    const height = 1130;
    const canvas = document.createElement('canvas');
    canvas.width = width * 2; // 2x resolution
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    const data = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff; color:#1e293b; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Nastaliq Urdu', Arial, sans-serif;">
            ${element.outerHTML}
          </div>
        </foreignObject>
      </svg>
    `;

    return new Promise((resolve) => {
      const img = new Image();
      const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = () => {
        // Fallback white canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        resolve(canvas);
      };
      img.src = url;
    });
  }

  async exportJpg(filename) {
    const previewEl = document.getElementById('documentPreviewSheet');
    if (!previewEl) return;
    const canvas = await this.htmlToCanvas(previewEl);
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    }, 'image/jpeg', 0.95);
  }

  printDocument() {
    window.print();
  }
}

// Export globally
if (typeof window !== 'undefined') {
  window.BUSINESS_DOC_CONFIG = BUSINESS_DOC_CONFIG;
  window.BusinessDocEngine = BusinessDocEngine;
  window.formatDateReadable = formatDateReadable;
  window.addDaysToDate = addDaysToDate;
  window.convertNumberToWords = convertNumberToWords;
  window.formatCurrencyNumber = formatCurrencyNumber;
  window.hasNonLatinCharacters = hasNonLatinCharacters;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BUSINESS_DOC_CONFIG,
    BusinessDocEngine,
    formatDateReadable,
    addDaysToDate,
    convertNumberToWords,
    formatCurrencyNumber,
    hasNonLatinCharacters
  };
}
