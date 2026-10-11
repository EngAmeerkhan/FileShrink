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
     10. GLOBAL EXPOSURE
     ========================================================================== */
  window.CALC_CONFIG = CALC_CONFIG;
  window.PROPERTY_CONFIG = CALC_CONFIG.property;
  window.initGpaCalculator = initGpaCalculator;
  window.initCgpaCalculator = initCgpaCalculator;
  window.initCgpaToPercentage = initCgpaToPercentage;
  window.initPercentageCalculator = initPercentageCalculator;
  window.initAttendanceCalculator = initAttendanceCalculator;

  // Property Calculators
  window.initHouseConstructionCalculator = initHouseConstructionCalculator;
  window.initInstallmentCalculator = initInstallmentCalculator;
  window.initPlotPriceCalculator = initPlotPriceCalculator;

})();

