/**
 * FileShrink - Cover Letter Generator Tool (/cover-letter-generator/)
 * Pure client-side processing, selectable A4 PDF, plain text export.
 */

(function () {
  'use strict';

  function initCoverLetterTool() {
    // Form Inputs
    const fullNameInput = document.getElementById('letterFullName');
    const emailInput = document.getElementById('letterEmail');
    const phoneInput = document.getElementById('letterPhone');
    const cityInput = document.getElementById('letterCity');
    const dateInput = document.getElementById('letterDate');
    const companyInput = document.getElementById('letterCompany');
    const managerInput = document.getElementById('letterManager');
    const jobTitleInput = document.getElementById('letterJobTitle');
    const jobSourceInput = document.getElementById('letterJobSource');
    const skillsInput = document.getElementById('letterSkills');
    const achievementInput = document.getElementById('letterAchievement');
    const freshGradSwitch = document.getElementById('freshGradSwitch');

    // Controls & Action Elements
    const regenerateBtn = document.getElementById('regenerateLetterBtn');
    const letterEditor = document.getElementById('letterEditor');
    const previewSheet = document.getElementById('letterPreviewSheet');
    const copyTextBtn = document.getElementById('copyLetterBtn');
    const downloadPdfBtn = document.getElementById('downloadLetterPdfBtn');
    const downloadTxtBtn = document.getElementById('downloadLetterTxtBtn');
    const charCountEl = document.getElementById('letterCharCount');
    const wordCountEl = document.getElementById('letterWordCount');
    const pdfNoticeEl = document.getElementById('letterPdfNotice');
    const templateBtns = document.querySelectorAll('.template-option-btn');

    if (!letterEditor || !previewSheet) return;

    let activeTemplate = 'fresh'; // 'fresh', 'experienced', 'internship'

    // Format current date as YYYY-MM-DD for date input
    if (dateInput && !dateInput.value) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      dateInput.value = `${yyyy}-${mm}-${dd}`;
    }

    // Helper: Format date for letter body (e.g. October 11, 2026)
    function formatLetterDate(rawDate) {
      if (!rawDate) {
        const d = new Date();
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      }
      try {
        const parts = rawDate.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          }
        }
      } catch (e) {}
      return rawDate;
    }

    // Helper: Check if string contains characters outside Latin range (e.g. Urdu, Arabic, CJK)
    function hasUnsupportedPdfChars(text) {
      if (!text) return false;
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        // Standard Latin-1 / WinAnsi max code is 255. Characters above 255 (like Urdu \u0600-\u06FF) cannot be drawn in default jsPDF fonts
        if (code > 255) {
          return true;
        }
      }
      return false;
    }

    // Template 1: Fresh Graduate
    function buildFreshGraduateLetter(data) {
      const lines = [];

      // Header: Sender
      lines.push(data.fullName);
      const contactBits = [data.city, data.phone, data.email].filter(Boolean);
      if (contactBits.length > 0) {
        lines.push(contactBits.join(' | '));
      }
      lines.push(data.formattedDate);
      lines.push('');

      // Recipient Header
      lines.push(data.company);
      if (data.manager) {
        lines.push('Attn: ' + data.manager);
      }
      lines.push('');

      // Greeting
      if (data.manager) {
        lines.push('Dear ' + data.manager + ',');
      } else {
        lines.push('Dear Hiring Team,');
      }
      lines.push('');

      // Opening paragraph
      if (data.jobSource) {
        lines.push('I am writing to express my enthusiastic interest in the ' + data.jobTitle + ' role at ' + data.company + ', which I discovered on ' + data.jobSource + '.');
      } else {
        lines.push('I am writing to express my enthusiastic interest in the ' + data.jobTitle + ' role at ' + data.company + '.');
      }
      lines.push('');

      // Education & Skills paragraph
      if (data.skills) {
        lines.push('As a recent graduate, I have built a solid foundation and practical abilities in ' + data.skills + '. Throughout my academic projects and coursework, I focused on turning theoretical principles into practical solutions while building strong collaboration and time-management habits.');
      } else {
        lines.push('As a recent graduate, I bring strong foundational preparation, quick learning ability, and dedication. Throughout my academic coursework, I focused on turning theoretical principles into practical solutions while building strong collaboration habits.');
      }
      lines.push('');

      // Optional Achievement paragraph (omitted completely if empty)
      if (data.achievement) {
        lines.push('During my studies, ' + data.achievement + '. This experience taught me how to take ownership of complex tasks and deliver reliable results under tight deadlines.');
        lines.push('');
      }

      // Company admiration & Value add
      lines.push('I hold great respect for ' + data.company + '\'s standard of work and would be proud to contribute my energy, adaptability, and dedication to your organization. I welcome the opportunity to discuss how my skill set and enthusiasm align with your goals.');
      lines.push('');

      // Sign-off
      lines.push('Thank you for your time and consideration.');
      lines.push('');
      lines.push('Sincerely,');
      lines.push(data.fullName);

      return lines.join('\n');
    }

    // Template 2: Experienced Professional
    function buildExperiencedLetter(data) {
      const lines = [];

      // Header: Sender
      lines.push(data.fullName);
      const contactBits = [data.city, data.phone, data.email].filter(Boolean);
      if (contactBits.length > 0) {
        lines.push(contactBits.join(' | '));
      }
      lines.push(data.formattedDate);
      lines.push('');

      // Recipient Header
      lines.push(data.company);
      if (data.manager) {
        lines.push('Attn: ' + data.manager);
      }
      lines.push('');

      // Greeting
      if (data.manager) {
        lines.push('Dear ' + data.manager + ',');
      } else {
        lines.push('Dear Hiring Manager,');
      }
      lines.push('');

      // Opening paragraph
      if (data.jobSource) {
        lines.push('I am writing to submit my application for the ' + data.jobTitle + ' position at ' + data.company + ', as advertised on ' + data.jobSource + '.');
      } else {
        lines.push('I am writing to submit my application for the ' + data.jobTitle + ' position at ' + data.company + '.');
      }
      lines.push('');

      // Experience & Skills paragraph
      if (data.skills) {
        lines.push('With professional experience in this field, I offer proven capability in ' + data.skills + '. In my career to date, I have consistently focused on solving operational challenges, refining workflows, and delivering measurable outcomes that align with key organizational priorities.');
      } else {
        lines.push('With professional experience in this field, I bring dependable industry knowledge and problem-solving skills. In my career to date, I have consistently focused on solving operational challenges, refining workflows, and delivering measurable outcomes.');
      }
      lines.push('');

      // Optional Achievement paragraph (omitted completely if empty)
      if (data.achievement) {
        lines.push('In my previous professional role, ' + data.achievement + '. I take pride in maintaining high standards of quality, initiative, and teamwork across every project I undertake.');
        lines.push('');
      }

      // Company alignment & Closing
      lines.push(data.company + '\'s track record of excellence makes this role an ideal opportunity to contribute my knowledge and drive. I am confident that my practical background and proactive approach will bring immediate value to your current initiatives. I look forward to the possibility of discussing this role in detail.');
      lines.push('');

      // Sign-off
      lines.push('Thank you for your consideration.');
      lines.push('');
      lines.push('Best regards,');
      lines.push(data.fullName);

      return lines.join('\n');
    }

    // Template 3: Internship
    function buildInternshipLetter(data) {
      const lines = [];

      // Header: Sender
      lines.push(data.fullName);
      const contactBits = [data.city, data.phone, data.email].filter(Boolean);
      if (contactBits.length > 0) {
        lines.push(contactBits.join(' | '));
      }
      lines.push(data.formattedDate);
      lines.push('');

      // Recipient Header
      lines.push(data.company);
      if (data.manager) {
        lines.push('Attn: ' + data.manager);
      }
      lines.push('');

      // Greeting
      if (data.manager) {
        lines.push('Dear ' + data.manager + ',');
      } else {
        lines.push('Dear Recruitment Team,');
      }
      lines.push('');

      // Opening paragraph
      if (data.jobSource) {
        lines.push('I am writing to apply for the ' + data.jobTitle + ' internship at ' + data.company + ', listed on ' + data.jobSource + '.');
      } else {
        lines.push('I am writing to apply for the ' + data.jobTitle + ' internship at ' + data.company + '.');
      }
      lines.push('');

      // Motivation & Skills paragraph
      if (data.skills) {
        lines.push('I am passionate about building a rewarding career in this field and am eager to apply my growing abilities in a dynamic professional environment. My skillset includes ' + data.skills + ', and I look forward to gaining practical industry experience while contributing to your daily operations.');
      } else {
        lines.push('I am passionate about building a rewarding career in this field and am eager to apply my growing abilities in a dynamic professional environment. I look forward to gaining practical industry experience while providing dependable support to your daily operations.');
      }
      lines.push('');

      // Optional Achievement paragraph (omitted completely if empty)
      if (data.achievement) {
        lines.push('To prepare for this opportunity, ' + data.achievement + '. This experience reinforced my enthusiasm for learning, taking initiative, and collaborating effectively with peers.');
        lines.push('');
      }

      // Company admiration & Closing
      lines.push('An internship with ' + data.company + ' represents a remarkable opportunity to learn from experienced leaders while providing dependable support to your team. I would welcome the opportunity to speak with you regarding how I can contribute during this internship.');
      lines.push('');

      // Sign-off
      lines.push('Thank you for your time and guidance.');
      lines.push('');
      lines.push('Warm regards,');
      lines.push(data.fullName);

      return lines.join('\n');
    }

    // Build complete letter from current form details
    function generateFromForm() {
      const data = {
        fullName: (fullNameInput && fullNameInput.value.trim()) || 'Your Name',
        email: (emailInput && emailInput.value.trim()) || '',
        phone: (phoneInput && phoneInput.value.trim()) || '',
        city: (cityInput && cityInput.value.trim()) || '',
        formattedDate: formatLetterDate(dateInput ? dateInput.value : ''),
        company: (companyInput && companyInput.value.trim()) || 'Company Name',
        manager: (managerInput && managerInput.value.trim()) || '',
        jobTitle: (jobTitleInput && jobTitleInput.value.trim()) || 'Position Title',
        jobSource: (jobSourceInput && jobSourceInput.value.trim()) || '',
        skills: (skillsInput && skillsInput.value.trim()) || '',
        achievement: (achievementInput && achievementInput.value.trim()) || ''
      };

      if (activeTemplate === 'experienced') {
        return buildExperiencedLetter(data);
      } else if (activeTemplate === 'internship') {
        return buildInternshipLetter(data);
      } else {
        return buildFreshGraduateLetter(data);
      }
    }

    // Update stats & live preview sheet
    function updateLivePreviewAndStats() {
      const text = letterEditor.value;
      previewSheet.textContent = text;

      // Stats
      if (charCountEl) {
        charCountEl.textContent = text.length + ' chars';
      }
      if (wordCountEl) {
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        wordCountEl.textContent = words + ' words';
      }

      // Check non-Latin character alert
      if (pdfNoticeEl) {
        if (hasUnsupportedPdfChars(text)) {
          pdfNoticeEl.classList.add('is-visible');
        } else {
          pdfNoticeEl.classList.remove('is-visible');
        }
      }
    }

    // Handle template button changes
    templateBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        templateBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        activeTemplate = this.getAttribute('data-template') || 'fresh';

        // Sync fresh graduate switch
        if (freshGradSwitch) {
          freshGradSwitch.checked = (activeTemplate === 'fresh');
        }
      });
    });

    // Handle fresh graduate toggle switch
    if (freshGradSwitch) {
      freshGradSwitch.addEventListener('change', function () {
        if (this.checked) {
          activeTemplate = 'fresh';
        } else if (activeTemplate === 'fresh') {
          activeTemplate = 'experienced';
        }
        // Update template buttons
        templateBtns.forEach(b => {
          if (b.getAttribute('data-template') === activeTemplate) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });
      });
    }

    // User editing in the textarea directly -> update live preview immediately
    letterEditor.addEventListener('input', function () {
      updateLivePreviewAndStats();
    });

    // "Regenerate from my details" button: Rebuilds text box from form details
    if (regenerateBtn) {
      regenerateBtn.addEventListener('click', function () {
        letterEditor.value = generateFromForm();
        updateLivePreviewAndStats();

        // Brief visual confirmation
        const originalText = regenerateBtn.innerHTML;
        regenerateBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Letter Rebuilt!';
        regenerateBtn.style.backgroundColor = 'var(--success)';
        regenerateBtn.style.color = '#ffffff';
        setTimeout(() => {
          regenerateBtn.innerHTML = originalText;
          regenerateBtn.style.backgroundColor = '';
          regenerateBtn.style.color = '';
        }, 1500);
      });
    }

    // Copy Text button
    if (copyTextBtn) {
      copyTextBtn.addEventListener('click', function () {
        const textToCopy = letterEditor.value;
        if (!textToCopy) return;

        function showCopied() {
          const originalHtml = copyTextBtn.innerHTML;
          copyTextBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
          setTimeout(() => {
            copyTextBtn.innerHTML = originalHtml;
          }, 2000);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textToCopy).then(showCopied).catch(() => {
            // Fallback
            letterEditor.select();
            document.execCommand('copy');
            showCopied();
          });
        } else {
          letterEditor.select();
          document.execCommand('copy');
          showCopied();
        }
      });
    }

    // Download as .txt
    if (downloadTxtBtn) {
      downloadTxtBtn.addEventListener('click', function () {
        const text = letterEditor.value;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cover-letter.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    }

    // Download as PDF (jsPDF with selectable text, A4 format, readable margins, correct page breaks)
    if (downloadPdfBtn) {
      downloadPdfBtn.addEventListener('click', function () {
        const text = letterEditor.value;

        // Check if contains non-Latin characters (Urdu, Arabic, etc.)
        if (hasUnsupportedPdfChars(text)) {
          if (pdfNoticeEl) {
            pdfNoticeEl.classList.add('is-visible');
            pdfNoticeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          alert('This letter contains non-Latin characters (such as Urdu or special scripts) that standard PDF fonts cannot draw. Please use "Copy text" or "Download as .txt" instead.');
          return;
        }

        if (!window.jspdf || !window.jspdf.jsPDF) {
          alert('PDF generation library is still loading. Please try again in a few seconds.');
          return;
        }

        try {
          const { jsPDF } = window.jspdf;
          // Create A4 document in points (pt)
          const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
          });

          const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
          const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt

          const margin = 54; // 0.75 inch (54 pt)
          const printableWidth = pageWidth - (margin * 2); // 487.28 pt
          const bottomLimit = pageHeight - margin;

          const fontSize = 10.5;
          const lineHeight = 15;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(fontSize);
          doc.setTextColor(30, 41, 59);

          let currentY = margin;

          // Split content into paragraphs
          const paragraphs = text.split('\n');

          for (let i = 0; i < paragraphs.length; i++) {
            const para = paragraphs[i];

            if (para.trim() === '') {
              // Blank line -> add vertical spacing
              currentY += 8;
              if (currentY > bottomLimit) {
                doc.addPage();
                currentY = margin;
              }
              continue;
            }

            // Word wrap paragraph to printable width
            const lines = doc.splitTextToSize(para, printableWidth);

            for (let j = 0; j < lines.length; j++) {
              if (currentY + lineHeight > bottomLimit) {
                doc.addPage();
                currentY = margin;
              }
              doc.text(lines[j], margin, currentY);
              currentY += lineHeight;
            }
          }

          doc.save('cover-letter.pdf');
        } catch (err) {
          console.error('PDF generation error:', err);
          alert('An error occurred while creating the PDF. Please try "Download as .txt" or "Copy text".');
        }
      });
    }

    // Initial setup: populate initial letter and live preview
    letterEditor.value = generateFromForm();
    updateLivePreviewAndStats();
  }

  // Export to global scope
  window.initCoverLetterGenerator = initCoverLetterTool;
})();
