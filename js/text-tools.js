/* ==========================================================================
   FileShrink - Shared Text Tools Engine (js/text-tools.js)
   Reused across /fancy-text-generator/, /case-converter/, /remove-duplicate-lines/
   ========================================================================== */

/**
 * FileShrink Text Tools Platform Limits & Technical Specifications
 * Rule 8: Platform limits and official standards must carry the required comment.
 */
const TEXT_TOOLS_CONFIG = {
  // Title case small words (verify against the Chicago Manual of Style / AP style current guidance)
  smallWords: [
    'a', 'an', 'and', 'as', 'at', 'but', 'by', 'en', 'for', 'if', 'in',
    'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'v', 'vs', 'via', 'with'
  ],
  // Processing safety limits (verify against the platform's current guidance)
  maxSafeCharacters: 1000000, // 1 MB text buffer limit for zero-lag UI responsiveness
  maxSafeLines: 100000,       // 100,000 lines for duplicate filter
  undoStackLimit: 25          // Case converter history depth
};

// ==========================================================================
// 1. FANCY TEXT GENERATOR ENGINE (Unicode Code-Point Tables & Exceptions)
// ==========================================================================

/**
 * Unicode Mathematical Alphanumeric Symbols & Letterlike Symbols lookup tables
 * Rule 8: Unicode standard 15.0 / ISO/IEC 10646 code point assignments
 * (verify against the platform's current guidance).
 */
const UNICODE_EXCEPTIONS = {
  script: {
    upper: {
      'B': '\u212C', // Script Capital B (U+212C, ℬ)
      'E': '\u2130', // Script Capital E (U+2130, ℰ)
      'F': '\u2131', // Script Capital F (U+2131, ℱ)
      'H': '\u210B', // Script Capital H (U+210B, ℋ)
      'I': '\u2110', // Script Capital I (U+2110, ℐ)
      'L': '\u2112', // Script Capital L (U+2112, ℒ)
      'M': '\u2133', // Script Capital M (U+2133, ℳ)
      'R': '\u211B'  // Script Capital R (U+211B, ℛ)
    },
    lower: {
      'e': '\u212F', // Script Small e (U+212F, ℯ)
      'g': '\u210A', // Script Small g (U+210A, ℊ)
      'o': '\u2134'  // Script Small o (U+2134, ℴ)
    }
  },
  fraktur: {
    upper: {
      'C': '\u212D', // Fraktur Capital C (U+212D, ℭ)
      'H': '\u210C', // Fraktur Capital H (U+210C, ℌ)
      'I': '\u2111', // Fraktur Capital I (U+2111, ℑ)
      'R': '\u211C', // Fraktur Capital R (U+211C, ℜ)
      'Z': '\u2128'  // Fraktur Capital Z (U+2128, ℨ)
    },
    lower: {}
  },
  doubleStruck: {
    upper: {
      'C': '\u2102', // Double-struck Capital C (U+2102, ℂ)
      'H': '\u210D', // Double-struck Capital H (U+210D, ℍ)
      'N': '\u2115', // Double-struck Capital N (U+2115, ℕ)
      'P': '\u2119', // Double-struck Capital P (U+2119, ℙ)
      'Q': '\u211A', // Double-struck Capital Q (U+211A, ℚ)
      'R': '\u211D', // Double-struck Capital R (U+211D, ℝ)
      'Z': '\u2124'  // Double-struck Capital Z (U+2124, ℤ)
    },
    lower: {}
  },
  italic: {
    upper: {},
    lower: {
      'h': '\u210E'  // Planck constant (U+210E, ℎ)
    }
  }
};

const SMALL_CAPS_MAP = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ғ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
  j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
  s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
  A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ғ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
  J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ǫ', R: 'ʀ',
  S: 'ꜱ', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ'
};

