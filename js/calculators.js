/**
 * FileShrink - Shared Student & Percentage Calculators Engine (/js/calculators.js)
 * Clean, modular logic with zero external dependencies.
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. CONFIGURATION & CONSTANTS
     ========================================================================== */
  const CALC_CONFIG = {
    // Standard default 4.0 university grade scale
    defaultGradeScale: {
      'A':  4.00,
      'A-': 3.67,
      'B+': 3.33,
      'B':  3.00,
      'B-': 2.67,
      'C+': 2.33,
      'C':  2.00,
      'C-': 1.67,
      'D+': 1.33,
      'D':  1.00,
      'F':  0.00
    },

    // Attendance defaults
    attendance: {
      defaultRequiredPercent: 75,
      presetPercents: [60, 65, 70, 75, 80, 85]
    },

    // CGPA to percentage defaults
    cgpaToPercent: {
      presetScales: [4, 5, 10],
      defaultMaxScale: 4.0
    },

    // Property and Land defaults and constants
    property: {
      // Shared Marla sizes in square feet
      marlaSizes: {
        standard: 272.25, // Standard Revenue / Official Punjab marla (1 Kanal = 20 Marlas = 5,445 sq ft)
        cda: 250.0,       // Islamabad CDA / Bahria / Rawalpindi marla (1 Kanal = 5,000 sq ft)
        lda: 225.0        // Lahore LDA / modern housing societies marla (1 Kanal = 4,500 sq ft)
      },
      defaultMarlaSize: 272.25,
      sqFtPerSqYard: 9,              // 1 sq yard = 9 sq ft (exact)
      sqFtPerSqMeter: 10.76391041671, // 1 sq meter = 10.7639104 sq ft
      marlasPerKanal: 20,            // 1 kanal = 20 marlas
      defaultNumberStyle: 'standard', // 'standard' (1,000,000) or 'lakh' (10,00,00)
      defaultCurrency: 'PKR',         // 'PKR', 'INR', 'USD', or 'none'
      amortizationMaxRows: 360,
      initialScheduleRows: 12
    },

    // Loan Calculator configuration
    loan: {
      minRate: 0,
      maxRate: 100,
      maxMonths: 600,
      initialScheduleRows: 12
    },

    // Average Calculator configuration
    average: {
      maxNumbers: 10000
    },

    // Discount Calculator configuration
    discount: {
      maxDiscountPercent: 100
    },

    // Weighted Grade Defaults
    weightedGrade: {
      initialRows: 5,
      defaultScale: {
        'A': 90,
        'B': 80,
        'C': 70,
        'D': 60
      }
    },

    // Final Grade Defaults
    finalGrade: {
      defaultTargets: [90, 80, 70, 60],
      minWeight: 0.01,
      maxWeight: 100
    },

    // Hijri Calendar Defaults
    hijri: {
      monthNames: [
        'Muharram',
        'Safar',
        'Rabi al-Awwal',
        'Rabi al-Thani',
        'Jumada al-Awwal',
        'Jumada al-Thani',
        'Rajab',
        'Shaban',
        'Ramadan',
        'Shawwal',
        'Dhu al-Qadah',
        'Dhu al-Hijjah'
      ],
      minHijriYear: 1356, // verify against platform guidance (~1937 CE)
      maxHijriYear: 1500  // verify against platform guidance (~2076 CE)
    }
  };


  /* ==========================================================================
     2. COMMON HELPER FUNCTIONS (Number parsing, safe formatting, copy toast)
     ========================================================================== */

  /**
   * Parse numeric user input safely.
   * Returns null if empty, invalid, NaN, or non-finite.
   */
  function parseSafeNumber(value) {
    if (value === undefined || value === null) return null;
    const str = String(value).trim();
    if (str === '') return null;
    const num = Number(str);
    if (!Number.isFinite(num) || Number.isNaN(num)) return null;
    return num;
  }

  /**
   * Format a number safely for display.
   * Avoids NaN, Infinity, and scientific notation.
   */
  function formatDisplayNumber(value, decimals = 2, trimZeros = false) {
    if (!Number.isFinite(value) || Number.isNaN(value)) return '0';
    let formatted = value.toFixed(decimals);
    if (trimZeros && formatted.includes('.')) {
      formatted = formatted.replace(/\.?0+$/, '');
    }
    return formatted;
  }

  /**
   * Show temporary toast notification
   */
  function showToast(message) {
    let toast = document.getElementById('calcToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'calcToast';
      toast.className = 'calc-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  /**
   * Copy text to user clipboard with button animation
   */
  function copyResultToClipboard(text, btnElement) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Result copied to clipboard!');
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }

    if (btnElement) {
      const originalText = btnElement.getAttribute('data-orig-text') || btnElement.textContent;
      btnElement.setAttribute('data-orig-text', originalText);
      btnElement.textContent = 'Copied!';
      setTimeout(() => {
        btnElement.textContent = originalText;
      }, 1800);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      showToast('Result copied to clipboard!');
    } catch (e) {
      showToast('Could not copy to clipboard.');
    }
    document.body.removeChild(ta);
  }

  /* ==========================================================================
     3. GPA CALCULATOR MODULE
     ========================================================================== */
  function initGpaCalculator() {
    const coursesTableBody = document.getElementById('gpaCoursesBody');
    const addCourseBtn = document.getElementById('addCourseBtn');
    const resetScaleBtn = document.getElementById('resetGradeScaleBtn');
    const gpaResultVal = document.getElementById('gpaResultValue');
    const gpaTotalCredits = document.getElementById('gpaTotalCredits');
    const gpaTotalPoints = document.getElementById('gpaTotalPoints');
    const gpaMessage = document.getElementById('gpaMessage');
    const copyGpaBtn = document.getElementById('copyGpaBtn');
    const clearGpaBtn = document.getElementById('clearGpaBtn');
    const gradeScaleGrid = document.getElementById('gradeScaleGrid');

    if (!coursesTableBody) return;

    // Local copy of grade scale
    let currentScale = Object.assign({}, CALC_CONFIG.defaultGradeScale);

    // Build editable grade scale table
    function renderGradeScaleInputs() {
      if (!gradeScaleGrid) return;
      gradeScaleGrid.innerHTML = '';
      Object.keys(currentScale).forEach(grade => {
        const item = document.createElement('div');
        item.className = 'grade-scale-item';
        item.innerHTML = `
          <span class="grade-scale-letter">${grade}</span>
          <input type="text" inputmode="decimal" class="grade-scale-input" data-grade="${grade}" value="${currentScale[grade]}">
        `;
        gradeScaleGrid.appendChild(item);
      });

      gradeScaleGrid.querySelectorAll('.grade-scale-input').forEach(input => {
        input.addEventListener('input', function () {
          const g = this.getAttribute('data-grade');
          const val = parseSafeNumber(this.value);
          if (val !== null && val >= 0) {
            currentScale[g] = val;
            calculateGpa();
          }
        });
      });
    }

    // Build grade dropdown options
    function getGradeSelectOptions(selected = 'A') {
      return Object.keys(currentScale).map(g => {
        return `<option value="${g}" ${g === selected ? 'selected' : ''}>${g} (${currentScale[g]})</option>`;
      }).join('');
    }

    // Add Course Row
    let courseCounter = 0;
    function addCourseRow(name = '', credits = '', grade = 'A') {
      courseCounter++;
      const tr = document.createElement('tr');
      tr.className = 'calc-row-item';
      tr.innerHTML = `
        <td>
          <input type="text" class="calc-input course-name-input" placeholder="Course ${courseCounter}" value="${name}">
        </td>
        <td>
          <input type="text" inputmode="decimal" class="calc-input course-credits-input" placeholder="e.g. 3" value="${credits}">
        </td>
        <td>
          <select class="calc-input form-select course-grade-select">
            ${getGradeSelectOptions(grade)}
          </select>
        </td>
        <td style="text-align: center; width: 44px;">
          <button type="button" class="btn-remove-row remove-course-btn" aria-label="Remove Course">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </td>
      `;

      tr.querySelector('.remove-course-btn').addEventListener('click', function () {
        const rows = coursesTableBody.querySelectorAll('tr');
        if (rows.length > 1) {
          tr.remove();
          calculateGpa();
        } else {
          // Clear row instead of deleting last row
          tr.querySelectorAll('input').forEach(i => i.value = '');
          calculateGpa();
        }
      });

      tr.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', calculateGpa);
        el.addEventListener('change', calculateGpa);
      });

      coursesTableBody.appendChild(tr);
    }

    // Calculate GPA
    function calculateGpa() {
      const rows = coursesTableBody.querySelectorAll('tr');
      let totalCredits = 0;
      let totalGradePoints = 0;
      let hasError = false;
      let errorMsg = '';
      let validRowCount = 0;

      rows.forEach(row => {
        const creditInput = row.querySelector('.course-credits-input');
        const gradeSelect = row.querySelector('.course-grade-select');
        const rawCredit = creditInput.value.trim();

        if (rawCredit === '') return; // Skip empty row

        const creditVal = parseSafeNumber(rawCredit);
        if (creditVal === null || creditVal < 0) {
          hasError = true;
          errorMsg = 'Please enter a valid positive number for credit hours.';
          return;
        }

        const gradeLetter = gradeSelect.value;
        const gradePoint = currentScale[gradeLetter] !== undefined ? currentScale[gradeLetter] : 0;

        totalCredits += creditVal;
        totalGradePoints += (creditVal * gradePoint);
        validRowCount++;
      });

      if (hasError) {
        gpaResultVal.textContent = '—';
        gpaTotalCredits.textContent = '0';
        gpaTotalPoints.textContent = '0';
        if (gpaMessage) gpaMessage.textContent = errorMsg;
        return;
      }

      if (validRowCount === 0 || totalCredits === 0) {
        gpaResultVal.textContent = '0.00';
        gpaTotalCredits.textContent = '0';
        gpaTotalPoints.textContent = '0.00';
        if (gpaMessage) gpaMessage.textContent = 'Enter course credit hours and select your grades to calculate your GPA.';
        return;
      }

      const gpa = totalGradePoints / totalCredits;
      gpaResultVal.textContent = formatDisplayNumber(gpa, 2);
      gpaTotalCredits.textContent = formatDisplayNumber(totalCredits, 2, true);
      gpaTotalPoints.textContent = formatDisplayNumber(totalGradePoints, 2);
      if (gpaMessage) gpaMessage.textContent = '';
    }

    // Initial 5 courses
    for (let i = 0; i < 5; i++) {
      addCourseRow();
    }

    renderGradeScaleInputs();

    // Event listeners
    if (addCourseBtn) {
      addCourseBtn.addEventListener('click', () => {
        addCourseRow();
        calculateGpa();
      });
    }

    if (resetScaleBtn) {
      resetScaleBtn.addEventListener('click', () => {
        currentScale = Object.assign({}, CALC_CONFIG.defaultGradeScale);
        renderGradeScaleInputs();
        // Update all existing grade dropdowns
        coursesTableBody.querySelectorAll('tr').forEach(row => {
          const select = row.querySelector('.course-grade-select');
          const currentVal = select.value;
          select.innerHTML = getGradeSelectOptions(currentVal);
        });
        calculateGpa();
        showToast('Grade scale reset to defaults.');
      });
    }

    if (copyGpaBtn) {
      copyGpaBtn.addEventListener('click', () => {
        const text = `GPA: ${gpaResultVal.textContent} (Credits: ${gpaTotalCredits.textContent}, Points: ${gpaTotalPoints.textContent})`;
        copyResultToClipboard(text, copyGpaBtn);
      });
    }

    if (clearGpaBtn) {
      clearGpaBtn.addEventListener('click', () => {
        coursesTableBody.innerHTML = '';
        courseCounter = 0;
        for (let i = 0; i < 5; i++) {
          addCourseRow();
        }
        calculateGpa();
        showToast('Fields cleared.');
      });
    }

    // Initial run
    calculateGpa();
  }

  /* ==========================================================================
     4. CGPA CALCULATOR MODULE
     ========================================================================== */
  function initCgpaCalculator() {
    const semestersBody = document.getElementById('cgpaSemestersBody');
    const addSemesterBtn = document.getElementById('addSemesterBtn');
    const noCreditsToggle = document.getElementById('noCreditsToggle');
    const cgpaResultVal = document.getElementById('cgpaResultValue');
    const cgpaTotalCredits = document.getElementById('cgpaTotalCredits');
    const cgpaFormulaText = document.getElementById('cgpaFormulaText');
    const cgpaMessage = document.getElementById('cgpaMessage');
    const copyCgpaBtn = document.getElementById('copyCgpaBtn');
    const clearCgpaBtn = document.getElementById('clearCgpaBtn');

    // What GPA do I need next semester inputs
    const targetCgpaInput = document.getElementById('targetCgpaInput');
    const nextCreditsInput = document.getElementById('nextCreditsInput');
    const maxScaleInput = document.getElementById('maxScaleInput');
    const neededResultVal = document.getElementById('neededResultValue');
    const neededMessage = document.getElementById('neededMessage');
    const copyNeededBtn = document.getElementById('copyNeededBtn');

    if (!semestersBody) return;

    let semesterCounter = 0;
    function addSemesterRow(gpa = '', credits = '') {
      semesterCounter++;
      const tr = document.createElement('tr');
      tr.className = 'calc-row-item';
      tr.innerHTML = `
        <td style="font-weight: 600; color: var(--text-main);">
          Semester ${semesterCounter}
        </td>
        <td>
          <input type="text" inputmode="decimal" class="calc-input sem-gpa-input" placeholder="e.g. 3.5" value="${gpa}">
        </td>
        <td class="credits-cell">
          <input type="text" inputmode="decimal" class="calc-input sem-credits-input" placeholder="e.g. 15" value="${credits}">
        </td>
        <td style="text-align: center; width: 44px;">
          <button type="button" class="btn-remove-row remove-sem-btn" aria-label="Remove Semester">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </td>
      `;

      tr.querySelector('.remove-sem-btn').addEventListener('click', function () {
        const rows = semestersBody.querySelectorAll('tr');
        if (rows.length > 1) {
          tr.remove();
          relabelSemesters();
          calculateCgpa();
        } else {
          tr.querySelectorAll('input').forEach(i => i.value = '');
          calculateCgpa();
        }
      });

      tr.querySelectorAll('input').forEach(el => {
        el.addEventListener('input', calculateCgpa);
      });

      semestersBody.appendChild(tr);
    }

    function relabelSemesters() {
      const rows = semestersBody.querySelectorAll('tr');
      rows.forEach((row, idx) => {
        const firstCell = row.querySelector('td');
        if (firstCell) firstCell.textContent = `Semester ${idx + 1}`;
      });
      semesterCounter = rows.length;
    }

    // Toggle credit hours mode
    function updateCreditsVisibility() {
      const isSimpleAverage = noCreditsToggle ? noCreditsToggle.checked : false;
      document.querySelectorAll('.credits-col-head, .credits-cell').forEach(el => {
        el.style.display = isSimpleAverage ? 'none' : '';
      });
      if (cgpaFormulaText) {
        cgpaFormulaText.textContent = isSimpleAverage
          ? 'Formula: CGPA = Sum of Semester GPAs ÷ Total Semesters.'
          : 'Formula: CGPA = Sum of (Semester GPA × Credit Hours) ÷ Total Credit Hours.';
      }
      calculateCgpa();
    }

    if (noCreditsToggle) {
      noCreditsToggle.addEventListener('change', updateCreditsVisibility);
    }

    // Main calculation
    let currentCalcState = { cgpa: 0, totalCredits: 0, totalPoints: 0, count: 0 };

    function calculateCgpa() {
      const isSimpleAverage = noCreditsToggle ? noCreditsToggle.checked : false;
      const rows = semestersBody.querySelectorAll('tr');

      let totalCredits = 0;
      let totalGradePoints = 0;
      let sumGpa = 0;
      let validCount = 0;
      let hasError = false;
      let errorMsg = '';

      rows.forEach(row => {
        const gpaInput = row.querySelector('.sem-gpa-input');
        const creditInput = row.querySelector('.sem-credits-input');

        const rawGpa = gpaInput.value.trim();
        if (rawGpa === '') return;

        const gpaVal = parseSafeNumber(rawGpa);
        if (gpaVal === null || gpaVal < 0) {
          hasError = true;
          errorMsg = 'Please enter a valid positive GPA.';
          return;
        }

        if (isSimpleAverage) {
          sumGpa += gpaVal;
          validCount++;
        } else {
          const rawCredit = creditInput.value.trim();
          if (rawCredit === '') return;
          const creditVal = parseSafeNumber(rawCredit);
          if (creditVal === null || creditVal <= 0) {
            hasError = true;
            errorMsg = 'Please enter credit hours greater than zero.';
            return;
          }
          totalCredits += creditVal;
          totalGradePoints += (gpaVal * creditVal);
          validCount++;
        }
      });

      if (hasError) {
        cgpaResultVal.textContent = '—';
        cgpaTotalCredits.textContent = '0';
        if (cgpaMessage) cgpaMessage.textContent = errorMsg;
        currentCalcState = { cgpa: 0, totalCredits: 0, totalPoints: 0, count: 0 };
        calculateNeededGpa();
        return;
      }

      if (validCount === 0) {
        cgpaResultVal.textContent = '0.00';
        cgpaTotalCredits.textContent = '0';
        if (cgpaMessage) cgpaMessage.textContent = 'Enter your semester GPAs to see your cumulative GPA.';
        currentCalcState = { cgpa: 0, totalCredits: 0, totalPoints: 0, count: 0 };
        calculateNeededGpa();
        return;
      }

      let cgpa = 0;
      if (isSimpleAverage) {
        cgpa = sumGpa / validCount;
        cgpaResultVal.textContent = formatDisplayNumber(cgpa, 2);
        cgpaTotalCredits.textContent = `${validCount} sem`;
      } else {
        if (totalCredits > 0) {
          cgpa = totalGradePoints / totalCredits;
        }
        cgpaResultVal.textContent = formatDisplayNumber(cgpa, 2);
        cgpaTotalCredits.textContent = formatDisplayNumber(totalCredits, 2, true);
      }

      currentCalcState = {
        cgpa: cgpa,
        totalCredits: totalCredits,
        totalPoints: isSimpleAverage ? sumGpa : totalGradePoints,
        count: validCount,
        isSimpleAverage: isSimpleAverage
      };

      if (cgpaMessage) cgpaMessage.textContent = '';
      calculateNeededGpa();
    }

    // What GPA do I need next semester
    function calculateNeededGpa() {
      if (!neededResultVal) return;

      const targetVal = parseSafeNumber(targetCgpaInput ? targetCgpaInput.value : '');
      const nextCreditsVal = parseSafeNumber(nextCreditsInput ? nextCreditsInput.value : '');
      const maxScaleVal = parseSafeNumber(maxScaleInput ? maxScaleInput.value : '') || 4.0;

      if (targetVal === null) {
        neededResultVal.textContent = '—';
        if (neededMessage) neededMessage.textContent = 'Enter your target CGPA to calculate required next semester GPA.';
        return;
      }

      if (currentCalcState.count === 0) {
        neededResultVal.textContent = '—';
        if (neededMessage) neededMessage.textContent = 'Please enter at least one completed semester above first.';
        return;
      }

      if (currentCalcState.isSimpleAverage) {
        // Simple average: Next semester is 1 additional unit
        const N = currentCalcState.count;
        const sumGpa = currentCalcState.totalPoints;
        const needed = targetVal * (N + 1) - sumGpa;

        if (needed > maxScaleVal) {
          neededResultVal.textContent = 'Not Possible';
          if (neededMessage) neededMessage.textContent = 'This target is not possible in one semester on this scale.';
        } else if (needed <= 0) {
          neededResultVal.textContent = '0.00';
          if (neededMessage) neededMessage.textContent = 'Target already met! Even with 0.00 GPA, your target is achieved.';
        } else {
          neededResultVal.textContent = formatDisplayNumber(needed, 2);
          if (neededMessage) neededMessage.textContent = `You need a ${formatDisplayNumber(needed, 2)} GPA next semester to reach ${targetVal}.`;
        }
        return;
      }

      // Weighted by credits
      if (nextCreditsVal === null || nextCreditsVal <= 0) {
        neededResultVal.textContent = '—';
        if (neededMessage) neededMessage.textContent = 'Enter next semester planned credit hours.';
        return;
      }

      const C1 = currentCalcState.totalCredits;
      const C2 = nextCreditsVal;
      const currentPoints = currentCalcState.totalPoints;

      // Formula: Needed GPA = (target * (C1 + C2) - currentPoints) / C2
      const neededGpa = (targetVal * (C1 + C2) - currentPoints) / C2;

      if (neededGpa > maxScaleVal) {
        neededResultVal.textContent = 'Not Possible';
        if (neededMessage) neededMessage.textContent = 'This target is not possible in one semester on this scale.';
      } else if (neededGpa <= 0) {
        neededResultVal.textContent = '0.00';
        if (neededMessage) neededMessage.textContent = 'Target already met! Even with 0.00 GPA, your target is achieved.';
      } else {
        neededResultVal.textContent = formatDisplayNumber(neededGpa, 2);
        if (neededMessage) neededMessage.textContent = `You need a ${formatDisplayNumber(neededGpa, 2)} GPA next semester to reach ${targetVal}.`;
      }
    }

    // Attach listeners for needed GPA inputs
    [targetCgpaInput, nextCreditsInput, maxScaleInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('input', calculateNeededGpa);
      }
    });

    // Start with 2 semesters
    addSemesterRow();
    addSemesterRow();

    if (addSemesterBtn) {
      addSemesterBtn.addEventListener('click', () => {
        addSemesterRow();
        calculateCgpa();
      });
    }

    if (copyCgpaBtn) {
      copyCgpaBtn.addEventListener('click', () => {
        const text = `CGPA: ${cgpaResultVal.textContent} (${cgpaTotalCredits.textContent} credits)`;
        copyResultToClipboard(text, copyCgpaBtn);
      });
    }

    if (copyNeededBtn) {
      copyNeededBtn.addEventListener('click', () => {
        const text = `Needed GPA Next Semester: ${neededResultVal.textContent}`;
        copyResultToClipboard(text, copyNeededBtn);
      });
    }

    if (clearCgpaBtn) {
      clearCgpaBtn.addEventListener('click', () => {
        semestersBody.innerHTML = '';
        semesterCounter = 0;
        addSemesterRow();
        addSemesterRow();
        if (targetCgpaInput) targetCgpaInput.value = '';
        if (nextCreditsInput) nextCreditsInput.value = '';
        if (maxScaleInput) maxScaleInput.value = '4.0';
        calculateCgpa();
        showToast('Fields cleared.');
      });
    }

    calculateCgpa();
  }

  /* ==========================================================================
     5. CGPA TO PERCENTAGE MODULE
     ========================================================================== */
  function initCgpaToPercentage() {
    const cgpaInput = document.getElementById('cgpaConvInput');
    const maxScaleInput = document.getElementById('maxScaleInput');
    const multiplierInput = document.getElementById('multiplierInput');
    const methodChoiceA = document.getElementById('methodA');
    const methodChoiceB = document.getElementById('methodB');
    const reverseModeToggle = document.getElementById('reverseModeToggle');
    const resultVal = document.getElementById('cgpaConvResult');
    const resultUnit = document.getElementById('cgpaConvUnit');
    const formulaText = document.getElementById('cgpaConvFormula');
    const messageArea = document.getElementById('cgpaConvMessage');
    const copyBtn = document.getElementById('copyCgpaConvBtn');
    const clearBtn = document.getElementById('clearCgpaConvBtn');
    const scalePills = document.querySelectorAll('.scale-preset-pill');

    if (!cgpaInput) return;

    let isReverse = false; // false: CGPA -> %, true: % -> CGPA

    // Quick scale buttons
    scalePills.forEach(pill => {
      pill.addEventListener('click', function () {
        scalePills.forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        if (maxScaleInput) {
          maxScaleInput.value = this.getAttribute('data-scale');
          calculateConversion();
        }
      });
    });

    if (maxScaleInput) {
      maxScaleInput.addEventListener('input', function () {
        scalePills.forEach(p => {
          if (p.getAttribute('data-scale') === maxScaleInput.value.trim()) {
            p.classList.add('active');
          } else {
            p.classList.remove('active');
          }
        });
        calculateConversion();
      });
    }

    // Toggle reverse mode
    if (reverseModeToggle) {
      reverseModeToggle.addEventListener('change', function () {
        isReverse = this.checked;
        const inputLabel = document.getElementById('cgpaInputLabel');
        const inputHint = document.getElementById('cgpaInputHint');
        const resultLabel = document.getElementById('cgpaResultLabel');

        if (isReverse) {
          if (inputLabel) inputLabel.textContent = 'Enter Percentage (%)';
          if (inputHint) inputHint.textContent = 'Type your percentage (e.g. 75)';
          if (resultLabel) resultLabel.textContent = 'Converted CGPA';
          if (resultUnit) resultUnit.textContent = '';
        } else {
          if (inputLabel) inputLabel.textContent = 'Enter CGPA';
          if (inputHint) inputHint.textContent = 'Type your CGPA (e.g. 3.0)';
          if (resultLabel) resultLabel.textContent = 'Converted Percentage';
          if (resultUnit) resultUnit.textContent = '%';
        }
        calculateConversion();
      });
    }

    // Method selection change
    [methodChoiceA, methodChoiceB].forEach(radio => {
      if (radio) {
        radio.addEventListener('change', function () {
          const multGroup = document.getElementById('multiplierGroup');
          const scaleGroup = document.getElementById('scaleGroup');
          if (methodChoiceB.checked) {
            if (multGroup) multGroup.style.display = '';
            if (scaleGroup) scaleGroup.style.display = 'none';
          } else {
            if (multGroup) multGroup.style.display = 'none';
            if (scaleGroup) scaleGroup.style.display = '';
          }
          calculateConversion();
        });
      }
    });

    [cgpaInput, multiplierInput].forEach(inp => {
      if (inp) inp.addEventListener('input', calculateConversion);
    });

    function calculateConversion() {
      const rawInput = cgpaInput.value.trim();
      const numVal = parseSafeNumber(rawInput);

      if (numVal === null) {
        resultVal.textContent = '—';
        if (messageArea) messageArea.textContent = isReverse ? 'Enter a percentage to convert.' : 'Enter your CGPA to convert.';
        return;
      }

      if (numVal < 0) {
        resultVal.textContent = '—';
        if (messageArea) messageArea.textContent = 'Value cannot be negative.';
        return;
      }

      const isMethodB = methodChoiceB && methodChoiceB.checked;

      if (!isReverse) {
        // Forward: CGPA -> Percentage
        if (isMethodB) {
          const mult = parseSafeNumber(multiplierInput ? multiplierInput.value : '');
          if (mult === null || mult <= 0) {
            resultVal.textContent = '—';
            if (messageArea) messageArea.textContent = 'Please enter your institution’s multiplier.';
            return;
          }
          const percent = numVal * mult;
          resultVal.textContent = formatDisplayNumber(percent, 2, true);
          if (formulaText) formulaText.textContent = `Formula: Percentage = CGPA (${numVal}) × Multiplier (${mult}).`;

          if (percent > 100) {
            if (messageArea) messageArea.textContent = 'This result is above 100%. Please check your numbers.';
          } else {
            if (messageArea) messageArea.textContent = '';
          }
        } else {
          // Method A: (CGPA / maxScale) * 100
          const maxScale = parseSafeNumber(maxScaleInput ? maxScaleInput.value : '') || 4.0;
          if (maxScale <= 0) {
            resultVal.textContent = '—';
            if (messageArea) messageArea.textContent = 'Max CGPA scale must be greater than zero.';
            return;
          }
          const percent = (numVal / maxScale) * 100;
          resultVal.textContent = formatDisplayNumber(percent, 2, true);
          if (formulaText) formulaText.textContent = `Formula: Percentage = (CGPA (${numVal}) ÷ Max Scale (${maxScale})) × 100.`;

          if (percent > 100) {
            if (messageArea) messageArea.textContent = 'This result is above 100%. Please check your numbers.';
          } else {
            if (messageArea) messageArea.textContent = '';
          }
        }
      } else {
        // Reverse: Percentage -> CGPA
        if (isMethodB) {
          const mult = parseSafeNumber(multiplierInput ? multiplierInput.value : '');
          if (mult === null || mult <= 0) {
            resultVal.textContent = '—';
            if (messageArea) messageArea.textContent = 'Please enter your institution’s multiplier.';
            return;
          }
          const cgpa = numVal / mult;
          resultVal.textContent = formatDisplayNumber(cgpa, 2, true);
          if (formulaText) formulaText.textContent = `Formula: CGPA = Percentage (${numVal}%) ÷ Multiplier (${mult}).`;

          if (numVal > 100) {
            if (messageArea) messageArea.textContent = 'This input is above 100%. Please check your numbers.';
          } else {
            if (messageArea) messageArea.textContent = '';
          }
        } else {
          // Method A: (Percentage / 100) * maxScale
          const maxScale = parseSafeNumber(maxScaleInput ? maxScaleInput.value : '') || 4.0;
          if (maxScale <= 0) {
            resultVal.textContent = '—';
            if (messageArea) messageArea.textContent = 'Max CGPA scale must be greater than zero.';
            return;
          }
          const cgpa = (numVal / 100) * maxScale;
          resultVal.textContent = formatDisplayNumber(cgpa, 2, true);
          if (formulaText) formulaText.textContent = `Formula: CGPA = (Percentage (${numVal}%) ÷ 100) × Max Scale (${maxScale}).`;

          if (numVal > 100) {
            if (messageArea) messageArea.textContent = 'This input is above 100%. Please check your numbers.';
          } else {
            if (messageArea) messageArea.textContent = '';
          }
        }
      }
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = isReverse ? `CGPA: ${resultVal.textContent}` : `Percentage: ${resultVal.textContent}%`;
        copyResultToClipboard(text, copyBtn);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        cgpaInput.value = '';
        if (multiplierInput) multiplierInput.value = '';
        calculateConversion();
        showToast('Fields cleared.');
      });
    }

    calculateConversion();
  }

  /* ==========================================================================
     6. PERCENTAGE CALCULATOR MODULE
     ========================================================================== */
  function initPercentageCalculator() {
    const tabs = document.querySelectorAll('.percent-tab-btn');
    const tabPanels = document.querySelectorAll('.percent-tab-panel');
    const copyBtn = document.getElementById('copyPercentBtn');
    const clearBtn = document.getElementById('clearPercentBtn');
    const primaryResult = document.getElementById('percentPrimaryResult');
    const formulaText = document.getElementById('percentFormulaText');
    const messageArea = document.getElementById('percentMessage');
    const statusBadge = document.getElementById('percentStatusBadge');

    if (!primaryResult) return;

    let activeTabId = 'tab1'; // tab1: X% of Y, tab2: X is % of Y, tab3: % change, tab4: marks %

    tabs.forEach(tab => {
      tab.addEventListener('click', function () {
        tabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        activeTabId = this.getAttribute('data-tab');

        tabPanels.forEach(panel => {
          if (panel.id === activeTabId) {
            panel.style.display = '';
          } else {
            panel.style.display = 'none';
          }
        });
        calculateActivePercentage();
      });
    });

    // Attach listeners to all inputs
    document.querySelectorAll('.pct-input').forEach(inp => {
      inp.addEventListener('input', calculateActivePercentage);
    });

    function calculateActivePercentage() {
      if (statusBadge) statusBadge.style.display = 'none';

      if (activeTabId === 'tab1') {
        // What is X% of Y?
        const xVal = parseSafeNumber(document.getElementById('t1_x').value);
        const yVal = parseSafeNumber(document.getElementById('t1_y').value);

        if (xVal === null || yVal === null) {
          primaryResult.textContent = '—';
          if (messageArea) messageArea.textContent = 'Enter both numbers to calculate.';
          if (formulaText) formulaText.textContent = 'Formula: Result = (X ÷ 100) × Y.';
          return;
        }

        const res = (xVal / 100) * yVal;
        primaryResult.textContent = formatDisplayNumber(res, 2, true);
        if (messageArea) messageArea.textContent = `${xVal}% of ${yVal} is ${formatDisplayNumber(res, 2, true)}.`;
        if (formulaText) formulaText.textContent = `Formula: (${xVal} ÷ 100) × ${yVal} = ${formatDisplayNumber(res, 2, true)}.`;

      } else if (activeTabId === 'tab2') {
        // X is what percent of Y?
        const xVal = parseSafeNumber(document.getElementById('t2_x').value);
        const yVal = parseSafeNumber(document.getElementById('t2_y').value);

        if (xVal === null || yVal === null) {
          primaryResult.textContent = '—';
          if (messageArea) messageArea.textContent = 'Enter both numbers to calculate.';
          if (formulaText) formulaText.textContent = 'Formula: Percentage = (X ÷ Y) × 100.';
          return;
        }

        if (yVal === 0) {
          primaryResult.textContent = '—';
          if (messageArea) messageArea.textContent = 'Cannot divide by zero. Please enter a base number greater than 0.';
          return;
        }

        const res = (xVal / yVal) * 100;
        primaryResult.textContent = `${formatDisplayNumber(res, 2, true)}%`;
        if (messageArea) messageArea.textContent = `${xVal} is ${formatDisplayNumber(res, 2, true)}% of ${yVal}.`;
        if (formulaText) formulaText.textContent = `Formula: (${xVal} ÷ ${yVal}) × 100 = ${formatDisplayNumber(res, 2, true)}%.`;

      } else if (activeTabId === 'tab3') {
        // Percentage change from X to Y
        const xVal = parseSafeNumber(document.getElementById('t3_x').value);
        const yVal = parseSafeNumber(document.getElementById('t3_y').value);

        if (xVal === null || yVal === null) {
          primaryResult.textContent = '—';
          if (messageArea) messageArea.textContent = 'Enter initial and final values to calculate change.';
          if (formulaText) formulaText.textContent = 'Formula: Percentage Change = ((Final − Initial) ÷ |Initial|) × 100.';
          return;
        }

        if (xVal === 0) {
          primaryResult.textContent = '—';
          if (messageArea) messageArea.textContent = 'Initial value cannot be zero to calculate percentage change.';
          return;
        }

        const diff = yVal - xVal;
        const res = (diff / Math.abs(xVal)) * 100;

        if (statusBadge) {
          statusBadge.style.display = 'inline-flex';
          if (diff > 0) {
            statusBadge.className = 'calc-status-badge calc-status-success';
            statusBadge.textContent = 'Increase';
            primaryResult.textContent = `+${formatDisplayNumber(res, 2, true)}%`;
          } else if (diff < 0) {
            statusBadge.className = 'calc-status-badge calc-status-danger';
            statusBadge.textContent = 'Decrease';
            primaryResult.textContent = `${formatDisplayNumber(res, 2, true)}%`;
          } else {
            statusBadge.className = 'calc-status-badge calc-status-info';
            statusBadge.textContent = 'No Change';
            primaryResult.textContent = '0%';
          }
        } else {
          primaryResult.textContent = `${res > 0 ? '+' : ''}${formatDisplayNumber(res, 2, true)}%`;
        }

        const actionWord = diff > 0 ? 'increase' : (diff < 0 ? 'decrease' : 'no change');
        if (messageArea) messageArea.textContent = `Change from ${xVal} to ${yVal} is a ${formatDisplayNumber(Math.abs(res), 2, true)}% ${actionWord}.`;
        if (formulaText) formulaText.textContent = `Formula: ((${yVal} − ${xVal}) ÷ |${xVal}|) × 100 = ${formatDisplayNumber(res, 2, true)}%.`;

      } else if (activeTabId === 'tab4') {
        // Marks percentage (obtained / total)
        const obtained = parseSafeNumber(document.getElementById('t4_x').value);
        const total = parseSafeNumber(document.getElementById('t4_y').value);

        if (obtained === null || total === null) {
          primaryResult.textContent = '—';
          if (messageArea) messageArea.textContent = 'Enter obtained marks and total marks.';
          if (formulaText) formulaText.textContent = 'Formula: Percentage = (Obtained Marks ÷ Total Marks) × 100.';
          return;
        }

        if (total <= 0) {
          primaryResult.textContent = '—';
          if (messageArea) messageArea.textContent = 'Total marks must be greater than zero.';
          return;
        }

        if (obtained < 0) {
          primaryResult.textContent = '—';
          if (messageArea) messageArea.textContent = 'Obtained marks cannot be negative.';
          return;
        }

        const res = (obtained / total) * 100;
        primaryResult.textContent = `${formatDisplayNumber(res, 2, true)}%`;
        if (messageArea) messageArea.textContent = `You scored ${obtained} out of ${total} marks (${formatDisplayNumber(res, 2, true)}%).`;
        if (formulaText) formulaText.textContent = `Formula: (${obtained} ÷ ${total}) × 100 = ${formatDisplayNumber(res, 2, true)}%.`;
      }
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        copyResultToClipboard(primaryResult.textContent, copyBtn);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        document.querySelectorAll('.pct-input').forEach(i => i.value = '');
        calculateActivePercentage();
        showToast('Fields cleared.');
      });
    }

    calculateActivePercentage();
  }

  /* ==========================================================================
     7. ATTENDANCE CALCULATOR MODULE
     ========================================================================== */
  function initAttendanceCalculator() {
    const heldInput = document.getElementById('attHeldInput');
    const attendedInput = document.getElementById('attAttendedInput');
    const reqInput = document.getElementById('attReqInput');
    const totalPlannedInput = document.getElementById('attTotalPlannedInput');
    const primaryResult = document.getElementById('attResultValue');
    const statusBadge = document.getElementById('attStatusBadge');
    const subMessage = document.getElementById('attSubMessage');
    const consecutiveBox = document.getElementById('attConsecutiveBox');
    const missableBox = document.getElementById('attMissableBox');
    const copyBtn = document.getElementById('copyAttBtn');
    const clearBtn = document.getElementById('clearAttBtn');
    const reqPills = document.querySelectorAll('.att-req-pill');

    if (!heldInput) return;

    // Quick requirement pills
    reqPills.forEach(pill => {
      pill.addEventListener('click', function () {
        reqPills.forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        if (reqInput) {
          reqInput.value = this.getAttribute('data-req');
          calculateAttendance();
        }
      });
    });

    if (reqInput) {
      reqInput.addEventListener('input', function () {
        reqPills.forEach(p => {
          if (p.getAttribute('data-req') === reqInput.value.trim()) {
            p.classList.add('active');
          } else {
            p.classList.remove('active');
          }
        });
        calculateAttendance();
      });
    }

    [heldInput, attendedInput, totalPlannedInput].forEach(inp => {
      if (inp) inp.addEventListener('input', calculateAttendance);
    });

    function calculateAttendance() {
      const held = parseSafeNumber(heldInput.value);
      const attended = parseSafeNumber(attendedInput.value);
      const req = parseSafeNumber(reqInput.value) || CALC_CONFIG.attendance.defaultRequiredPercent;
      const totalPlanned = parseSafeNumber(totalPlannedInput ? totalPlannedInput.value : '');

      // Hide extra boxes initially
      if (consecutiveBox) consecutiveBox.style.display = 'none';
      if (missableBox) missableBox.style.display = 'none';

      if (held === null || attended === null) {
        primaryResult.textContent = '—';
        if (statusBadge) statusBadge.style.display = 'none';
        if (subMessage) subMessage.textContent = 'Enter classes held and classes attended to calculate attendance.';
        return;
      }

      if (held <= 0) {
        primaryResult.textContent = '—';
        if (statusBadge) statusBadge.style.display = 'none';
        if (subMessage) subMessage.textContent = 'Classes held so far must be at least 1.';
        return;
      }

      if (attended < 0) {
        primaryResult.textContent = '—';
        if (statusBadge) statusBadge.style.display = 'none';
        if (subMessage) subMessage.textContent = 'Classes attended cannot be negative.';
        return;
      }

      if (attended > held) {
        primaryResult.textContent = '—';
        if (statusBadge) statusBadge.style.display = 'none';
        if (subMessage) subMessage.textContent = 'Attended classes cannot be greater than classes held so far.';
        return;
      }

      if (req <= 0 || req > 100) {
        primaryResult.textContent = '—';
        if (statusBadge) statusBadge.style.display = 'none';
        if (subMessage) subMessage.textContent = 'Required percentage must be between 1% and 100%.';
        return;
      }

      // Exact attendance fraction and percentage
      const currentPct = (attended / held) * 100;
      primaryResult.textContent = `${formatDisplayNumber(currentPct, 2)}%`;

      // Status check (with small epsilon to avoid float rounding errors: 1e-9)
      const p = req / 100;
      const meetsRequirement = (attended * 100) >= (req * held - 1e-9);

      if (statusBadge) {
        statusBadge.style.display = 'inline-flex';
        if (meetsRequirement) {
          statusBadge.className = 'calc-status-badge calc-status-success';
          statusBadge.textContent = 'You meet the requirement';
        } else {
          statusBadge.className = 'calc-status-badge calc-status-danger';
          statusBadge.textContent = 'You are below the requirement';
        }
      }

      if (subMessage) {
        subMessage.textContent = `You have attended ${attended} out of ${held} classes held so far.`;
      }

      // If below requirement, calculate consecutive classes needed
      if (!meetsRequirement) {
        if (req >= 100) {
          if (consecutiveBox) {
            consecutiveBox.style.display = 'block';
            consecutiveBox.innerHTML = `<strong>Target unreachable:</strong> Since you have already missed a class, 100% attendance cannot be reached.`;
          }
        } else {
          // Formula: ceil((p * held - attended) / (1 - p))
          // Using small epsilon deduction to ensure exact integer boundary handling
          const needed = Math.ceil(((p * held - attended) - 1e-9) / (1 - p));
          const safeNeeded = Math.max(1, needed);
          if (consecutiveBox) {
            consecutiveBox.style.display = 'block';
            consecutiveBox.innerHTML = `You need to attend <strong>${safeNeeded}</strong> consecutive class${safeNeeded === 1 ? '' : 'es'} in a row without missing to reach ${req}%.`;
          }
        }
      }

      // If total planned classes given, calculate how many more classes can be missed
      if (totalPlanned !== null) {
        if (totalPlanned < held) {
          if (missableBox) {
            missableBox.style.display = 'block';
            missableBox.innerHTML = `Total course classes cannot be less than classes held so far (${held}).`;
          }
        } else {
          // Formula: floor(totalPlanned * (1 - p)) - (held - attended)
          const maxAbsencesAllowed = Math.floor(totalPlanned * (1 - p) + 1e-9);
          const currentAbsences = held - attended;
          const missable = maxAbsencesAllowed - currentAbsences;

          if (missableBox) {
            missableBox.style.display = 'block';
            if (missable < 0) {
              missableBox.innerHTML = `<strong>Warning:</strong> You have missed ${currentAbsences} classes. The required ${req}% can no longer be reached in this course.`;
            } else if (missable === 0) {
              missableBox.innerHTML = `You have <strong>0</strong> more classes you can miss. You must attend all remaining classes to maintain ${req}%.`;
            } else {
              missableBox.innerHTML = `You can miss <strong>${missable}</strong> more class${missable === 1 ? '' : 'es'} and still maintain ${req}% attendance overall.`;
            }
          }
        }
      }
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = `Attendance: ${primaryResult.textContent} (${attendedInput.value}/${heldInput.value} classes)`;
        copyResultToClipboard(text, copyBtn);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        heldInput.value = '';
        attendedInput.value = '';
        if (totalPlannedInput) totalPlannedInput.value = '';
        if (reqInput) reqInput.value = '75';
        calculateAttendance();
        showToast('Fields cleared.');
      });
    }

    calculateAttendance();
  }

  /* ==========================================================================
     9. PROPERTY & REAL ESTATE CALCULATORS MODULE
     ========================================================================== */

  /**
   * Safe localStorage settings manager for property calculators
   * ONLY stores: number style ('standard' | 'lakh'), currency label, and marla size.
   */
  function getPropertySettings() {
    let numStyle = CALC_CONFIG.property.defaultNumberStyle;
    let currency = CALC_CONFIG.property.defaultCurrency;
    let marlaSize = CALC_CONFIG.property.defaultMarlaSize;

    try {
      const sStyle = localStorage.getItem('fs_property_num_style');
      if (sStyle === 'standard' || sStyle === 'lakh') numStyle = sStyle;

      const sCurr = localStorage.getItem('fs_property_currency');
      if (['PKR', 'INR', 'USD', 'none'].includes(sCurr)) currency = sCurr;

      const sMarla = parseFloat(localStorage.getItem('fs_property_marla_size'));
      if (Number.isFinite(sMarla) && sMarla > 0) marlaSize = sMarla;
    } catch (e) {
      // LocalStorage access restricted (e.g. strict private mode)
    }

    return { numStyle, currency, marlaSize };
  }

  function savePropertySetting(key, val) {
    const allowed = ['fs_property_num_style', 'fs_property_currency', 'fs_property_marla_size'];
    if (!allowed.includes(key)) return;
    try {
      localStorage.setItem(key, String(val));
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * Safely formats currency and numeric values for property calculations.
   * Respects user's number style ('1,000,000' vs '10,00,000') and currency label.
   * Avoids NaN, Infinity, and scientific notation.
   */
  function formatPropertyValue(val, decimals = 2, trimZeros = false, includeCurrency = true) {
    if (val === null || val === undefined || !Number.isFinite(val) || Number.isNaN(val)) {
      return '—';
    }

    const settings = getPropertySettings();
    const locale = settings.numStyle === 'lakh' ? 'en-IN' : 'en-US';
    const minDec = trimZeros ? 0 : decimals;
    const maxDec = decimals;

    const factor = Math.pow(10, decimals);
    const rounded = Math.round(val * factor) / factor;

    const numStr = rounded.toLocaleString(locale, {
      minimumFractionDigits: minDec,
      maximumFractionDigits: maxDec
    });

    if (!includeCurrency || settings.currency === 'none') {
      return numStr;
    }
    return settings.currency + ' ' + numStr;
  }

  /**
   * Convert area value from any supported unit to square feet.
   */
  function convertAreaToSqFt(area, unit, marlaSize) {
    if (!Number.isFinite(area) || area <= 0) return 0;
    const mSize = marlaSize || CALC_CONFIG.property.defaultMarlaSize;
    const u = (unit || 'sqft').toLowerCase();

    switch (u) {
      case 'sqft':
      case 'square feet':
      case 'square-feet':
        return area;
      case 'marla':
        return area * mSize;
      case 'kanal':
        return area * (mSize * CALC_CONFIG.property.marlasPerKanal);
      case 'sqyd':
      case 'square yard':
      case 'square-yard':
        return area * CALC_CONFIG.property.sqFtPerSqYard;
      case 'sqm':
      case 'square meter':
      case 'square-meter':
        return area * CALC_CONFIG.property.sqFtPerSqMeter;
      default:
        return area;
    }
  }

  /**
   * Convert area in square feet to all standard property units.
   */
  function convertSqFtToAllUnits(sqft, marlaSize) {
    const mSize = marlaSize || CALC_CONFIG.property.defaultMarlaSize;
    if (!Number.isFinite(sqft) || sqft < 0) {
      return { sqft: 0, marla: 0, kanal: 0, sqyd: 0, sqm: 0 };
    }
    return {
      sqft: sqft,
      marla: sqft / mSize,
      kanal: (sqft / mSize) / CALC_CONFIG.property.marlasPerKanal,
      sqyd: sqft / CALC_CONFIG.property.sqFtPerSqYard,
      sqm: sqft / CALC_CONFIG.property.sqFtPerSqMeter
    };
  }

  /**
   * Wire up the shared settings bar (Number Style, Currency Label, Marla Size)
   */
  function bindPropertySettingsBar(onSettingsChange) {
    const numStyleBtns = document.querySelectorAll('.setting-num-style-btn');
    const currencySelect = document.getElementById('settingCurrencySelect');
    const marlaSizeSelect = document.getElementById('settingMarlaSelect');
    const marlaCustomGroup = document.getElementById('settingMarlaCustomGroup');
    const marlaCustomInput = document.getElementById('settingMarlaCustomInput');
    const marlaBadges = document.querySelectorAll('.marla-size-text');

    const currentSettings = getPropertySettings();

    // 1. Sync Number Style buttons
    if (numStyleBtns.length > 0) {
      numStyleBtns.forEach(btn => {
        const style = btn.getAttribute('data-style');
        btn.classList.toggle('active', style === currentSettings.numStyle);
        btn.setAttribute('aria-pressed', style === currentSettings.numStyle ? 'true' : 'false');
        btn.addEventListener('click', function () {
          const newStyle = this.getAttribute('data-style');
          savePropertySetting('fs_property_num_style', newStyle);
          numStyleBtns.forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-style') === newStyle);
            b.setAttribute('aria-pressed', b.getAttribute('data-style') === newStyle ? 'true' : 'false');
          });
          if (typeof onSettingsChange === 'function') onSettingsChange();
        });
      });
    }

    // 2. Sync Currency Select
    if (currencySelect) {
      currencySelect.value = currentSettings.currency;
      currencySelect.addEventListener('change', function () {
        savePropertySetting('fs_property_currency', this.value);
        if (typeof onSettingsChange === 'function') onSettingsChange();
      });
    }

    // 3. Sync Marla Size Select
    function updateMarlaBadges(size) {
      marlaBadges.forEach(el => {
        el.textContent = `${formatPropertyValue(size, 2, true, false)} sq ft`;
      });
    }

    updateMarlaBadges(currentSettings.marlaSize);

    if (marlaSizeSelect) {
      const knownSizes = ['272.25', '250', '225'];
      const currentSizeStr = String(currentSettings.marlaSize);
      if (knownSizes.includes(currentSizeStr)) {
        marlaSizeSelect.value = currentSizeStr;
        if (marlaCustomGroup) marlaCustomGroup.style.display = 'none';
      } else {
        marlaSizeSelect.value = 'custom';
        if (marlaCustomGroup) marlaCustomGroup.style.display = 'inline-flex';
        if (marlaCustomInput) marlaCustomInput.value = currentSizeStr;
      }

      marlaSizeSelect.addEventListener('change', function () {
        if (this.value === 'custom') {
          if (marlaCustomGroup) marlaCustomGroup.style.display = 'inline-flex';
          if (marlaCustomInput) {
            marlaCustomInput.focus();
            const customVal = parseFloat(marlaCustomInput.value);
            if (Number.isFinite(customVal) && customVal > 0) {
              savePropertySetting('fs_property_marla_size', customVal);
              updateMarlaBadges(customVal);
              if (typeof onSettingsChange === 'function') onSettingsChange();
            }
          }
        } else {
          if (marlaCustomGroup) marlaCustomGroup.style.display = 'none';
          const sizeVal = parseFloat(this.value);
          if (Number.isFinite(sizeVal) && sizeVal > 0) {
            savePropertySetting('fs_property_marla_size', sizeVal);
            updateMarlaBadges(sizeVal);
            if (typeof onSettingsChange === 'function') onSettingsChange();
          }
        }
      });
    }

    if (marlaCustomInput) {
      marlaCustomInput.addEventListener('input', function () {
        const val = parseFloat(this.value);
        if (Number.isFinite(val) && val > 0) {
          savePropertySetting('fs_property_marla_size', val);
          updateMarlaBadges(val);
          if (typeof onSettingsChange === 'function') onSettingsChange();
        }
      });
    }
  }

  /* --------------------------------------------------------------------------
     A. HOUSE CONSTRUCTION COST CALCULATOR
     -------------------------------------------------------------------------- */
  function initHouseConstructionCalculator() {
    const areaInput = document.getElementById('constArea');
    const unitSelect = document.getElementById('constUnit');
    const floorsInput = document.getElementById('constFloors');
    const greyRateInput = document.getElementById('constGreyRate');
    const finishRateInput = document.getElementById('constFinishRate');
    const otherCostsInput = document.getElementById('constOtherCosts');
    const bufferInput = document.getElementById('constBuffer');
    const bufferPills = document.querySelectorAll('.buffer-preset-pill');

    const totalAreaEl = document.getElementById('constTotalArea');
    const greyCostEl = document.getElementById('constGreyCost');
    const finishCostEl = document.getElementById('constFinishCost');
    const otherCostEl = document.getElementById('constOtherCost');
    const bufferCostEl = document.getElementById('constBufferCost');
    const grandTotalEl = document.getElementById('constGrandTotal');
    const costPerSqFtEl = document.getElementById('constCostPerSqFt');
    const formulaEl = document.getElementById('constFormulaText');
    const messageEl = document.getElementById('constMessage');

    const copyBtn = document.getElementById('copyConstBtn');
    const clearBtn = document.getElementById('clearConstBtn');

    if (!areaInput || !grandTotalEl) return;

    // Buffer preset buttons (0, 5, 10, 15)
    bufferPills.forEach(pill => {
      pill.addEventListener('click', function () {
        const val = this.getAttribute('data-buffer') || '0';
        if (bufferInput) bufferInput.value = val;
        bufferPills.forEach(p => p.classList.toggle('active', p === pill));
        calculateConstruction();
      });
    });

    if (bufferInput) {
      bufferInput.addEventListener('input', function () {
        const currentVal = this.value.trim();
        bufferPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-buffer') === currentVal));
        calculateConstruction();
      });
    }

    function calculateConstruction() {
      const settings = getPropertySettings();
      const rawArea = areaInput.value.trim();
      const rawFloors = floorsInput ? floorsInput.value.trim() : '1';
      const rawGrey = greyRateInput.value.trim();
      const rawFinish = finishRateInput.value.trim();
      const rawOther = otherCostsInput ? otherCostsInput.value.trim() : '';
      const rawBuffer = bufferInput ? bufferInput.value.trim() : '0';

      // Check empty required fields
      if (rawArea === '' && rawGrey === '' && rawFinish === '') {
        resetOutputs('Enter your covered area, number of floors, and contractor rates to see the estimated cost.');
        return;
      }

      const areaVal = parseSafeNumber(rawArea);
      const floorsVal = rawFloors === '' ? 1 : parseSafeNumber(rawFloors);
      const greyRateVal = rawGrey === '' ? null : parseSafeNumber(rawGrey);
      const finishRateVal = rawFinish === '' ? null : parseSafeNumber(rawFinish);
      const otherCostsVal = rawOther === '' ? 0 : parseSafeNumber(rawOther);
      const bufferPctVal = rawBuffer === '' ? 0 : parseSafeNumber(rawBuffer);

      // Validation
      if (areaVal === null || areaVal <= 0) {
        resetOutputs('Please enter a covered area greater than zero.');
        return;
      }

      if (floorsVal === null || floorsVal <= 0) {
        resetOutputs('Number of floors must be greater than zero.');
        return;
      }

      if (greyRateVal === null || finishRateVal === null) {
        resetOutputs('Please enter both grey structure and finishing rates from local contractors.');
        return;
      }

      if (greyRateVal < 0 || finishRateVal < 0 || otherCostsVal < 0 || bufferPctVal < 0) {
        resetOutputs('Rates, costs, and buffer percentages cannot be negative.');
        return;
      }

      // Exact mathematical calculation
      const singleFloorSqFt = convertAreaToSqFt(areaVal, unitSelect.value, settings.marlaSize);
      const totalCoveredSqFt = singleFloorSqFt * floorsVal;

      const greyCost = totalCoveredSqFt * greyRateVal;
      const finishCost = totalCoveredSqFt * finishRateVal;
      const subtotal = greyCost + finishCost + otherCostsVal;
      const bufferCost = subtotal * (bufferPctVal / 100);
      const grandTotal = subtotal + bufferCost;
      const costPerSqFt = totalCoveredSqFt > 0 ? (grandTotal / totalCoveredSqFt) : 0;

      // Display results rounded safely
      totalAreaEl.textContent = `${formatPropertyValue(totalCoveredSqFt, 1, true, false)} sq ft`;
      greyCostEl.textContent = formatPropertyValue(greyCost, 0, false, true);
      finishCostEl.textContent = formatPropertyValue(finishCost, 0, false, true);
      otherCostEl.textContent = formatPropertyValue(otherCostsVal, 0, false, true);
      bufferCostEl.textContent = formatPropertyValue(bufferCost, 0, false, true);
      grandTotalEl.textContent = formatPropertyValue(grandTotal, 0, false, true);
      costPerSqFtEl.textContent = formatPropertyValue(costPerSqFt, 2, false, true);

      if (messageEl) messageEl.textContent = '';
      if (formulaEl) {
        formulaEl.textContent = 'Formula: Grand Total = (Total Covered Area × Grey Rate) + (Total Covered Area × Finishing Rate) + Other Costs + Buffer Amount.';
      }
    }

    function resetOutputs(msg) {
      if (totalAreaEl) totalAreaEl.textContent = '0 sq ft';
      if (greyCostEl) greyCostEl.textContent = '—';
      if (finishCostEl) finishCostEl.textContent = '—';
      if (otherCostEl) otherCostEl.textContent = '—';
      if (bufferCostEl) bufferCostEl.textContent = '—';
      if (grandTotalEl) grandTotalEl.textContent = '—';
      if (costPerSqFtEl) costPerSqFtEl.textContent = '—';
      if (messageEl) messageEl.textContent = msg;
    }

    // Input listeners for instant updates
    [areaInput, floorsInput, greyRateInput, finishRateInput, otherCostsInput].forEach(input => {
      if (input) {
        input.addEventListener('input', calculateConstruction);
        input.addEventListener('change', calculateConstruction);
      }
    });

    if (unitSelect) {
      unitSelect.addEventListener('change', calculateConstruction);
    }

    // Copy Result Button
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = `House Construction Cost Estimate:
Grand Total: ${grandTotalEl.textContent}
Total Covered Area: ${totalAreaEl.textContent}
Grey Structure Cost: ${greyCostEl.textContent}
Finishing Cost: ${finishCostEl.textContent}
Other Costs: ${otherCostEl.textContent}
Buffer Amount: ${bufferCostEl.textContent}
Cost per Sq Ft: ${costPerSqFtEl.textContent}`;
        copyResultToClipboard(text, copyBtn);
      });
    }

    // Clear Button
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        areaInput.value = '';
        if (floorsInput) floorsInput.value = '1';
        greyRateInput.value = '';
        finishRateInput.value = '';
        if (otherCostsInput) otherCostsInput.value = '';
        if (bufferInput) bufferInput.value = '0';
        bufferPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-buffer') === '0'));
        calculateConstruction();
        showToast('Fields cleared.');
      });
    }

    // Bind settings bar & trigger initial calculation
    bindPropertySettingsBar(calculateConstruction);
    calculateConstruction();
  }

  /* --------------------------------------------------------------------------
     B. INSTALLMENT CALCULATOR
     -------------------------------------------------------------------------- */
  function initInstallmentCalculator() {
    const priceInput = document.getElementById('instPrice');
    const downToggleBtns = document.querySelectorAll('.down-toggle-btn');
    const downInput = document.getElementById('instDownPayment');
    const downUnitLabel = document.getElementById('downPaymentUnitLabel');
    const installmentsInput = document.getElementById('instInstallments');
    const freqSelect = document.getElementById('instFrequency');
    const interestInput = document.getElementById('instInterest');

    const perPeriodEl = document.getElementById('instPerPeriodResult');
    const downResultEl = document.getElementById('instDownResult');
    const balanceResultEl = document.getElementById('instBalanceResult');
    const totalPayableEl = document.getElementById('instTotalPayable');
    const totalInterestEl = document.getElementById('instTotalInterest');
    const formulaEl = document.getElementById('instFormulaText');
    const messageEl = document.getElementById('instMessage');

    const scheduleTableBody = document.getElementById('scheduleTableBody');
    const scheduleToggleBtn = document.getElementById('scheduleToggleBtn');
    const copyScheduleBtn = document.getElementById('copyScheduleBtn');
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');
    const printScheduleBtn = document.getElementById('printScheduleBtn');

    const copyBtn = document.getElementById('copyInstBtn');
    const clearBtn = document.getElementById('clearInstBtn');

    if (!priceInput || !perPeriodEl) return;

    let downPaymentMode = 'amount'; // 'amount' or 'percent'
    let currentSchedule = [];
    let isScheduleExpanded = false;

    // Toggle down payment mode (Amount vs Percent)
    downToggleBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        downPaymentMode = this.getAttribute('data-mode') || 'amount';
        downToggleBtns.forEach(b => {
          const isActive = b === btn;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        if (downUnitLabel) {
          downUnitLabel.textContent = downPaymentMode === 'percent' ? '%' : (getPropertySettings().currency !== 'none' ? getPropertySettings().currency : '');
        }
        calculateInstallments();
      });
    });

    function calculateInstallments() {
      const settings = getPropertySettings();
      if (downUnitLabel && downPaymentMode === 'amount') {
        downUnitLabel.textContent = settings.currency !== 'none' ? settings.currency : '';
      }

      const rawPrice = priceInput.value.trim();
      const rawDown = downInput.value.trim();
      const rawN = installmentsInput.value.trim();
      const rawRate = interestInput ? interestInput.value.trim() : '0';

      if (rawPrice === '' && rawN === '') {
        resetOutputs('Enter total price and number of installments to see your payment plan.');
        return;
      }

      const priceVal = parseSafeNumber(rawPrice);
      const nVal = parseSafeNumber(rawN);
      const downVal = rawDown === '' ? 0 : parseSafeNumber(rawDown);
      const rateVal = rawRate === '' ? 0 : parseSafeNumber(rawRate);

      // Validation
      if (priceVal === null || priceVal <= 0) {
        resetOutputs('Please enter a total price greater than zero.');
        return;
      }

      if (nVal === null || nVal < 1 || !Number.isInteger(nVal)) {
        resetOutputs('Number of installments must be a whole number of at least 1.');
        return;
      }

      if (nVal > CALC_CONFIG.property.amortizationMaxRows) {
        resetOutputs(`Maximum supported number of installments is ${CALC_CONFIG.property.amortizationMaxRows}.`);
        return;
      }

      if (downVal < 0 || rateVal < 0) {
        resetOutputs('Down payment and interest rate cannot be negative numbers.');
        return;
      }

      // Down payment amount calculation
      let actualDown = 0;
      if (downPaymentMode === 'percent') {
        if (downVal > 100) {
          resetOutputs('Down payment percentage cannot be greater than 100%.');
          return;
        }
        actualDown = (priceVal * downVal) / 100;
      } else {
        actualDown = downVal;
      }

      if (actualDown > priceVal) {
        resetOutputs('Down payment cannot be greater than the total price.');
        return;
      }

      // Financed Principal
      const principal = priceVal - actualDown;

      // Frequency calculation
      const freq = freqSelect ? freqSelect.value : 'monthly';
      let monthsPerPeriod = 1;
      let periodName = 'Month';
      if (freq === 'quarterly') {
        monthsPerPeriod = 3;
        periodName = 'Quarter';
      } else if (freq === 'half-yearly') {
        monthsPerPeriod = 6;
        periodName = 'Half-Year';
      } else if (freq === 'yearly') {
        monthsPerPeriod = 12;
        periodName = 'Year';
      }

      // Per-period interest rate: r = annual rate * (months per period / 12) / 100
      const r = rateVal > 0 ? (rateVal * (monthsPerPeriod / 12)) / 100 : 0;

      let pmt = 0;
      if (principal === 0) {
        pmt = 0;
      } else if (r === 0) {
        pmt = principal / nVal;
      } else {
        pmt = (principal * r) / (1 - Math.pow(1 + r, -nVal));
      }

      // Generate Amortization Schedule without floating-point drift
      // The rounding difference is placed in the last installment so the final balance is exactly 0.
      const roundedPmt = Math.round(pmt * 100) / 100;
      let balance = principal;
      const rows = [];
      let totalInterestSum = 0;
      let totalInstallmentsSum = 0;

      for (let i = 1; i <= nVal; i++) {
        const interestPart = r > 0 ? Math.round(balance * r * 100) / 100 : 0;
        let principalPart = 0;
        let installmentAmount = 0;

        if (i === nVal) {
          // Final installment absorbs any rounding drift
          principalPart = balance;
          installmentAmount = Math.round((principalPart + interestPart) * 100) / 100;
          balance = 0;
        } else {
          principalPart = Math.round((roundedPmt - interestPart) * 100) / 100;
          balance = Math.max(0, Math.round((balance - principalPart) * 100) / 100);
          installmentAmount = roundedPmt;
        }

        totalInterestSum += interestPart;
        totalInstallmentsSum += installmentAmount;

        rows.push({
          number: i,
          period: `${periodName} ${i}`,
          installment: installmentAmount,
          interest: interestPart,
          principal: principalPart,
          balance: balance
        });
      }

      currentSchedule = rows;

      const totalPayable = actualDown + totalInstallmentsSum;
      const totalInterest = Math.max(0, totalPayable - priceVal);

      // Display summary results
      perPeriodEl.textContent = formatPropertyValue(roundedPmt, 2, false, true);
      downResultEl.textContent = formatPropertyValue(actualDown, 2, false, true);
      balanceResultEl.textContent = formatPropertyValue(principal, 2, false, true);
      totalPayableEl.textContent = formatPropertyValue(totalPayable, 2, false, true);
      totalInterestEl.textContent = formatPropertyValue(totalInterest, 2, false, true);

      if (messageEl) messageEl.textContent = '';

      if (formulaEl) {
        if (rateVal === 0) {
          formulaEl.textContent = 'Formula: Installment = (Price − Down Payment) ÷ Number of Installments.';
        } else {
          formulaEl.textContent = 'Formula: Installment = P × r ÷ (1 − (1 + r)⁻ⁿ). This is a standard loan amortization formula; real schemes may calculate differently.';
        }
      }

      renderScheduleTable();
    }

    function renderScheduleTable() {
      if (!scheduleTableBody) return;
      scheduleTableBody.innerHTML = '';

      if (currentSchedule.length === 0) {
        if (scheduleToggleBtn) scheduleToggleBtn.style.display = 'none';
        return;
      }

      const initialLimit = CALC_CONFIG.property.initialScheduleRows;
      const rowsToShow = isScheduleExpanded ? currentSchedule : currentSchedule.slice(0, initialLimit);

      const htmlParts = [];
      rowsToShow.forEach(row => {
        htmlParts.push(`
          <tr>
            <td>${row.number}</td>
            <td>${row.period}</td>
            <td>${formatPropertyValue(row.installment, 2, false, true)}</td>
            <td>${formatPropertyValue(row.interest, 2, false, true)}</td>
            <td>${formatPropertyValue(row.principal, 2, false, true)}</td>
            <td>${formatPropertyValue(row.balance, 2, false, true)}</td>
          </tr>
        `);
      });

      scheduleTableBody.innerHTML = htmlParts.join('');

      if (scheduleToggleBtn) {
        if (currentSchedule.length > initialLimit) {
          scheduleToggleBtn.style.display = 'inline-block';
          scheduleToggleBtn.textContent = isScheduleExpanded
            ? 'Show First 12 Installments'
            : `Show All (${currentSchedule.length} Installments)`;
        } else {
          scheduleToggleBtn.style.display = 'none';
        }
      }
    }

    function resetOutputs(msg) {
      if (perPeriodEl) perPeriodEl.textContent = '—';
      if (downResultEl) downResultEl.textContent = '—';
      if (balanceResultEl) balanceResultEl.textContent = '—';
      if (totalPayableEl) totalPayableEl.textContent = '—';
      if (totalInterestEl) totalInterestEl.textContent = '—';
      if (scheduleTableBody) scheduleTableBody.innerHTML = '';
      if (scheduleToggleBtn) scheduleToggleBtn.style.display = 'none';
      if (messageEl) messageEl.textContent = msg;
      currentSchedule = [];
    }

    // Toggle full schedule button
    if (scheduleToggleBtn) {
      scheduleToggleBtn.addEventListener('click', () => {
        isScheduleExpanded = !isScheduleExpanded;
        renderScheduleTable();
      });
    }

    // Copy Schedule Table Button
    if (copyScheduleBtn) {
      copyScheduleBtn.addEventListener('click', () => {
        if (currentSchedule.length === 0) {
          showToast('No schedule to copy.');
          return;
        }
        let tsv = 'No.\tPeriod\tInstallment\tInterest\tPrincipal\tRemaining Balance\n';
        currentSchedule.forEach(r => {
          tsv += `${r.number}\t${r.period}\t${r.installment}\t${r.interest}\t${r.principal}\t${r.balance}\n`;
        });
        copyResultToClipboard(tsv, copyScheduleBtn);
      });
    }

    // Download CSV Button
    if (downloadCsvBtn) {
      downloadCsvBtn.addEventListener('click', () => {
        if (currentSchedule.length === 0) {
          showToast('No schedule to download.');
          return;
        }
        let csv = 'Number,Period,Installment,Interest,Principal,Remaining Balance\r\n';
        currentSchedule.forEach(r => {
          csv += `"${r.number}","${r.period}","${r.installment.toFixed(2)}","${r.interest.toFixed(2)}","${r.principal.toFixed(2)}","${r.balance.toFixed(2)}"\r\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        if (typeof window.downloadBlob === 'function') {
          window.downloadBlob(blob, 'installment-payment-schedule.csv', 'text/csv');
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'installment-payment-schedule.csv';
          a.click();
          URL.revokeObjectURL(url);
        }
        showToast('CSV downloaded.');
      });
    }

    // Print Schedule Button
    if (printScheduleBtn) {
      printScheduleBtn.addEventListener('click', () => {
        if (currentSchedule.length === 0) {
          showToast('No schedule to print.');
          return;
        }
        // Expand schedule so all rows appear in print dialog
        const prev = isScheduleExpanded;
        isScheduleExpanded = true;
        renderScheduleTable();
        window.print();
        setTimeout(() => {
          isScheduleExpanded = prev;
          renderScheduleTable();
        }, 1000);
      });
    }

    // Copy Summary Button
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = `Installment Calculation Summary:
Installment Amount: ${perPeriodEl.textContent}
Down Payment: ${downResultEl.textContent}
Financed Balance: ${balanceResultEl.textContent}
Total Payable: ${totalPayableEl.textContent}
Total Interest: ${totalInterestEl.textContent}`;
        copyResultToClipboard(text, copyBtn);
      });
    }

    // Clear Button
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        priceInput.value = '';
        downInput.value = '';
        installmentsInput.value = '';
        if (interestInput) interestInput.value = '0';
        if (freqSelect) freqSelect.value = 'monthly';
        downPaymentMode = 'amount';
        downToggleBtns.forEach(b => {
          const isActive = b.getAttribute('data-mode') === 'amount';
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        isScheduleExpanded = false;
        calculateInstallments();
        showToast('Fields cleared.');
      });
    }

    // Input listeners for instant updates
    [priceInput, downInput, installmentsInput, interestInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('input', calculateInstallments);
        inp.addEventListener('change', calculateInstallments);
      }
    });

    if (freqSelect) {
      freqSelect.addEventListener('change', calculateInstallments);
    }

    // Bind settings bar & trigger initial calculation
    bindPropertySettingsBar(calculateInstallments);
    calculateInstallments();
  }

  /* --------------------------------------------------------------------------
     C. PLOT PRICE CALCULATOR
     -------------------------------------------------------------------------- */
  function initPlotPriceCalculator() {
    const areaInput = document.getElementById('plotArea');
    const unitSelect = document.getElementById('plotUnit');
    const rateInput = document.getElementById('plotRate');
    const rateBasisSelect = document.getElementById('plotBasis');
    const extrasInput = document.getElementById('plotExtras');
    const discountInput = document.getElementById('plotDiscount');

    const totalEl = document.getElementById('plotPrimaryResult');
    const basePriceEl = document.getElementById('plotBasePrice');
    const extrasEl = document.getElementById('plotExtrasAmount');
    const discountEl = document.getElementById('plotDiscountAmount');

    const unitMarlaEl = document.getElementById('unitMarlaVal');
    const unitKanalEl = document.getElementById('unitKanalVal');
    const unitSqFtEl = document.getElementById('unitSqFtVal');
    const unitSqYdEl = document.getElementById('unitSqYdVal');
    const unitSqMEl = document.getElementById('unitSqMVal');

    const formulaEl = document.getElementById('plotFormulaText');
    const messageEl = document.getElementById('plotMessage');

    const copyBtn = document.getElementById('copyPlotBtn');
    const clearBtn = document.getElementById('clearPlotBtn');

    if (!areaInput || !totalEl) return;

    function calculatePlotPrice() {
      const settings = getPropertySettings();
      const rawArea = areaInput.value.trim();
      const rawRate = rateInput.value.trim();
      const rawExtras = extrasInput ? extrasInput.value.trim() : '';
      const rawDiscount = discountInput ? discountInput.value.trim() : '';

      if (rawArea === '' && rawRate === '') {
        resetOutputs('Enter plot area and price rate to calculate total plot value.');
        return;
      }

      const areaVal = parseSafeNumber(rawArea);
      const rateVal = parseSafeNumber(rawRate);
      const extrasVal = rawExtras === '' ? 0 : parseSafeNumber(rawExtras);
      const discountVal = rawDiscount === '' ? 0 : parseSafeNumber(rawDiscount);

      // Validation
      if (areaVal === null || areaVal <= 0) {
        resetOutputs('Please enter a plot area greater than zero.');
        return;
      }

      if (rateVal === null || rateVal <= 0) {
        resetOutputs('Please enter a price rate greater than zero.');
        return;
      }

      if (extrasVal < 0 || discountVal < 0) {
        resetOutputs('Charges and discount percentages cannot be negative.');
        return;
      }

      if (discountVal > 100) {
        resetOutputs('Discount percentage cannot be greater than 100%.');
        return;
      }

      // Convert Area to Square Feet as standard base
      const areaSqFt = convertAreaToSqFt(areaVal, unitSelect.value, settings.marlaSize);

      // Convert Rate Basis to Rate Per Square Foot
      const basis = rateBasisSelect ? rateBasisSelect.value : 'marla';
      let ratePerSqFt = 0;
      switch (basis) {
        case 'marla':
        case 'per marla':
          ratePerSqFt = rateVal / settings.marlaSize;
          break;
        case 'kanal':
        case 'per kanal':
          ratePerSqFt = rateVal / (settings.marlaSize * CALC_CONFIG.property.marlasPerKanal);
          break;
        case 'sqft':
        case 'per square foot':
        case 'square foot':
          ratePerSqFt = rateVal;
          break;
        case 'sqyd':
        case 'per square yard':
        case 'square yard':
          ratePerSqFt = rateVal / CALC_CONFIG.property.sqFtPerSqYard;
          break;
        default:
          ratePerSqFt = rateVal / settings.marlaSize;
          break;
      }

      // Calculations
      const basePrice = areaSqFt * ratePerSqFt;
      const discountAmount = (basePrice * discountVal) / 100;
      const totalPrice = basePrice + extrasVal - discountAmount;

      // Common units breakdown
      const units = convertSqFtToAllUnits(areaSqFt, settings.marlaSize);

      // Display Results
      totalEl.textContent = formatPropertyValue(totalPrice, 2, false, true);
      basePriceEl.textContent = formatPropertyValue(basePrice, 2, false, true);
      extrasEl.textContent = formatPropertyValue(extrasVal, 2, false, true);
      discountEl.textContent = formatPropertyValue(discountAmount, 2, false, true);

      if (unitMarlaEl) unitMarlaEl.textContent = formatPropertyValue(units.marla, 2, true, false);
      if (unitKanalEl) unitKanalEl.textContent = formatPropertyValue(units.kanal, 3, true, false);
      if (unitSqFtEl) unitSqFtEl.textContent = formatPropertyValue(units.sqft, 1, true, false);
      if (unitSqYdEl) unitSqYdEl.textContent = formatPropertyValue(units.sqyd, 2, true, false);
      if (unitSqMEl) unitSqMEl.textContent = formatPropertyValue(units.sqm, 2, true, false);

      if (messageEl) messageEl.textContent = '';
      if (formulaEl) {
        formulaEl.textContent = 'Formula: Total Price = Base Price (Area × Rate) + Development Charges − Discount Amount.';
      }
    }

    function resetOutputs(msg) {
      if (totalEl) totalEl.textContent = '—';
      if (basePriceEl) basePriceEl.textContent = '—';
      if (extrasEl) extrasEl.textContent = '—';
      if (discountEl) discountEl.textContent = '—';
      if (unitMarlaEl) unitMarlaEl.textContent = '0';
      if (unitKanalEl) unitKanalEl.textContent = '0';
      if (unitSqFtEl) unitSqFtEl.textContent = '0';
      if (unitSqYdEl) unitSqYdEl.textContent = '0';
      if (unitSqMEl) unitSqMEl.textContent = '0';
      if (messageEl) messageEl.textContent = msg;
    }

    // Input listeners for instant calculation
    [areaInput, rateInput, extrasInput, discountInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('input', calculatePlotPrice);
        inp.addEventListener('change', calculatePlotPrice);
      }
    });

    if (unitSelect) unitSelect.addEventListener('change', calculatePlotPrice);
    if (rateBasisSelect) rateBasisSelect.addEventListener('change', calculatePlotPrice);

    // Copy Result Button
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = `Plot Price Calculation:
Total Price: ${totalEl.textContent}
Base Price: ${basePriceEl.textContent}
Development Charges: ${extrasEl.textContent}
Discount: ${discountEl.textContent}
Plot Area:
- Marla: ${unitMarlaEl ? unitMarlaEl.textContent : ''}
- Kanal: ${unitKanalEl ? unitKanalEl.textContent : ''}
- Sq Ft: ${unitSqFtEl ? unitSqFtEl.textContent : ''}
- Sq Yards: ${unitSqYdEl ? unitSqYdEl.textContent : ''}
- Sq Meters: ${unitSqMEl ? unitSqMEl.textContent : ''}`;
        copyResultToClipboard(text, copyBtn);
      });
    }

    // Clear Button
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        areaInput.value = '';
        rateInput.value = '';
        if (extrasInput) extrasInput.value = '';
        if (discountInput) discountInput.value = '';
        calculatePlotPrice();
        showToast('Fields cleared.');
      });
    }

    // Bind settings bar & trigger initial calculation
    bindPropertySettingsBar(calculatePlotPrice);
    calculatePlotPrice();
  }

  /* ==========================================================================
     10. LOAN CALCULATOR ENGINE
     ========================================================================== */
  function initLoanCalculator() {
    const amountInput = document.getElementById('loanAmount');
    const rateInput = document.getElementById('loanRate');
    const termInput = document.getElementById('loanTerm');
    const termUnitBtns = document.querySelectorAll('.loan-term-unit-btn');
    const startDateInput = document.getElementById('loanStartDate');
    const extraPaymentInput = document.getElementById('loanExtraPayment');

    const monthlyPaymentEl = document.getElementById('loanMonthlyPayment');
    const totalPayableEl = document.getElementById('loanTotalPayable');
    const totalInterestEl = document.getElementById('loanTotalInterest');
    const payoffDateEl = document.getElementById('loanPayoffDate');

    const extraSectionEl = document.getElementById('loanExtraSection');
    const monthsSavedEl = document.getElementById('loanMonthsSaved');
    const interestSavedEl = document.getElementById('loanInterestSaved');
    const extraSummaryEl = document.getElementById('loanExtraSummary');

    const barPrincipalEl = document.getElementById('loanBarPrincipal');
    const barInterestEl = document.getElementById('loanBarInterest');
    const prinPercentEl = document.getElementById('loanPrinPercent');
    const intPercentEl = document.getElementById('loanIntPercent');

    const formulaEl = document.getElementById('loanFormulaText');
    const messageEl = document.getElementById('loanMessage');

    const scheduleTableBody = document.getElementById('loanScheduleTableBody');
    const scheduleToggleBtn = document.getElementById('loanScheduleToggleBtn');
    const copyScheduleBtn = document.getElementById('loanCopyScheduleBtn');
    const downloadCsvBtn = document.getElementById('loanDownloadCsvBtn');
    const printScheduleBtn = document.getElementById('loanPrintScheduleBtn');

    const copyBtn = document.getElementById('copyLoanBtn');
    const clearBtn = document.getElementById('clearLoanBtn');

    if (!amountInput || !monthlyPaymentEl) return;

    let termUnit = 'years'; // 'years' or 'months'
    let currentSchedule = [];
    let isScheduleExpanded = false;

    // Term unit buttons toggle (Years vs Months)
    termUnitBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        termUnit = this.getAttribute('data-unit') || 'years';
        termUnitBtns.forEach(b => {
          const isActive = b === btn;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        calculateLoan();
      });
    });

    function calculateLoan() {
      const rawAmount = amountInput.value.trim();
      const rawRate = rateInput.value.trim();
      const rawTerm = termInput.value.trim();
      const rawExtra = extraPaymentInput ? extraPaymentInput.value.trim() : '';

      if (rawAmount === '' && rawTerm === '') {
        resetOutputs('Enter your loan amount, interest rate, and term to see your monthly payment and repayment plan.');
        return;
      }

      const P = parseSafeNumber(rawAmount);
      const rateVal = parseSafeNumber(rawRate);
      const termVal = parseSafeNumber(rawTerm);
      const extraVal = rawExtra === '' ? 0 : parseSafeNumber(rawExtra);

      // Validation
      if (P === null || P <= 0) {
        resetOutputs('Please enter a loan amount greater than zero.');
        return;
      }

      if (rateVal === null || rateVal < CALC_CONFIG.loan.minRate || rateVal > CALC_CONFIG.loan.maxRate) {
        resetOutputs(`Annual interest rate must be between ${CALC_CONFIG.loan.minRate}% and ${CALC_CONFIG.loan.maxRate}%.`);
        return;
      }

      if (termVal === null || termVal <= 0) {
        resetOutputs('Please enter a loan term greater than zero.');
        return;
      }

      if (extraVal === null || extraVal < 0) {
        resetOutputs('Extra monthly payment cannot be negative.');
        return;
      }

      // Calculate total months
      const rawMonths = termUnit === 'years' ? termVal * 12 : termVal;
      // Must result in a whole number of months
      if (Math.abs(rawMonths - Math.round(rawMonths)) > 1e-6) {
        resetOutputs('Loan term must result in a whole number of months.');
        return;
      }

      const n = Math.round(rawMonths);
      if (n < 1 || n > CALC_CONFIG.loan.maxMonths) {
        resetOutputs(`Loan term must be between 1 and ${CALC_CONFIG.loan.maxMonths} months (up to 50 years).`);
        return;
      }

      // Formula calculations
      // r = annual rate / 12 / 100
      const r = rateVal > 0 ? (rateVal / 12) / 100 : 0;

      let baseMonthlyPayment = 0;
      let baseTotalPayable = 0;
      let baseTotalInterest = 0;

      if (r === 0) {
        baseMonthlyPayment = P / n;
        baseTotalPayable = P;
        baseTotalInterest = 0;
      } else {
        const factor = Math.pow(1 + r, n);
        const exactPmt = (P * r * factor) / (factor - 1);
        baseMonthlyPayment = Math.round(exactPmt * 100) / 100;
        baseTotalPayable = Math.round(exactPmt * n * 100) / 100;
        baseTotalInterest = Math.max(0, Math.round((baseTotalPayable - P) * 100) / 100);
      }

      // Simulate amortization schedule with extra monthly payment
      // The last payment absorbs rounding so the final balance is exactly 0.
      const targetPayment = baseMonthlyPayment + extraVal;
      let balance = P;
      const rows = [];
      let totalInterestSum = 0;
      let totalInstallmentsSum = 0;
      let monthIndex = 0;

      while (balance > 0 && monthIndex < CALC_CONFIG.loan.maxMonths) {
        monthIndex++;
        const interestPart = r > 0 ? Math.round(balance * r * 100) / 100 : 0;
        let principalPart = 0;
        let pmtAmount = 0;

        if (balance + interestPart <= targetPayment || (extraVal === 0 && monthIndex === n)) {
          // Final payment absorbs any rounding
          principalPart = balance;
          pmtAmount = Math.round((principalPart + interestPart) * 100) / 100;
          balance = 0;
        } else {
          principalPart = Math.round((targetPayment - interestPart) * 100) / 100;
          if (principalPart >= balance) {
            principalPart = balance;
            pmtAmount = Math.round((principalPart + interestPart) * 100) / 100;
            balance = 0;
          } else {
            pmtAmount = targetPayment;
            balance = Math.max(0, Math.round((balance - principalPart) * 100) / 100);
          }
        }

        totalInterestSum += interestPart;
        totalInstallmentsSum += pmtAmount;

        rows.push({
          month: monthIndex,
          payment: pmtAmount,
          principal: principalPart,
          interest: interestPart,
          balance: balance
        });

        if (balance === 0) break;
      }

      currentSchedule = rows;

      const actualMonths = monthIndex;
      let actualTotalPayable = Math.round(totalInstallmentsSum * 100) / 100;
      let actualTotalInterest = Math.round(totalInterestSum * 100) / 100;

      if (extraVal === 0) {
        // Match exact formula rounding for standard term
        actualTotalPayable = baseTotalPayable;
        actualTotalInterest = baseTotalInterest;
      }

      // Display main results
      monthlyPaymentEl.textContent = formatPropertyValue(baseMonthlyPayment, 2, false, true);
      totalPayableEl.textContent = formatPropertyValue(actualTotalPayable, 2, false, true);
      totalInterestEl.textContent = formatPropertyValue(actualTotalInterest, 2, false, true);

      // Payoff Date calculation (if start date is provided)
      if (payoffDateEl) {
        if (startDateInput && startDateInput.value) {
          const parts = startDateInput.value.split('-');
          if (parts.length >= 2) {
            const startYear = parseInt(parts[0], 10);
            const startMonth = parseInt(parts[1], 10) - 1; // 0-indexed
            const payoff = new Date(startYear, startMonth + actualMonths, 1);
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            payoffDateEl.textContent = `${monthNames[payoff.getMonth()]} ${payoff.getFullYear()}`;
          } else {
            payoffDateEl.textContent = '—';
          }
        } else {
          payoffDateEl.textContent = '—';
        }
      }

      // Extra payment savings
      if (extraSectionEl) {
        if (extraVal > 0) {
          extraSectionEl.style.display = 'block';
          const monthsSaved = Math.max(0, n - actualMonths);
          const interestSaved = Math.max(0, Math.round((baseTotalInterest - actualTotalInterest) * 100) / 100);
          if (monthsSavedEl) monthsSavedEl.textContent = `${monthsSaved} ${monthsSaved === 1 ? 'month' : 'months'}`;
          if (interestSavedEl) interestSavedEl.textContent = formatPropertyValue(interestSaved, 2, false, true);
          if (extraSummaryEl) {
            extraSummaryEl.textContent = `With an extra payment of ${formatPropertyValue(extraVal, 2, true, true)}/month, you pay off ${monthsSaved} months early and save ${formatPropertyValue(interestSaved, 2, false, true)} in total interest.`;
          }
        } else {
          extraSectionEl.style.display = 'none';
          if (monthsSavedEl) monthsSavedEl.textContent = '0 months';
          if (interestSavedEl) interestSavedEl.textContent = formatPropertyValue(0, 2, false, true);
        }
      }

      // Simple CSS bar showing Principal vs Interest
      const prinPct = actualTotalPayable > 0 ? (P / actualTotalPayable) * 100 : 100;
      const intPct = actualTotalPayable > 0 ? (actualTotalInterest / actualTotalPayable) * 100 : 0;
      const roundedPrinPct = Math.round(prinPct * 10) / 10;
      const roundedIntPct = Math.round(intPct * 10) / 10;

      if (barPrincipalEl) barPrincipalEl.style.width = `${prinPct}%`;
      if (barInterestEl) barInterestEl.style.width = `${intPct}%`;
      if (prinPercentEl) prinPercentEl.textContent = `${roundedPrinPct}%`;
      if (intPercentEl) intPercentEl.textContent = `${roundedIntPct}%`;

      if (messageEl) messageEl.textContent = '';

      if (formulaEl) {
        if (rateVal === 0) {
          formulaEl.textContent = 'Formula: Payment = P ÷ n. Real banks may calculate differently.';
        } else {
          formulaEl.textContent = 'Formula: r = annual rate / 12 / 100; payment = P × r × (1+r)ⁿ / ((1+r)ⁿ − 1). Real banks may calculate differently.';
        }
      }

      renderScheduleTable();
    }

    function renderScheduleTable() {
      if (!scheduleTableBody) return;
      scheduleTableBody.innerHTML = '';

      if (currentSchedule.length === 0) {
        if (scheduleToggleBtn) scheduleToggleBtn.style.display = 'none';
        return;
      }

      const initialLimit = CALC_CONFIG.loan.initialScheduleRows;
      const rowsToShow = isScheduleExpanded ? currentSchedule : currentSchedule.slice(0, initialLimit);

      const htmlParts = [];
      const len = rowsToShow.length;
      for (let i = 0; i < len; i++) {
        const row = rowsToShow[i];
        htmlParts.push(`
          <tr>
            <td>${row.month}</td>
            <td>${formatPropertyValue(row.payment, 2, false, true)}</td>
            <td>${formatPropertyValue(row.principal, 2, false, true)}</td>
            <td>${formatPropertyValue(row.interest, 2, false, true)}</td>
            <td>${formatPropertyValue(row.balance, 2, false, true)}</td>
          </tr>
        `);
      }

      scheduleTableBody.innerHTML = htmlParts.join('');

      if (scheduleToggleBtn) {
        if (currentSchedule.length > initialLimit) {
          scheduleToggleBtn.style.display = 'inline-block';
          scheduleToggleBtn.textContent = isScheduleExpanded
            ? 'Show First 12 Months'
            : `Show All (${currentSchedule.length} Months)`;
        } else {
          scheduleToggleBtn.style.display = 'none';
        }
      }
    }

    function resetOutputs(msg) {
      if (monthlyPaymentEl) monthlyPaymentEl.textContent = '—';
      if (totalPayableEl) totalPayableEl.textContent = '—';
      if (totalInterestEl) totalInterestEl.textContent = '—';
      if (payoffDateEl) payoffDateEl.textContent = '—';
      if (extraSectionEl) extraSectionEl.style.display = 'none';
      if (barPrincipalEl) barPrincipalEl.style.width = '100%';
      if (barInterestEl) barInterestEl.style.width = '0%';
      if (prinPercentEl) prinPercentEl.textContent = '100%';
      if (intPercentEl) intPercentEl.textContent = '0%';
      if (scheduleTableBody) scheduleTableBody.innerHTML = '';
      if (scheduleToggleBtn) scheduleToggleBtn.style.display = 'none';
      if (messageEl) messageEl.textContent = msg;
      currentSchedule = [];
    }

    // Toggle Schedule
    if (scheduleToggleBtn) {
      scheduleToggleBtn.addEventListener('click', () => {
        isScheduleExpanded = !isScheduleExpanded;
        renderScheduleTable();
      });
    }

    // Copy Schedule Table
    if (copyScheduleBtn) {
      copyScheduleBtn.addEventListener('click', () => {
        if (currentSchedule.length === 0) {
          showToast('No schedule to copy.');
          return;
        }
        let tsv = 'Month\tPayment\tPrincipal\tInterest\tBalance\n';
        currentSchedule.forEach(r => {
          tsv += `${r.month}\t${r.payment}\t${r.principal}\t${r.interest}\t${r.balance}\n`;
        });
        copyResultToClipboard(tsv, copyScheduleBtn);
      });
    }

    // Download CSV
    if (downloadCsvBtn) {
      downloadCsvBtn.addEventListener('click', () => {
        if (currentSchedule.length === 0) {
          showToast('No schedule to download.');
          return;
        }
        let csv = 'Month,Payment,Principal,Interest,Balance\r\n';
        currentSchedule.forEach(r => {
          csv += `${r.month},${r.payment},${r.principal},${r.interest},${r.balance}\r\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'loan-amortization-schedule.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Amortization schedule downloaded.');
      });
    }

    // Print
    if (printScheduleBtn) {
      printScheduleBtn.addEventListener('click', () => {
        if (currentSchedule.length === 0) {
          showToast('Calculate a loan first to print schedule.');
          return;
        }
        // Expand table for complete printout
        if (!isScheduleExpanded) {
          isScheduleExpanded = true;
          renderScheduleTable();
        }
        window.print();
      });
    }

    // Copy Summary Result
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (!monthlyPaymentEl || monthlyPaymentEl.textContent === '—') {
          showToast('Please calculate a loan payment first.');
          return;
        }
        let summary = `Loan Payment Summary:
Monthly Payment: ${monthlyPaymentEl.textContent}
Total Payable: ${totalPayableEl ? totalPayableEl.textContent : ''}
Total Interest: ${totalInterestEl ? totalInterestEl.textContent : ''}`;
        if (payoffDateEl && payoffDateEl.textContent !== '—') {
          summary += `\nPayoff Date: ${payoffDateEl.textContent}`;
        }
        if (monthsSavedEl && monthsSavedEl.textContent !== '0 months') {
          summary += `\nMonths Saved: ${monthsSavedEl.textContent}`;
          summary += `\nInterest Saved: ${interestSavedEl ? interestSavedEl.textContent : ''}`;
        }
        copyResultToClipboard(summary, copyBtn);
      });
    }

    // Clear Button
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        amountInput.value = '';
        rateInput.value = '';
        termInput.value = '';
        if (startDateInput) startDateInput.value = '';
        if (extraPaymentInput) extraPaymentInput.value = '';
        calculateLoan();
        showToast('Loan inputs cleared.');
      });
    }

    // Real-time input listeners
    [amountInput, rateInput, termInput, startDateInput, extraPaymentInput].forEach(el => {
      if (el) {
        el.addEventListener('input', calculateLoan);
        el.addEventListener('change', calculateLoan);
      }
    });

    // Display Settings bar sync
    bindPropertySettingsBar(calculateLoan);
    calculateLoan();
  }


  /* ==========================================================================
     11. AVERAGE CALCULATOR ENGINE
     ========================================================================== */
  function initAverageCalculator() {
    const inputEl = document.getElementById('avgInput');
    const countEl = document.getElementById('avgCount');
    const sumEl = document.getElementById('avgSum');
    const meanEl = document.getElementById('avgMean');
    const medianEl = document.getElementById('avgMedian');
    const modeEl = document.getElementById('avgMode');
    const minEl = document.getElementById('avgMin');
    const maxEl = document.getElementById('avgMax');
    const rangeEl = document.getElementById('avgRange');

    const ignoredBoxEl = document.getElementById('avgIgnoredBox');
    const ignoredTextEl = document.getElementById('avgIgnoredText');
    const messageEl = document.getElementById('avgMessage');

    const copyBtn = document.getElementById('copyAvgBtn');
    const clearBtn = document.getElementById('clearAvgBtn');

    if (!inputEl || !countEl) return;

    function calculateAverage() {
      const rawText = inputEl.value;

      if (!rawText.trim()) {
        resetOutputs('Enter numbers separated by spaces, commas, or new lines to calculate statistics.');
        return;
      }

      // Split by commas, spaces, and newlines
      const tokens = rawText.split(/[\s,\n\r]+/).filter(t => t.trim() !== '');

      if (tokens.length === 0) {
        resetOutputs('Enter numbers separated by spaces, commas, or new lines to calculate statistics.');
        return;
      }

      const numbers = [];
      const ignored = [];

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i].trim();
        if (token === '') continue;

        // Number parsing (treat commas as separator only)
        const val = Number(token);
        if (!Number.isNaN(val) && Number.isFinite(val)) {
          if (numbers.length < CALC_CONFIG.average.maxNumbers) {
            numbers.push(val);
          }
        } else {
          ignored.push(token);
        }
      }

      // Ignored elements notice
      if (ignoredBoxEl && ignoredTextEl) {
        if (ignored.length > 0) {
          ignoredBoxEl.classList.add('show');
          const displayIgnored = ignored.length > 20
            ? ignored.slice(0, 20).join(', ') + ` ...and ${ignored.length - 20} more`
            : ignored.join(', ');
          ignoredTextEl.textContent = `Ignored: ${displayIgnored}`;
        } else {
          ignoredBoxEl.classList.remove('show');
          ignoredTextEl.textContent = '';
        }
      }

      if (numbers.length === 0) {
        resetOutputs('No valid numeric entries found. Please enter valid numbers.');
        return;
      }

      const count = numbers.length;
      let sum = 0;
      for (let i = 0; i < count; i++) {
        sum += numbers[i];
      }
      const mean = sum / count;

      // Sorted numbers for median, min, max, range
      const sorted = [...numbers].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[count - 1];
      const range = max - min;

      // Median
      let median = 0;
      if (count % 2 === 1) {
        median = sorted[Math.floor(count / 2)];
      } else {
        median = (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
      }

      // Mode
      const freqMap = new Map();
      for (let i = 0; i < count; i++) {
        const n = numbers[i];
        freqMap.set(n, (freqMap.get(n) || 0) + 1);
      }

      let maxFreq = 0;
      for (const f of freqMap.values()) {
        if (f > maxFreq) maxFreq = f;
      }

      let modeStr = 'No mode';
      if (maxFreq > 1) {
        const modes = [];
        for (const [val, f] of freqMap.entries()) {
          if (f === maxFreq) modes.push(val);
        }
        modes.sort((a, b) => a - b);
        modeStr = modes.map(m => formatDisplayNumber(m, 4, true)).join(', ');
      }

      // Display formatted outputs
      countEl.textContent = formatDisplayNumber(count, 0, true);
      sumEl.textContent = formatDisplayNumber(sum, 4, true);
      meanEl.textContent = formatDisplayNumber(mean, 4, true);
      medianEl.textContent = formatDisplayNumber(median, 4, true);
      modeEl.textContent = modeStr;
      minEl.textContent = formatDisplayNumber(min, 4, true);
      maxEl.textContent = formatDisplayNumber(max, 4, true);
      rangeEl.textContent = formatDisplayNumber(range, 4, true);

      if (messageEl) {
        if (tokens.length > CALC_CONFIG.average.maxNumbers) {
          messageEl.textContent = `Dataset limit reached: processed the first ${CALC_CONFIG.average.maxNumbers} numbers.`;
        } else {
          messageEl.textContent = '';
        }
      }
    }

    function resetOutputs(msg) {
      if (countEl) countEl.textContent = '—';
      if (sumEl) sumEl.textContent = '—';
      if (meanEl) meanEl.textContent = '—';
      if (medianEl) medianEl.textContent = '—';
      if (modeEl) modeEl.textContent = '—';
      if (minEl) minEl.textContent = '—';
      if (maxEl) maxEl.textContent = '—';
      if (rangeEl) rangeEl.textContent = '—';
      if (messageEl) messageEl.textContent = msg;
      if (ignoredBoxEl) ignoredBoxEl.classList.remove('show');
    }

    // Real-time calculation on input
    inputEl.addEventListener('input', calculateAverage);

    // Copy Result Button
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (!countEl || countEl.textContent === '—') {
          showToast('Please enter numbers first.');
          return;
        }
        const text = `Average & Statistical Summary:
Count: ${countEl.textContent}
Sum: ${sumEl.textContent}
Mean (Average): ${meanEl.textContent}
Median: ${medianEl.textContent}
Mode: ${modeEl.textContent}
Minimum: ${minEl.textContent}
Maximum: ${maxEl.textContent}
Range: ${rangeEl.textContent}`;
        copyResultToClipboard(text, copyBtn);
      });
    }

    // Clear Button
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        inputEl.value = '';
        calculateAverage();
        showToast('Numbers cleared.');
      });
    }

    calculateAverage();
  }


  /* ==========================================================================
     12. DISCOUNT CALCULATOR ENGINE
     ========================================================================== */
  function initDiscountCalculator() {
    const tabBtns = document.querySelectorAll('.disc-tab-btn');
    const tabPanels = document.querySelectorAll('.disc-tab-panel');

    // Tab 1: Find Sale Price
    const origPriceInput = document.getElementById('discOriginalPrice');
    const discountPctInput = document.getElementById('discDiscountPercent');

    // Tab 2: Find Discount %
    const pctOrigInput = document.getElementById('discPctOriginalPrice');
    const pctSaleInput = document.getElementById('discPctSalePrice');

    // Tab 3: Find Original Price
    const origSaleInput = document.getElementById('discOrigSalePrice');
    const origPctInput = document.getElementById('discOrigDiscountPercent');

    // Tab 4: Extra Discount
    const extraOrigInput = document.getElementById('discExtraOriginalPrice');
    const extra1Input = document.getElementById('discExtra1');
    const extra2Input = document.getElementById('discExtra2');

    // Optional Tax
    const taxInput = document.getElementById('discTaxPercent');

    // Outputs
    const savingsEl = document.getElementById('discSavings');
    const finalPriceEl = document.getElementById('discFinalPrice');
    const totalPercentEl = document.getElementById('discTotalPercent');
    const taxRowEl = document.getElementById('discTaxRow');
    const taxAmountEl = document.getElementById('discTaxAmount');

    const formulaEl = document.getElementById('discFormulaText');
    const messageEl = document.getElementById('discMessage');

    const copyBtn = document.getElementById('copyDiscBtn');
    const clearBtn = document.getElementById('clearDiscBtn');

    if (!tabBtns.length || !finalPriceEl) return;

    let activeTab = 'salePrice'; // 'salePrice', 'discountPercent', 'originalPrice', 'extraDiscount'

    // Tab Switching
    tabBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        activeTab = this.getAttribute('data-tab') || 'salePrice';
        tabBtns.forEach(b => {
          const isActive = b === btn;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        tabPanels.forEach(panel => {
          const isTarget = panel.getAttribute('data-panel') === activeTab;
          panel.style.display = isTarget ? 'block' : 'none';
        });
        calculateDiscount();
      });
    });

    function calculateDiscount() {
      const rawTax = taxInput ? taxInput.value.trim() : '';
      const taxVal = rawTax === '' ? 0 : parseSafeNumber(rawTax);

      if (taxVal !== null && taxVal < 0) {
        resetOutputs('Tax percentage cannot be negative.');
        return;
      }
      if (taxVal !== null && taxVal > 100) {
        resetOutputs('Tax percentage cannot exceed 100%.');
        return;
      }

      let original = 0;
      let discountedPrice = 0;
      let savings = 0;
      let totalDiscountPct = 0;

      if (activeTab === 'salePrice') {
        const rawP = origPriceInput.value.trim();
        const rawD = discountPctInput.value.trim();
        if (rawP === '' && rawD === '') {
          resetOutputs('Enter original price and discount percentage to calculate the sale price.');
          return;
        }
        const P = parseSafeNumber(rawP);
        const D = rawD === '' ? 0 : parseSafeNumber(rawD);

        if (P === null || P < 0) {
          resetOutputs('Original price cannot be negative.');
          return;
        }
        if (D === null || D < 0) {
          resetOutputs('Discount percentage cannot be negative.');
          return;
        }
        if (D > 100) {
          resetOutputs('Discount percentage cannot exceed 100%.');
          return;
        }

        original = P;
        savings = (P * D) / 100;
        discountedPrice = Math.max(0, P - savings);
        totalDiscountPct = D;

        if (formulaEl) {
          formulaEl.textContent = `Formula: Sale Price = ${formatPropertyValue(P, 2, true, false)} − (${formatPropertyValue(P, 2, true, false)} × ${D}%).`;
        }

      } else if (activeTab === 'discountPercent') {
        const rawP = pctOrigInput.value.trim();
        const rawS = pctSaleInput.value.trim();
        if (rawP === '' && rawS === '') {
          resetOutputs('Enter original price and sale price to find the discount percentage.');
          return;
        }
        const P = parseSafeNumber(rawP);
        const S = parseSafeNumber(rawS);

        if (P === null || P <= 0) {
          resetOutputs('Please enter an original price greater than zero.');
          return;
        }
        if (S === null || S < 0) {
          resetOutputs('Sale price cannot be negative.');
          return;
        }
        if (S > P) {
          resetOutputs('Sale price cannot be greater than the original price.');
          return;
        }

        original = P;
        savings = P - S;
        discountedPrice = S;
        totalDiscountPct = (savings / P) * 100;

        if (formulaEl) {
          formulaEl.textContent = `Formula: Discount % = (${formatPropertyValue(P, 2, true, false)} − ${formatPropertyValue(S, 2, true, false)}) ÷ ${formatPropertyValue(P, 2, true, false)} × 100.`;
        }

      } else if (activeTab === 'originalPrice') {
        const rawS = origSaleInput.value.trim();
        const rawD = origPctInput.value.trim();
        if (rawS === '' && rawD === '') {
          resetOutputs('Enter sale price and discount percentage to find the original price.');
          return;
        }
        const S = parseSafeNumber(rawS);
        const D = parseSafeNumber(rawD);

        if (S === null || S < 0) {
          resetOutputs('Sale price cannot be negative.');
          return;
        }
        if (D === null || D < 0) {
          resetOutputs('Discount percentage cannot be negative.');
          return;
        }
        if (D >= 100) {
          resetOutputs('Discount percentage must be less than 100% to calculate the original price.');
          return;
        }

        original = S / (1 - D / 100);
        discountedPrice = S;
        savings = original - S;
        totalDiscountPct = D;

        if (formulaEl) {
          formulaEl.textContent = `Formula: Original Price = ${formatPropertyValue(S, 2, true, false)} ÷ (1 − ${D}%).`;
        }

      } else if (activeTab === 'extraDiscount') {
        const rawP = extraOrigInput.value.trim();
        const rawD1 = extra1Input.value.trim();
        const rawD2 = extra2Input.value.trim();
        if (rawP === '' && rawD1 === '') {
          resetOutputs('Enter original price and both discount percentages.');
          return;
        }
        const P = parseSafeNumber(rawP);
        const D1 = rawD1 === '' ? 0 : parseSafeNumber(rawD1);
        const D2 = rawD2 === '' ? 0 : parseSafeNumber(rawD2);

        if (P === null || P < 0) {
          resetOutputs('Original price cannot be negative.');
          return;
        }
        if (D1 === null || D1 < 0 || D2 === null || D2 < 0) {
          resetOutputs('Discount percentages cannot be negative.');
          return;
        }
        if (D1 > 100 || D2 > 100) {
          resetOutputs('Discount percentages cannot exceed 100%.');
          return;
        }

        // Sequential discounts: P * (1 - d1) * (1 - d2)
        const step1 = P * (1 - D1 / 100);
        discountedPrice = step1 * (1 - D2 / 100);
        savings = P - discountedPrice;
        totalDiscountPct = (1 - (1 - D1 / 100) * (1 - D2 / 100)) * 100;
        original = P;

        if (formulaEl) {
          formulaEl.textContent = `Formula: Extra discounts apply sequentially: ${formatPropertyValue(P, 2, true, false)} × (1 − ${D1}%) × (1 − ${D2}%). Total off = ${formatDisplayNumber(totalDiscountPct, 2, true)}%.`;
        }
      }

      // Tax calculation applied after discount
      let taxAmount = 0;
      if (taxVal && taxVal > 0) {
        taxAmount = (discountedPrice * taxVal) / 100;
      }
      const finalPrice = discountedPrice + taxAmount;

      // Update UI outputs
      savingsEl.textContent = formatPropertyValue(savings, 2, false, true);
      finalPriceEl.textContent = formatPropertyValue(finalPrice, 2, false, true);
      totalPercentEl.textContent = `${formatDisplayNumber(totalDiscountPct, 2, true)}%`;

      if (taxRowEl && taxAmountEl) {
        if (taxVal && taxVal > 0) {
          taxRowEl.style.display = 'flex';
          taxAmountEl.textContent = `+ ${formatPropertyValue(taxAmount, 2, false, true)} (${taxVal}%)`;
        } else {
          taxRowEl.style.display = 'none';
        }
      }

      if (messageEl) messageEl.textContent = '';
    }

    function resetOutputs(msg) {
      if (savingsEl) savingsEl.textContent = '—';
      if (finalPriceEl) finalPriceEl.textContent = '—';
      if (totalPercentEl) totalPercentEl.textContent = '—';
      if (taxRowEl) taxRowEl.style.display = 'none';
      if (messageEl) messageEl.textContent = msg;
    }

    // Input listeners
    const allInputs = [
      origPriceInput, discountPctInput,
      pctOrigInput, pctSaleInput,
      origSaleInput, origPctInput,
      extraOrigInput, extra1Input, extra2Input,
      taxInput
    ];

    allInputs.forEach(input => {
      if (input) {
        input.addEventListener('input', calculateDiscount);
        input.addEventListener('change', calculateDiscount);
      }
    });

    // Copy Result
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (!finalPriceEl || finalPriceEl.textContent === '—') {
          showToast('Please calculate a discount first.');
          return;
        }
        let text = `Discount Calculation Summary:
You Save: ${savingsEl.textContent}
Final Price: ${finalPriceEl.textContent}
Total Discount: ${totalPercentEl.textContent}`;
        if (taxRowEl && taxRowEl.style.display !== 'none') {
          text += `\nTax Amount: ${taxAmountEl.textContent}`;
        }
        copyResultToClipboard(text, copyBtn);
      });
    }

    // Clear Button
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        allInputs.forEach(input => {
          if (input) input.value = '';
        });
        calculateDiscount();
        showToast('Discount inputs cleared.');
      });
    }

    // Bind settings bar & trigger calculation
    bindPropertySettingsBar(calculateDiscount);
    calculateDiscount();
  }

  /* ==========================================================================
     13. WEIGHTED GRADE CALCULATOR ENGINE
     ========================================================================== */
  function initWeightedGradeCalculator() {
    const tableBody = document.getElementById('weightedRowsBody');
    const addRowBtn = document.getElementById('addWeightedRowBtn');
    const typeBtns = document.querySelectorAll('.grade-type-btn');
    const totalWeightBadge = document.getElementById('weightedTotalBadge');
    const gradeResultEl = document.getElementById('weightedGradeResult');
    const letterResultEl = document.getElementById('weightedLetterResult');
    const pointsBreakdownEl = document.getElementById('weightedPointsBreakdown');
    const normalizedBreakdownEl = document.getElementById('weightedNormalizedBreakdown');
    const messageEl = document.getElementById('weightedMessage');
    const formulaEl = document.getElementById('weightedFormulaText');
    const scaleInputs = document.querySelectorAll('.scale-cutoff-input');
    const resetScaleBtn = document.getElementById('resetWeightedScaleBtn');

    const copyBtn = document.getElementById('copyWeightedBtn');
    const clearBtn = document.getElementById('clearWeightedBtn');

    if (!tableBody || !gradeResultEl) return;

    let gradeType = 'percent'; // 'percent' or 'points'
    let rowCounter = 0;

    // Editable Grade Scale (default A: 90, B: 80, C: 70, D: 60)
    let currentScale = Object.assign({}, CALC_CONFIG.weightedGrade.defaultScale);

    function syncScaleInputs() {
      scaleInputs.forEach(input => {
        const grade = input.getAttribute('data-grade');
        if (currentScale[grade] !== undefined) {
          input.value = currentScale[grade];
        }
      });
    }

    scaleInputs.forEach(input => {
      input.addEventListener('input', function () {
        const grade = this.getAttribute('data-grade');
        const val = parseSafeNumber(this.value);
        if (val !== null && val >= 0) {
          currentScale[grade] = val;
          calculateWeighted();
        }
      });
    });

    if (resetScaleBtn) {
      resetScaleBtn.addEventListener('click', () => {
        currentScale = Object.assign({}, CALC_CONFIG.weightedGrade.defaultScale);
        syncScaleInputs();
        calculateWeighted();
        showToast('Grade scale reset to default.');
      });
    }

    // Toggle Grade Type (Percent vs Points)
    typeBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        gradeType = this.getAttribute('data-type') || 'percent';
        typeBtns.forEach(b => {
          const isActive = b === btn;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        updateTableHeadersAndRows();
        calculateWeighted();
      });
    });

    function updateTableHeadersAndRows() {
      const thGrade = document.getElementById('thGradeHeader');
      if (thGrade) {
        thGrade.textContent = gradeType === 'points' ? 'Points Earned / Possible' : 'Grade (%)';
      }
      const rows = tableBody.querySelectorAll('tr.calc-row-item');
      rows.forEach(tr => {
        const gradeCell = tr.querySelector('.cell-grade-input');
        if (!gradeCell) return;
        const currentGradeVal = tr.querySelector('.row-grade-val')?.value || '';
        const currentEarned = tr.querySelector('.row-earned-val')?.value || '';
        const currentPossible = tr.querySelector('.row-possible-val')?.value || '';

        if (gradeType === 'points') {
          gradeCell.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px;">
              <input type="text" inputmode="decimal" class="calc-input row-earned-val" placeholder="Earned" value="${currentEarned || currentGradeVal}" style="min-width: 60px;">
              <span>/</span>
              <input type="text" inputmode="decimal" class="calc-input row-possible-val" placeholder="Possible" value="${currentPossible || '100'}" style="min-width: 60px;">
            </div>
          `;
        } else {
          gradeCell.innerHTML = `
            <input type="text" inputmode="decimal" class="calc-input row-grade-val" placeholder="e.g. 90" value="${currentGradeVal || currentEarned}">
          `;
        }
        attachRowListeners(tr);
      });
    }

    function addRow(name = '', gradeOrEarned = '', weight = '', possible = '100') {
      rowCounter++;
      const tr = document.createElement('tr');
      tr.className = 'calc-row-item';

      let gradeHtml = '';
      if (gradeType === 'points') {
        gradeHtml = `
          <div style="display: flex; align-items: center; gap: 6px;">
            <input type="text" inputmode="decimal" class="calc-input row-earned-val" placeholder="Earned" value="${gradeOrEarned}" style="min-width: 60px;">
            <span>/</span>
            <input type="text" inputmode="decimal" class="calc-input row-possible-val" placeholder="Possible" value="${possible}" style="min-width: 60px;">
          </div>
        `;
      } else {
        gradeHtml = `
          <input type="text" inputmode="decimal" class="calc-input row-grade-val" placeholder="e.g. 90" value="${gradeOrEarned}">
        `;
      }

      tr.innerHTML = `
        <td>
          <input type="text" class="calc-input row-name-val" placeholder="Assignment ${rowCounter}" value="${name}">
        </td>
        <td class="cell-grade-input">
          ${gradeHtml}
        </td>
        <td>
          <input type="text" inputmode="decimal" class="calc-input row-weight-val" placeholder="e.g. 20" value="${weight}">
        </td>
        <td class="row-points-contributed" style="text-align: right; font-weight: 600; color: var(--text-main);">
          —
        </td>
        <td style="text-align: center; width: 44px;">
          <button type="button" class="btn-remove-row remove-row-btn" aria-label="Remove Row">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </td>
      `;

      tableBody.appendChild(tr);
      attachRowListeners(tr);

      tr.querySelector('.remove-row-btn').addEventListener('click', function () {
        const rows = tableBody.querySelectorAll('tr.calc-row-item');
        if (rows.length > 1) {
          tr.remove();
          calculateWeighted();
        } else {
          showToast('At least one row is required.');
        }
      });

      calculateWeighted();
    }

    function attachRowListeners(tr) {
      tr.querySelectorAll('input').forEach(input => {
        input.removeEventListener('input', calculateWeighted);
        input.addEventListener('input', calculateWeighted);
      });
    }

    function calculateWeighted() {
      const rows = tableBody.querySelectorAll('tr.calc-row-item');
      let totalWeight = 0;
      let totalPoints = 0;
      let hasPositiveWeight = false;

      rows.forEach(tr => {
        let gradePct = null;
        if (gradeType === 'points') {
          const earned = parseSafeNumber(tr.querySelector('.row-earned-val')?.value);
          const possible = parseSafeNumber(tr.querySelector('.row-possible-val')?.value);
          if (earned !== null && possible !== null && possible > 0) {
            gradePct = (earned / possible) * 100;
          }
        } else {
          gradePct = parseSafeNumber(tr.querySelector('.row-grade-val')?.value);
        }

        const weight = parseSafeNumber(tr.querySelector('.row-weight-val')?.value) || 0;
        const ptsCell = tr.querySelector('.row-points-contributed');

        if (weight > 0) hasPositiveWeight = true;

        if (gradePct !== null && weight > 0) {
          const points = (gradePct * weight) / 100;
          totalPoints += points;
          totalWeight += weight;
          if (ptsCell) ptsCell.textContent = formatDisplayNumber(points, 2, true);
        } else if (weight > 0) {
          totalWeight += weight;
          if (ptsCell) ptsCell.textContent = '—';
        } else {
          if (ptsCell) ptsCell.textContent = '—';
        }
      });

      // Update Total Weight Badge
      if (totalWeightBadge) {
        totalWeightBadge.textContent = `Total Weight: ${formatDisplayNumber(totalWeight, 2, true)}%`;
        if (Math.abs(totalWeight - 100) < 0.001) {
          totalWeightBadge.classList.add('weight-ok');
          totalWeightBadge.classList.remove('weight-warn');
        } else {
          totalWeightBadge.classList.add('weight-warn');
          totalWeightBadge.classList.remove('weight-ok');
        }
      }

      // Validation
      if (!hasPositiveWeight || totalWeight <= 0) {
        gradeResultEl.textContent = '—';
        if (letterResultEl) letterResultEl.textContent = '—';
        if (pointsBreakdownEl) pointsBreakdownEl.textContent = 'Points: —';
        if (normalizedBreakdownEl) normalizedBreakdownEl.textContent = 'Normalized: —';
        if (messageEl) messageEl.textContent = 'Total weight cannot be 0%. Please enter at least one positive weight.';
        return;
      }

      if (messageEl) messageEl.textContent = '';

      const normalized = (totalPoints / totalWeight) * 100;
      const roundedNorm = Math.round(normalized * 100) / 100;
      const roundedPts = Math.round(totalPoints * 100) / 100;

      gradeResultEl.textContent = `${formatDisplayNumber(roundedNorm, 2, true)}%`;

      // Determine letter grade from editable scale
      let letter = 'F';
      if (roundedNorm >= (currentScale.A ?? 90)) letter = 'A';
      else if (roundedNorm >= (currentScale.B ?? 80)) letter = 'B';
      else if (roundedNorm >= (currentScale.C ?? 70)) letter = 'C';
      else if (roundedNorm >= (currentScale.D ?? 60)) letter = 'D';

      if (letterResultEl) letterResultEl.textContent = letter;

      // Show points out of weight entered AND normalized to 100%
      if (Math.abs(totalWeight - 100) < 0.001) {
        if (pointsBreakdownEl) pointsBreakdownEl.textContent = `Points: ${formatDisplayNumber(roundedPts, 2, true)} of 100`;
        if (normalizedBreakdownEl) normalizedBreakdownEl.textContent = `Weights add up to 100%`;
      } else {
        if (pointsBreakdownEl) {
          pointsBreakdownEl.textContent = `${formatDisplayNumber(roundedPts, 2, true)} points of ${formatDisplayNumber(totalWeight, 2, true)}`;
        }
        if (normalizedBreakdownEl) {
          normalizedBreakdownEl.textContent = `Normalized to 100%: ${formatDisplayNumber(roundedNorm, 2, true)}%`;
        }
      }

      if (formulaEl) {
        formulaEl.textContent = `Formula: Weighted Grade = Total Points (${formatDisplayNumber(roundedPts, 2, true)}) ÷ Total Weight (${formatDisplayNumber(totalWeight, 2, true)}%) × 100.`;
      }
    }

    if (addRowBtn) {
      addRowBtn.addEventListener('click', () => {
        addRow();
      });
    }

    // Copy Summary
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (!gradeResultEl || gradeResultEl.textContent === '—') {
          showToast('Please enter grades and weights first.');
          return;
        }
        let summary = `Weighted Grade Summary:
Final Weighted Grade: ${gradeResultEl.textContent}
Letter Grade: ${letterResultEl ? letterResultEl.textContent : ''}
${pointsBreakdownEl ? pointsBreakdownEl.textContent : ''}
${normalizedBreakdownEl ? normalizedBreakdownEl.textContent : ''}`;
        copyResultToClipboard(summary, copyBtn);
      });
    }

    // Clear Button
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        tableBody.innerHTML = '';
        rowCounter = 0;
        initDefaultRows();
        showToast('Rows cleared.');
      });
    }

    function initDefaultRows() {
      // Start with 5 rows (pre-fill first 3 for test friendliness)
      addRow('Homework', '90', '30');
      addRow('Midterm', '80', '20');
      addRow('Final Exam', '70', '50');
      addRow('Project', '', '');
      addRow('Participation', '', '');
    }

    syncScaleInputs();
    initDefaultRows();
  }


  /* ==========================================================================
     14. FINAL GRADE CALCULATOR ENGINE
     ========================================================================== */
  function initFinalGradeCalculator() {
    const currentInput = document.getElementById('finalCurrentGrade');
    const wantedInput = document.getElementById('finalWantedGrade');
    const weightInput = document.getElementById('finalExamWeight');

    const neededScoreEl = document.getElementById('finalNeededScore');
    const neededStatusBadge = document.getElementById('finalStatusBadge');
    const messageEl = document.getElementById('finalMessage');
    const formulaEl = document.getElementById('finalFormulaText');

    const targetsTableBody = document.getElementById('finalTargetsTableBody');
    const addTargetBtn = document.getElementById('addTargetGradeBtn');

    const whatIfSlider = document.getElementById('whatIfSlider');
    const whatIfVal = document.getElementById('whatIfVal');
    const whatIfResult = document.getElementById('whatIfResult');

    const copyBtn = document.getElementById('copyFinalBtn');
    const clearBtn = document.getElementById('clearFinalBtn');

    if (!currentInput || !neededScoreEl) return;

    let targetGrades = [...CALC_CONFIG.finalGrade.defaultTargets];

    function calculateFinalExamScore(current, wanted, weight) {
      if (weight <= 0 || weight > 100) {
        return { error: 'Weight must be greater than 0% and up to 100%.' };
      }
      const needed = (wanted - current * (1 - weight / 100)) / (weight / 100);
      const rounded = Math.round(needed * 100) / 100;
      let status = 'achievable';
      let message = '';

      if (rounded <= 0) {
        status = 'safe';
        message = 'You already have enough, even a 0% keeps your target';
      } else if (rounded > 100) {
        status = 'extra_credit';
        message = 'You need more than 100%, which is only possible with extra credit';
      }
      return { needed: rounded, status, message };
    }

    function calculateFinalGrade() {
      const rawCurrent = currentInput.value.trim();
      const rawWanted = wantedInput.value.trim();
      const rawWeight = weightInput.value.trim();

      if (rawCurrent === '' && rawWanted === '') {
        resetOutputs('Enter your current class grade, wanted grade, and final exam weight.');
        return;
      }

      const current = parseSafeNumber(rawCurrent);
      const wanted = parseSafeNumber(rawWanted);
      const weight = parseSafeNumber(rawWeight);

      if (current === null || current < 0) {
        resetOutputs('Current grade cannot be negative.');
        return;
      }
      if (wanted === null || wanted < 0) {
        resetOutputs('Wanted grade cannot be negative.');
        return;
      }
      if (weight === null || weight <= 0 || weight > 100) {
        resetOutputs('Weight must be greater than 0% and up to 100%.');
        return;
      }

      const result = calculateFinalExamScore(current, wanted, weight);

      if (result.error) {
        resetOutputs(result.error);
        return;
      }

      neededScoreEl.textContent = `${formatDisplayNumber(result.needed, 2, true)}%`;

      if (messageEl) {
        messageEl.textContent = result.message || '';
      }

      if (neededStatusBadge) {
        if (result.status === 'safe') {
          neededStatusBadge.textContent = 'Target Secured';
          neededStatusBadge.className = 'weight-total-badge weight-ok';
        } else if (result.status === 'extra_credit') {
          neededStatusBadge.textContent = 'Extra Credit Needed';
          neededStatusBadge.className = 'weight-total-badge weight-warn';
        } else {
          neededStatusBadge.textContent = 'Achievable';
          neededStatusBadge.className = 'weight-total-badge weight-ok';
        }
      }

      if (formulaEl) {
        formulaEl.textContent = `Formula: Needed Score = (${wanted}% − ${current}% × (1 − ${weight / 100})) ÷ ${weight / 100} = ${formatDisplayNumber(result.needed, 2, true)}%.`;
      }

      renderTargetsTable(current, weight);
      updateWhatIf(current, weight);
    }

    function renderTargetsTable(current, weight) {
      if (!targetsTableBody) return;
      targetsTableBody.innerHTML = '';

      targetGrades.forEach((target, index) => {
        const res = calculateFinalExamScore(current, target, weight);
        let note = 'Achievable';
        if (res.status === 'safe') note = 'Already secured (0% needed)';
        else if (res.status === 'extra_credit') note = 'Requires extra credit';

        let letter = 'F';
        if (target >= 90) letter = 'A';
        else if (target >= 80) letter = 'B';
        else if (target >= 70) letter = 'C';
        else if (target >= 60) letter = 'D';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <input type="number" class="target-grade-edit calc-input" data-index="${index}" min="0" max="100" step="1" value="${target}" style="width:68px; padding:4px 6px; font-weight:600; text-align:center;" aria-label="Target Grade %">
              <span>% (${letter})</span>
            </div>
          </td>
          <td><strong>${formatDisplayNumber(res.needed, 2, true)}%</strong></td>
          <td style="font-size: 0.8125rem; color: var(--text-muted);">${note}</td>
          <td style="text-align: right;">
            <button type="button" class="btn-remove-row remove-target-btn" data-index="${index}" aria-label="Remove target grade ${target}%" title="Remove target">&times;</button>
          </td>
        `;
        targetsTableBody.appendChild(tr);
      });

      // Bind edit listeners
      targetsTableBody.querySelectorAll('.target-grade-edit').forEach(input => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.index, 10);
          const val = parseSafeNumber(e.target.value);
          if (val !== null && val >= 0 && val <= 100) {
            targetGrades[idx] = val;
            calculateFinalGrade();
          } else {
            e.target.value = targetGrades[idx];
          }
        });
      });

      // Bind remove buttons
      targetsTableBody.querySelectorAll('.remove-target-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.index, 10);
          if (targetGrades.length > 1) {
            targetGrades.splice(idx, 1);
            calculateFinalGrade();
          } else {
            showToast('You must keep at least one target grade.');
          }
        });
      });
    }

    if (addTargetBtn) {
      addTargetBtn.addEventListener('click', () => {
        const lastVal = targetGrades.length > 0 ? targetGrades[targetGrades.length - 1] : 60;
        const newVal = Math.max(0, lastVal - 10);
        targetGrades.push(newVal);
        calculateFinalGrade();
      });
    }

    function updateWhatIf(current, weight) {
      if (!whatIfSlider || !whatIfVal || !whatIfResult) return;
      const finalScore = parseFloat(whatIfSlider.value);
      whatIfVal.textContent = `${finalScore}%`;

      const overall = current * (1 - weight / 100) + finalScore * (weight / 100);
      const roundedOverall = Math.round(overall * 100) / 100;
      whatIfResult.textContent = `If you score ${finalScore}% on the final exam, your overall grade will be ${formatDisplayNumber(roundedOverall, 2, true)}%.`;
    }

    if (whatIfSlider) {
      whatIfSlider.addEventListener('input', () => {
        const rawCurrent = currentInput.value.trim();
        const rawWeight = weightInput.value.trim();
        const current = parseSafeNumber(rawCurrent) || 0;
        const weight = parseSafeNumber(rawWeight) || 0;
        updateWhatIf(current, weight);
      });
    }

    function resetOutputs(msg) {
      if (neededScoreEl) neededScoreEl.textContent = '—';
      if (neededStatusBadge) neededStatusBadge.textContent = '';
      if (messageEl) messageEl.textContent = msg;
      if (targetsTableBody) targetsTableBody.innerHTML = '';
      if (whatIfResult) whatIfResult.textContent = '';
    }

    [currentInput, wantedInput, weightInput].forEach(input => {
      input.addEventListener('input', calculateFinalGrade);
      input.addEventListener('change', calculateFinalGrade);
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (!neededScoreEl || neededScoreEl.textContent === '—') {
          showToast('Please calculate a final grade requirement first.');
          return;
        }
        let text = `Final Grade Requirement Summary:
Current Grade: ${currentInput.value}%
Wanted Grade: ${wantedInput.value}%
Final Exam Weight: ${weightInput.value}%
Needed Exam Score: ${neededScoreEl.textContent}`;
        if (messageEl && messageEl.textContent) {
          text += `\nNote: ${messageEl.textContent}`;
        }
        copyResultToClipboard(text, copyBtn);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        currentInput.value = '';
        wantedInput.value = '';
        weightInput.value = '';
        calculateFinalGrade();
        showToast('Fields cleared.');
      });
    }

    calculateFinalGrade();
  }


  /* ==========================================================================
     15. HIJRI DATE CONVERTER ENGINE
     ========================================================================== */
  function initHijriDateConverter() {
    const tabBtns = document.querySelectorAll('.hijri-tab-btn');
    const tabPanels = document.querySelectorAll('.hijri-tab-panel');

    // Tab 1: Gregorian to Hijri
    const gregInput = document.getElementById('gregorianDateInput');

    // Tab 2: Hijri to Gregorian
    const hijriDayInput = document.getElementById('hijriDayInput');
    const hijriMonthSelect = document.getElementById('hijriMonthSelect');
    const hijriYearInput = document.getElementById('hijriYearInput');

    // Local Moon Sighting Adjustment
    const adjSelect = document.getElementById('hijriAdjustmentSelect');

    // Outputs
    const mainTitleEl = document.getElementById('hijriDateTitle');
    const weekdayBadgeEl = document.getElementById('hijriWeekdayBadge');
    const secondaryDateEl = document.getElementById('hijriSecondaryDate');
    const messageEl = document.getElementById('hijriMessage');

    const copyBtn = document.getElementById('copyHijriBtn');
    const todayBtn = document.getElementById('setTodayDateBtn');

    if (!mainTitleEl) return;

    let activeTab = 'gregToHijri'; // 'gregToHijri', 'hijriToGreg'

    // Supported calendar check
    let isSupported = false;
    let hijriFormatter = null;

    try {
      hijriFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        weekday: 'long'
      });
      isSupported = true;
    } catch (e) {
      isSupported = false;
    }

    if (!isSupported || !hijriFormatter) {
      if (messageEl) {
        messageEl.textContent = 'The Islamic Umm al-Qura calendar is not supported by your browser.';
      }
      return;
    }

    // Populate Hijri Month Options
    if (hijriMonthSelect && hijriMonthSelect.options.length <= 1) {
      hijriMonthSelect.innerHTML = '';
      CALC_CONFIG.hijri.monthNames.forEach((name, idx) => {
        const opt = document.createElement('option');
        opt.value = idx + 1;
        opt.textContent = `${idx + 1} - ${name}`;
        hijriMonthSelect.appendChild(opt);
      });
    }

    function gregorianToHijriParts(date, adjustment = 0) {
      const d = new Date(date);
      if (adjustment !== 0) {
        d.setUTCDate(d.getUTCDate() + adjustment);
      }
      const parts = hijriFormatter.formatToParts(d);
      let year, month, day, weekday;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p.type === 'year') year = parseInt(p.value, 10);
        if (p.type === 'month') month = parseInt(p.value, 10);
        if (p.type === 'day') day = parseInt(p.value, 10);
        if (p.type === 'weekday') weekday = p.value;
      }
      return { year, month, day, weekday, adjustedDate: d };
    }

    function hijriToGregorianDate(hYear, hMonth, hDay, adjustment = 0) {
      // Validate bounds
      if (hYear < CALC_CONFIG.hijri.minHijriYear || hYear > CALC_CONFIG.hijri.maxHijriYear) {
        return { error: `Supported Hijri year range is ${CALC_CONFIG.hijri.minHijriYear} AH to ${CALC_CONFIG.hijri.maxHijriYear} AH.` };
      }

      // Check day 31
      if (hDay > 30) {
        return { error: 'Invalid Hijri day: Day 31 does not exist in the Hijri calendar. Months have either 29 or 30 days.' };
      }
      if (hDay < 1) {
        return { error: 'Hijri day must be at least 1.' };
      }

      // Approximate Gregorian year
      const approxGYear = Math.round(hYear * 0.970229 + 621.56);
      let cur = new Date(Date.UTC(approxGYear, 0, 1));

      // Iteratively approach target
      for (let iter = 0; iter < 10; iter++) {
        const h = gregorianToHijriParts(cur, 0);
        const dayDiff = Math.round((hYear - h.year) * 354.36 + (hMonth - h.month) * 29.53 + (hDay - h.day));
        if (dayDiff === 0) break;
        cur.setUTCDate(cur.getUTCDate() + dayDiff);
      }

      // Exact fine scan within +- 6 days
      let match = null;
      let monthLength = 29;

      for (let offset = -6; offset <= 6; offset++) {
        const testDate = new Date(cur);
        testDate.setUTCDate(testDate.getUTCDate() + offset);
        const h = gregorianToHijriParts(testDate, 0);
        if (h.year === hYear && h.month === hMonth) {
          if (h.day === 30) monthLength = 30;
          if (h.day === hDay) {
            match = testDate;
          }
        }
      }

      if (hDay === 30 && monthLength === 29) {
        const mName = CALC_CONFIG.hijri.monthNames[hMonth - 1] || 'this month';
        return { error: `Invalid Hijri day: ${mName} in ${hYear} AH has only 29 days.` };
      }

      if (!match) {
        return { error: 'Could not find a matching Gregorian date for this Hijri entry.' };
      }

      if (adjustment !== 0) {
        match.setUTCDate(match.getUTCDate() - adjustment);
      }

      return { date: match };
    }

    // Tab Switching
    tabBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        const tab = this.getAttribute('data-tab');
        if (tab === 'today') {
          setTodayDate();
          activeTab = 'gregToHijri';
        } else {
          activeTab = tab || 'gregToHijri';
        }
        tabBtns.forEach(b => {
          const isActive = b === btn;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        tabPanels.forEach(panel => {
          const panelTarget = tab === 'today' ? 'gregToHijri' : activeTab;
          const isTarget = panel.getAttribute('data-panel') === panelTarget;
          panel.style.display = isTarget ? 'block' : 'none';
        });
        convertDate();
      });
    });

    function convertDate() {
      const adjustment = parseInt(adjSelect ? adjSelect.value : '0', 10) || 0;

      if (activeTab === 'gregToHijri') {
        const rawDate = gregInput.value;
        if (!rawDate) {
          resetOutputs('Please choose a Gregorian date.');
          return;
        }

        const parts = rawDate.split('-').map(Number);
        if (parts.length !== 3) {
          resetOutputs('Invalid date format.');
          return;
        }

        const gDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        const h = gregorianToHijriParts(gDate, adjustment);

        if (h.year < CALC_CONFIG.hijri.minHijriYear || h.year > CALC_CONFIG.hijri.maxHijriYear) {
          resetOutputs(`Date is outside the supported Umm al-Qura range (${CALC_CONFIG.hijri.minHijriYear} AH to ${CALC_CONFIG.hijri.maxHijriYear} AH).`);
          return;
        }

        const monthName = CALC_CONFIG.hijri.monthNames[h.month - 1] || `Month ${h.month}`;
        mainTitleEl.textContent = `${h.day} ${monthName} ${h.year} AH`;
        if (weekdayBadgeEl) weekdayBadgeEl.textContent = h.weekday;

        const gDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const gMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        secondaryDateEl.textContent = `Gregorian: ${gDayNames[gDate.getUTCDay()]}, ${gDate.getUTCDate()} ${gMonthNames[gDate.getUTCMonth()]} ${gDate.getUTCFullYear()} CE`;

        if (messageEl) messageEl.textContent = '';

      } else {
        const rawDay = parseInt(hijriDayInput.value, 10);
        const rawMonth = parseInt(hijriMonthSelect.value, 10);
        const rawYear = parseInt(hijriYearInput.value, 10);

        if (Number.isNaN(rawDay) || Number.isNaN(rawMonth) || Number.isNaN(rawYear)) {
          resetOutputs('Please enter a valid Hijri day, month, and year.');
          return;
        }

        const res = hijriToGregorianDate(rawYear, rawMonth, rawDay, adjustment);

        if (res.error) {
          resetOutputs(res.error);
          return;
        }

        const gDate = res.date;
        const gDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const gMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const weekdayStr = gDayNames[gDate.getUTCDay()];

        const mName = CALC_CONFIG.hijri.monthNames[rawMonth - 1] || `Month ${rawMonth}`;
        mainTitleEl.textContent = `${weekdayStr}, ${gDate.getUTCDate()} ${gMonthNames[gDate.getUTCMonth()]} ${gDate.getUTCFullYear()} CE`;
        if (weekdayBadgeEl) weekdayBadgeEl.textContent = weekdayStr;
        secondaryDateEl.textContent = `Islamic: ${rawDay} ${mName} ${rawYear} AH`;

        if (messageEl) messageEl.textContent = '';
      }
    }

    function resetOutputs(msg) {
      if (mainTitleEl) mainTitleEl.textContent = '—';
      if (weekdayBadgeEl) weekdayBadgeEl.textContent = '—';
      if (secondaryDateEl) secondaryDateEl.textContent = '—';
      if (messageEl) messageEl.textContent = msg;
    }

    // Listeners
    if (gregInput) {
      gregInput.addEventListener('input', convertDate);
      gregInput.addEventListener('change', convertDate);
    }

    [hijriDayInput, hijriMonthSelect, hijriYearInput].forEach(el => {
      if (el) {
        el.addEventListener('input', convertDate);
        el.addEventListener('change', convertDate);
      }
    });

    if (adjSelect) {
      adjSelect.addEventListener('change', convertDate);
    }

    // Set Today Helper
    function setTodayDate() {
      const now = new Date();
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(now.getUTCDate()).padStart(2, '0');
      if (gregInput) gregInput.value = `${yyyy}-${mm}-${dd}`;

      // Today in Hijri
      const h = gregorianToHijriParts(new Date(Date.UTC(yyyy, now.getUTCMonth(), now.getUTCDate())), 0);
      if (hijriDayInput) hijriDayInput.value = h.day;
      if (hijriMonthSelect) hijriMonthSelect.value = h.month;
      if (hijriYearInput) hijriYearInput.value = h.year;

      convertDate();
    }

    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        setTodayDate();
        showToast('Set to today\'s date.');
      });
    }

    // Copy Result
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (!mainTitleEl || mainTitleEl.textContent === '—') {
          showToast('Please convert a date first.');
          return;
        }
        const text = `Date Conversion:
Primary Date: ${mainTitleEl.textContent}
Weekday: ${weekdayBadgeEl ? weekdayBadgeEl.textContent : ''}
${secondaryDateEl ? secondaryDateEl.textContent : ''}`;
        copyResultToClipboard(text, copyBtn);
      });
    }

    setTodayDate();
  }

  /* ==========================================================================
     16. GLOBAL EXPOSURE
     ========================================================================== */
  window.CALC_CONFIG = CALC_CONFIG;
  window.PROPERTY_CONFIG = CALC_CONFIG.property;
  window.initGpaCalculator = initGpaCalculator;
  window.initCgpaCalculator = initCgpaCalculator;
  window.initCgpaToPercentage = initCgpaToPercentage;
  window.initPercentageCalculator = initPercentageCalculator;
  window.initAttendanceCalculator = initAttendanceCalculator;

  // Property & Finance Calculators
  window.initHouseConstructionCalculator = initHouseConstructionCalculator;
  window.initInstallmentCalculator = initInstallmentCalculator;
  window.initPlotPriceCalculator = initPlotPriceCalculator;
  window.initLoanCalculator = initLoanCalculator;
  window.initAverageCalculator = initAverageCalculator;
  window.initDiscountCalculator = initDiscountCalculator;

  // Academic & Calendar Calculators
  window.initWeightedGradeCalculator = initWeightedGradeCalculator;
  window.initFinalGradeCalculator = initFinalGradeCalculator;
  window.initHijriDateConverter = initHijriDateConverter;

})();



