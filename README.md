# FileShrink (FileShrink.com)

A free, 100% client-side file compression, conversion, PDF utility, student academic calculator, and document generation suite. Built mobile-first for users in Pakistan, India, the US, UK, and worldwide to instantly compress, convert, and format files directly in the browser—with zero server uploads, zero logins, and zero watermarks.

> 📖 **Full Technical Documentation:** For an exhaustive guide to all 75+ tools, JavaScript engines, SEO schemas, AdSense setup, and architecture, see [**`WEBSITE.md`**](file:///Users/ameerkhan/Desktop/mytools-site/WEBSITE.md).

---

## ⚡ Key Highlights

- **100% Client-Side Privacy:** All file processing (canvas rendering, compression, PDF creation) happens locally on the user's device. No files are ever sent to an external server.
- **Ultra-Fast & Lightweight:** Pure HTML5, modern vanilla CSS3, and modular ES6+ JavaScript. No node build steps or bloated frameworks.
- **AdSense Compliant:** Pre-allocated, CLS-safe responsive ad slots strictly separated from functional tool interfaces.
- **Mobile-First Design:** Fully responsive and tested across 320px, 375px, 768px, and desktop displays with 48px+ touch targets.

---

## 📁 Project Architecture

```
mytools-site/
├── index.html                   # Master homepage with Quick Size Picker & search filter
├── 404.html                     # Custom 404 error page with tool directory
├── sitemap.xml                  # Complete XML sitemap (74 canonical URLs)
├── robots.txt                   # Crawler directives
├── ads.txt                      # Google AdSense publisher authorization
├── favicon.svg                  # Vector SVG favicon
├── vercel.json                  # Vercel routing, trailing slashes & redirects
├── WEBSITE.md                   # Comprehensive master documentation of the entire site
├── keyword-map.md               # Primary & secondary keyword SEO directory
├── common-rules-2.txt           # Codebase rules for page structure, SEO & math
│
├── assets/fonts/                # Embedded handwriting fonts (Kalam, Caveat, etc.)
├── css/                         # Shared CSS design system & specialized stylesheets
│   ├── style.css                # Global design system, typography & layouts
│   ├── calculators.css          # Calculator grids & dynamic badge cards
│   ├── business-doc.css         # Invoice & quotation print styles
│   ├── handwriting.css          # Notebook lined paper styling
│   ├── image-editor.css         # Crop, border, filter & blur controls
│   ├── pdf-advanced-tools.css   # Signature & watermark overlay controls
│   ├── pdf-grid-tool.css        # Multi-page PDF thumbnail grid
│   └── text-tools.css           # Text tools & copy badge styling
│
├── js/                          # Modular client-side processing engines
│   ├── main.js                  # Shared UI helpers, cookie banner, mobile nav
│   ├── image-tool.js            # Binary-search image compression engine
│   ├── image-editor.js          # Canvas crop, square, border, blur & B&W engine
│   ├── pdf-tool.js              # PDF compression engine (pdf.js + jsPDF)
│   ├── merge-pdf-tool.js        # PDF merger (pdf-lib)
│   ├── pdf-pages-tool.js        # PDF split & page extraction
│   ├── pdf-grid-tool.js         # PDF page thumbnail reorder, rotate & delete
│   ├── converter-tool.js        # Format converter (HEIC, WebP, PNG, JPG)
│   ├── signature-tool.js        # Signature resizer (140x60, 200x80)
│   ├── passport-tool.js         # Passport photo cropper & DPI sizer
│   ├── cnic-tool.js             # Front & back ID card on single A4 sheet
│   ├── calculators.js           # GPA, CGPA, Attendance, Loan & Property math
│   ├── business-doc.js          # Invoice & Quotation generator engine
│   ├── receipt-tool.js          # Rent & Payment receipt engine
│   ├── handwriting-tool.js      # Text to realistic handwriting canvas engine
│   ├── generator-tools.js       # Wi-Fi QR, Barcode & WhatsApp link generator
│   └── text-tools.js            # Case converter, fancy text & duplicate filter
│
└── [75 Tool Directories]/       # Individual static tool pages
    └── <tool-name>/index.html
```

---

## 🛠️ Overview of Tool Categories (75+ Tools)

1. **Image Compression:** 20KB, 30KB, 50KB, 100KB, 150KB, 200KB, 500KB, and custom KB target compression.
2. **Image Sizing & Social:** Signature resizer, passport photo cropper, CNIC 2-in-1 page, YouTube thumbnail, Instagram avatar, WhatsApp DP, square photo creator.
3. **Image Filters:** White borders, black and white converter, selective privacy blur.
4. **PDF Compression:** 100KB, 200KB, 500KB, 1MB, 2MB target sizes.
5. **PDF Editing & Utilities:** Merge, split, extract pages, remove pages, page numbers, rotate, reorder, crop, add signature, add watermark, PDF to text.
6. **Format Converters:** JPEG to PNG, PNG to JPG, HEIC to JPG, WebP to JPG, WebP to PNG, PDF to JPG, PDF to PNG, Images to PDF.
7. **QR & Barcode Generators:** Wi-Fi QR Code, Barcode Generator (CODE128, EAN-13, UPC), WhatsApp Click-to-Chat Link.
8. **Text & Writing:** Fancy text generator, case converter, remove duplicate lines, text to handwriting converter.
9. **Business & Receipts:** Invoice generator, quotation maker, rent receipt generator, payment receipt format, assignment cover page, cover letter generator.
10. **Student & Academic Calculators:** GPA calculator, CGPA calculator, CGPA to percentage, percentage calculator, attendance calculator, weighted grade, final grade, Pomodoro study timer.
11. **Financial & Everyday Calculators:** House construction cost calculator, installment calculator, plot price calculator, loan EMI calculator, average calculator, discount calculator, Hijri date converter.
12. **Core Pages:** Homepage, 404 error page, about, contact, privacy policy, terms of service.

---

## 🚀 Deployment Instructions

### 1. Vercel (Current Production)
1. Push your repository to GitHub.
2. Import the repository into the [Vercel Dashboard](https://vercel.com).
3. The included `vercel.json` automatically manages trailing slashes, clean URLs, and canonical redirects.

### 2. Cloudflare Pages
1. In Cloudflare Dashboard, go to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
2. Select your repository.
3. Build command: *(leave blank)* | Build output directory: `/`.
4. Deploy.

### 3. Netlify & GitHub Pages
- **Netlify:** Drag & drop the `mytools-site` folder or connect your Git repo with default static settings.
- **GitHub Pages:** Go to **Settings** > **Pages** > Source: `Deploy from a branch` > `main` > `/ (root)`.

---

## 💰 Google AdSense Setup

1. **Verification Script:** Paste into `<head>` across pages when your publisher ID is active:
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
   ```
2. **Ad Slots:** Pre-allocated `<div class="ad-slot">` containers exist above, below, and within content blocks.
3. **ads.txt:** Edit `/ads.txt` in the root folder with your verified Google publisher ID.