const UPSIDE_DOWN_MAP = {
  'a': 'ɐ', 'b': 'q', 'c': 'ɔ', 'd': 'p', 'e': 'ǝ', 'f': 'ɟ', 'g': 'ƃ', 'h': 'ɥ',
  'i': 'ᴉ', 'j': 'ɾ', 'k': 'ʞ', 'l': 'l', 'm': 'ɯ', 'n': 'u', 'o': 'o', 'p': 'd',
  'q': 'b', 'r': 'ɹ', 's': 's', 't': 'ʇ', 'u': 'n', 'v': 'ʌ', 'w': 'ʍ', 'x': 'x',
  'y': 'ʎ', 'z': 'z',
  'A': '∀', 'B': 'ᗺ', 'C': 'Ɔ', 'D': 'ᗡ', 'E': 'Ǝ', 'F': 'Ⅎ', 'G': '⅁', 'H': 'H',
  'I': 'I', 'J': 'ſ', 'K': 'ʞ', 'L': '˥', 'M': 'W', 'N': 'N', 'O': 'O', 'P': 'Ԁ',
  'Q': 'Ò', 'R': 'ᴚ', 'S': 'S', 'T': '⊥', 'U': '∩', 'V': 'Λ', 'W': 'M', 'X': 'X',
  'Y': '⅄', 'Z': 'Z',
  '0': '0', '1': 'Ɩ', '2': 'Շ', '3': 'Ɛ', '4': 'ㄣ', '5': 'ϛ', '6': '9', '7': 'L',
  '8': '8', '9': '6',
  '?': '¿', '!': '¡', '.': '˙', ',': "'", "'": ',', '"': '„',
  '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{',
  '<': '>', '>': '<', '&': '⅋', '_': '‾'
};

/**
 * Generic alphanumeric Unicode mapper using block offsets and explicit exception dictionaries.
 */
function mapUnicodeRange(text, upperStart, lowerStart, digitStart, exceptions = {}) {
  const upperEx = exceptions.upper || {};
  const lowerEx = exceptions.lower || {};

  return Array.from(text).map(char => {
    const code = char.codePointAt(0);

    // Uppercase A-Z (65-90)
    if (code >= 65 && code <= 90) {
      if (upperEx[char]) return upperEx[char];
      if (upperStart !== null) return String.fromCodePoint(upperStart + (code - 65));
      return char;
    }

    // Lowercase a-z (97-122)
    if (code >= 97 && code <= 122) {
      if (lowerEx[char]) return lowerEx[char];
      if (lowerStart !== null) return String.fromCodePoint(lowerStart + (code - 97));
      return char;
    }

    // Digits 0-9 (48-57)
    if (code >= 48 && code <= 57) {
      if (digitStart !== null) return String.fromCodePoint(digitStart + (code - 48));
      return char;
    }

    // Pass punctuation, emojis, spaces, accented chars through unchanged
    return char;
  }).join('');
}

/**
 * 19 Explicit Fancy Text Transformations
 */
const FANCY_STYLES = [
  {
    id: 'bold',
    name: 'Bold',
    transform: (text) => mapUnicodeRange(text, 0x1D400, 0x1D41A, 0x1D7CE)
  },
  {
    id: 'italic',
    name: 'Italic',
    transform: (text) => mapUnicodeRange(text, 0x1D434, 0x1D44E, null, UNICODE_EXCEPTIONS.italic)
  },
  {
    id: 'bold-italic',
    name: 'Bold Italic',
    transform: (text) => mapUnicodeRange(text, 0x1D468, 0x1D482, null)
  },
  {
    id: 'script',
    name: 'Script',
    transform: (text) => mapUnicodeRange(text, 0x1D49C, 0x1D4B6, null, UNICODE_EXCEPTIONS.script)
  },
  {
    id: 'bold-script',
    name: 'Bold Script',
    transform: (text) => mapUnicodeRange(text, 0x1D4D0, 0x1D4EA, null)
  },
  {
    id: 'fraktur',
    name: 'Fraktur',
    transform: (text) => mapUnicodeRange(text, 0x1D504, 0x1D51E, null, UNICODE_EXCEPTIONS.fraktur)
  },
  {
    id: 'bold-fraktur',
    name: 'Bold Fraktur',
    transform: (text) => mapUnicodeRange(text, 0x1D56C, 0x1D586, null)
  },
  {
    id: 'double-struck',
    name: 'Double-struck',
    transform: (text) => mapUnicodeRange(text, 0x1D538, 0x1D552, 0x1D7D8, UNICODE_EXCEPTIONS.doubleStruck)
  },
  {
    id: 'monospace',
    name: 'Monospace',
    transform: (text) => mapUnicodeRange(text, 0x1D670, 0x1D68A, 0x1D7F6)
  },
  {
    id: 'sans-serif',
    name: 'Sans-serif',
    transform: (text) => mapUnicodeRange(text, 0x1D5A0, 0x1D5BA, 0x1D7E2)
  },
  {
    id: 'sans-bold',
    name: 'Sans Bold',
    transform: (text) => mapUnicodeRange(text, 0x1D5D4, 0x1D5EE, 0x1D7EC)
  },
  {
    id: 'sans-italic',
    name: 'Sans Italic',
    transform: (text) => mapUnicodeRange(text, 0x1D608, 0x1D622, null)
  },
  {
    id: 'circled',
    name: 'Circled',
    transform: (text) => {
      return Array.from(text).map(char => {
        const code = char.codePointAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(0x24B6 + (code - 65));
        if (code >= 97 && code <= 122) return String.fromCodePoint(0x24D0 + (code - 97));
        if (code === 48) return '\u24EA'; // ⓪
        if (code >= 49 && code <= 57) return String.fromCodePoint(0x2460 + (code - 49)); // ①-⑨
        return char;
      }).join('');
    }
  },
  {
    id: 'squared',
    name: 'Squared',
    transform: (text) => {
      return Array.from(text).map(char => {
        const code = char.codePointAt(0);
        if (code >= 65 && code <= 90) return String.fromCodePoint(0x1F130 + (code - 65));
        if (code >= 97 && code <= 122) return String.fromCodePoint(0x1F130 + (code - 97)); // Map to uppercase squared
        return char;
      }).join('');
    }
  },
  {
    id: 'fullwidth',
    name: 'Fullwidth',
    transform: (text) => {
      return Array.from(text).map(char => {
        const code = char.codePointAt(0);
        if (code === 32) return '\u3000'; // Fullwidth ideographic space
        if (code >= 33 && code <= 126) return String.fromCodePoint(0xFF01 + (code - 33));
        return char;
      }).join('');
    }
  },
  {
    id: 'small-caps',
    name: 'Small caps',
    transform: (text) => {
      return Array.from(text).map(char => SMALL_CAPS_MAP[char] || char).join('');
    }
  },
  {
    id: 'upside-down',
    name: 'Upside down',
    transform: (text) => {
      // Reverse string array and map flipped letters
      return Array.from(text).reverse().map(char => UPSIDE_DOWN_MAP[char] || char).join('');
    }
  },
  {
    id: 'strikethrough',
    name: 'Strikethrough',
    transform: (text) => {
      return Array.from(text).map(char => {
        if (char === '\n' || char === '\r') return char;
        return char + '\u0336'; // Combining long stroke overlay
      }).join('');
    }
  },
  {
    id: 'underline',
    name: 'Underline',
    transform: (text) => {
      return Array.from(text).map(char => {
        if (char === '\n' || char === '\r') return char;
        return char + '\u0332'; // Combining low line
      }).join('');
    }
  }
];

// ==========================================================================
// 2. CASE CONVERTER ENGINE (Unicode-Aware & Apostrophe Preservation)
// ==========================================================================

const CaseConverter = {
  // 1. UPPER CASE
  upper: (str) => str.toLocaleUpperCase(),

  // 2. lower case
  lower: (str) => str.toLocaleLowerCase(),

  // 3. Sentence case: capitalize first letter of each sentence; rest lowercase
  sentence: (str) => {
    const lower = str.toLocaleLowerCase();
    return lower.replace(/(^\s*|[.!?\n]\s+)([\p{L}\p{N}])/gu, (match, prefix, char) => {
      return prefix + char.toLocaleUpperCase();
    });
  },

  // 4. Title Case: small words stay lowercase unless first or last or after major punctuation
  title: (str) => {
    return str.split(/(\r?\n)/).map(segment => {
      if (segment === '\n' || segment === '\r\n') return segment;
      // Match words including apostrophes inside words (e.g. don't, O'Reilly)
      const wordRegex = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
      const words = [];
      let match;
      while ((match = wordRegex.exec(segment)) !== null) {
        words.push({ word: match[0], index: match.index });
      }
      if (words.length === 0) return segment;

      let result = '';
      let lastIdx = 0;
      words.forEach((wObj, i) => {
        const gap = segment.slice(lastIdx, wObj.index);
        result += gap;
        const lower = wObj.word.toLocaleLowerCase();
        const isFirst = (i === 0);
        const isLast = (i === words.length - 1);
        const isAfterPunct = /[:.!?]\s*$/.test(gap);

        if (!isFirst && !isLast && !isAfterPunct && TEXT_TOOLS_CONFIG.smallWords.includes(lower)) {
          result += lower;
        } else {
          // Capitalize first character, keep remaining characters lowercase
          result += lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
        }
        lastIdx = wObj.index + wObj.word.length;
      });
      result += segment.slice(lastIdx);
      return result;
    }).join('');
  },

  // 5. Capitalize Each Word: first letter of each word uppercase, rest lowercase
  // "don't" becomes "Don't", never "Don'T"
  capitalize: (str) => {
    return str.replace(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu, (word) => {
      const lower = word.toLocaleLowerCase();
      return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
    });
  },

  // 6. aLtErNaTiNg: toggle case per letter
  alternating: (str) => {
    let upper = false;
    let res = '';
    for (const ch of str) {
      if (/\p{L}/u.test(ch)) {
        res += upper ? ch.toLocaleUpperCase() : ch.toLocaleLowerCase();
        upper = !upper;
      } else {
        res += ch;
      }
    }
    return res;
  },

  // 7. iNVERSE: invert current case of each letter
  inverse: (str) => {
    let res = '';
    for (const ch of str) {
      if (ch === ch.toLocaleUpperCase() && ch !== ch.toLocaleLowerCase()) {
        res += ch.toLocaleLowerCase();
      } else if (ch === ch.toLocaleLowerCase() && ch !== ch.toLocaleUpperCase()) {
        res += ch.toLocaleUpperCase();
      } else {
        res += ch;
      }
    }
    return res;
  },

  // Helper to split text into identifier tokens for camel/pascal/snake/kebab
  _extractTokens: (str) => {
    // Break on spaces, punctuation, dashes, underscores, and camelCase transitions
    const cleaned = str.replace(/([a-z\d])([A-Z])/gu, '$1 $2');
    const matches = cleaned.match(/[\p{L}\p{N}]+/gu);
    return matches ? matches.map(w => w.toLocaleLowerCase()) : [];
  },

  // 8. camelCase: "hello world-foo_bar" -> "helloWorldFooBar"
  camel: function(str) {
    const tokens = this._extractTokens(str);
    if (tokens.length === 0) return '';
    return tokens[0] + tokens.slice(1).map(t => t.charAt(0).toLocaleUpperCase() + t.slice(1)).join('');
  },

  // 9. PascalCase: "hello world-foo_bar" -> "HelloWorldFooBar"
  pascal: function(str) {
    const tokens = this._extractTokens(str);
    return tokens.map(t => t.charAt(0).toLocaleUpperCase() + t.slice(1)).join('');
  },

  // 10. snake_case: "Hello World" -> "hello_world"
  snake: function(str) {
    const tokens = this._extractTokens(str);
    return tokens.join('_');
  },

  // 11. kebab-case: "Hello World" -> "hello-world"
  kebab: function(str) {
    const tokens = this._extractTokens(str);
    return tokens.join('-');
  },

  // 12. CONSTANT_CASE: "hello world" -> "HELLO_WORLD"
  constant: function(str) {
    const tokens = this._extractTokens(str);
    return tokens.map(t => t.toLocaleUpperCase()).join('_');
  }
};

// ==========================================================================
// 3. REMOVE DUPLICATE LINES ENGINE (High Performance Set Deduplication)
// ==========================================================================

const DuplicateRemover = {
  /**
   * Deduplicate lines with exact control over case sensitivity, whitespace trimming,
   * empty line filtering, occurrence order, and sorting.
   */
  process: function(inputText, options = {}) {
    const {
      caseSensitive = true,
      trimSpaces = true,
      removeEmpty = true,
      keep = 'first', // 'first' or 'last'
      sort = 'none'   // 'none', 'asc', 'desc'
    } = options;

    if (!inputText) {
      return {
        linesBefore: 0,
        linesAfter: 0,
        duplicatesRemoved: 0,
        resultText: ''
      };
    }

    const rawLines = inputText.split(/\r?\n/);
    const linesBefore = rawLines.length;

    // Pre-process items with line text and key
    const processed = [];
    for (let i = 0; i < linesBefore; i++) {
      let line = rawLines[i];
      if (trimSpaces) {
        line = line.trim();
      }

      if (removeEmpty && line.length === 0) {
        continue; // Skip empty lines entirely
      }

      const key = caseSensitive ? line : line.toLocaleLowerCase();
      processed.push({ original: line, key: key, index: i });
    }

    const seenKeys = new Set();
    let keptItems = [];

    if (keep === 'last') {
      // Iterate from the bottom up to preserve the last occurrence
      for (let i = processed.length - 1; i >= 0; i--) {
        const item = processed[i];
        if (!seenKeys.has(item.key)) {
          seenKeys.add(item.key);
          keptItems.push(item);
        }
      }
      // Reverse back so original order of last occurrences is preserved
      keptItems.reverse();
    } else {
      // Default: keep first occurrence
      for (let i = 0; i < processed.length; i++) {
        const item = processed[i];
        if (!seenKeys.has(item.key)) {
          seenKeys.add(item.key);
          keptItems.push(item);
        }
      }
    }

    let finalLines = keptItems.map(item => item.original);

    // Optional alphabetical sorting
    if (sort === 'asc') {
      finalLines.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: caseSensitive ? 'variant' : 'base' }));
    } else if (sort === 'desc') {
      finalLines.sort((a, b) => b.localeCompare(a, undefined, { sensitivity: caseSensitive ? 'variant' : 'base' }));
    }

    const linesAfter = finalLines.length;
    const duplicatesRemoved = linesBefore - linesAfter;

    return {
      linesBefore,
      linesAfter,
      duplicatesRemoved,
      resultText: finalLines.join('\n')
    };
  }
};

// ==========================================================================
// 4. SHARED UI HELPERS (Stats, Copy Feedback, File Download)
// ==========================================================================

const TextToolUtils = {
  /**
   * Fast calculation of character, word, and line count
   */
  getTextStats: (str) => {
    if (!str) return { chars: 0, words: 0, lines: 0 };
    const chars = Array.from(str).length;
    const lines = str.length === 0 ? 0 : str.split(/\r?\n/).length;
    const words = (str.trim().match(/\S+/gu) || []).length;
    return { chars, words, lines };
  },

  /**
   * Copy string to clipboard with visual feedback on button element
   */
  copyText: async (text, buttonElement) => {
    if (!text && text !== '') return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      if (buttonElement) {
        const originalText = buttonElement.innerHTML;
        buttonElement.classList.add('copied');
        buttonElement.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Copied!</span>
        `;
        setTimeout(() => {
          buttonElement.classList.remove('copied');
          buttonElement.innerHTML = originalText;
        }, 1800);
      }
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  },

  /**
   * Download text content as a .txt file
   */
  downloadTxt: (content, filename = 'converted-text.txt') => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
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
  }
};

// Export to window for browser and Node.js testing environments
if (typeof window !== 'undefined') {
  window.TEXT_TOOLS_CONFIG = TEXT_TOOLS_CONFIG;
  window.FANCY_STYLES = FANCY_STYLES;
  window.CaseConverter = CaseConverter;
  window.DuplicateRemover = DuplicateRemover;
  window.TextToolUtils = TextToolUtils;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TEXT_TOOLS_CONFIG,
    FANCY_STYLES,
    CaseConverter,
    DuplicateRemover,
    TextToolUtils
  };
}
