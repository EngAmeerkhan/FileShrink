# FileShrink (FileShrink.com) — Complete Website Documentation

> **Live Deployment:** [https://fileshrink.vercel.app/](https://fileshrink.vercel.app/)  
> **Source Repository:** `mytools-site`  
> **Architecture:** 100% Client-Side Static Web Application (Zero Server Processing)  
> **Technology Stack:** HTML5, Modern Vanilla CSS3, Vanilla ES6+ JavaScript, Cloudflare CDN Libraries  
> **Primary Monetization:** Google AdSense (Compliant with strict layout and CLS guidelines)  
> **Target Audience:** Students, job applicants, professionals, and general web users in Pakistan, India, the US, UK, and worldwide.

---

## 📑 Table of Contents

1. [Executive Summary & Core Philosophy](#1-executive-summary--core-philosophy)
2. [Technical Architecture & Engine Modules](#2-technical-architecture--engine-modules)
3. [Full Project Directory Structure](#3-full-project-directory-structure)
4. [Master Directory of All Tools & Pages (75+ Pages)](#4-master-directory-of-all-tools--pages-75-pages)
   - [Image Compression & Target Size Tools](#image-compression--target-size-tools)
   - [Image Resizing & Social Media Dimensions](#image-resizing--social-media-dimensions)
   - [Image Editing & Visual Filters](#image-editing--visual-filters)
   - [PDF Compression Tools](#pdf-compression-tools)
   - [PDF Manipulation & Editing Tools](#pdf-manipulation--editing-tools)
   - [Format & File Converters](#format--file-converters)
   - [QR Code & Barcode Generators](#qr-code--barcode-generators)
   - [Text & Writing Utilities](#text--writing-utilities)
   - [Business, Receipt & Document Makers](#business-receipt--document-makers)
   - [Student & Academic Calculators](#student--academic-calculators)
   - [Financial, Property & Everyday Calculators](#financial-property--everyday-calculators)
   - [Core & Legal Information Pages](#core--legal-information-pages)
5. [Design System & UI/UX Standards](#5-design-system--uiux-standards)
6. [SEO, Structured Data & Metadata Strategy](#6-seo-structured-data--metadata-strategy)
7. [Privacy & Security Model](#7-privacy--security-model)
8. [Google AdSense Integration & Layout Safety](#8-google-adsense-integration--layout-safety)
9. [Deployment & Server Configuration](#9-deployment--server-configuration)
10. [Development, Testing & Extension Guidelines](#10-development-testing--extension-guidelines)

---

## 1. Executive Summary & Core Philosophy

**FileShrink** is a high-performance, mobile-first suite of free browser-based productivity tools. It solves everyday digital hurdles faced by students, job applicants, and government portal users—such as strict file-size limits on portals (e.g., "photo must be under 50KB", "PDF must be under 200KB", or "signature must be 140x60px").

### Key Principles

1. **100% Client-Side Execution:**  
   Every file operation—compression, conversion, PDF generation, image editing, and text processing—runs entirely in the visitor's web browser using native Web APIs (Canvas, FileReader, Blob, Web Workers) and client-side JavaScript. **No files or personal data are ever uploaded to any external server.**
2. **Speed & Zero Bloat:**  
   No heavy JavaScript frameworks (no React, Next.js, or Vue), zero bundlers or build steps. Fast first contentful paint (FCP) and near-perfect Lighthouse scores even on budget 3G/4G smartphones.
3. **No Login, No Subscription, No Watermarks:**  
   All tools are free to use without registration, email capture, or forced watermarks on exported files.
4. **Simple, Predictable UX:**  
   Tools with file uploads use a clear 3-step pipeline (`1. Upload -> 2. Adjust/Size -> 3. Download`). Tools without uploads (calculators, generators) use a real-time 2-step pipeline (`1. Enter Data -> 2. Instant Result/Copy/Print`).
5. **AdSense Compliance & UX Separation:**  
   Ad slots are structurally isolated with reserved minimum heights to prevent Cumulative Layout Shift (CLS) and ensure ad elements never touch or obstruct interactive tool controls.

---

## 2. Technical Architecture & Engine Modules

The project follows a modular static architecture where individual pages configure and instantiate shared client-side engines.

### External Libraries (Pinned Cloudflare CDN)

| Library | CDN Source | Primary Usage |
|---|---|---|
| **pdf.js** (`pdf.min.js`, `pdf.worker.min.js`) | cdnjs.cloudflare.com | Rendering PDF pages to `<canvas>` for previewing, splitting, cropping, and re-encoding. |
| **jsPDF** (`jspdf.umd.min.js`) | cdnjs.cloudflare.com | Re-assembling compressed canvas images into lightweight PDF documents and exporting invoices, cover pages, and receipts. |
| **pdf-lib** (`pdf-lib.min.js`) | cdnjs.cloudflare.com | High-fidelity PDF manipulations: merging, page rotation, page extraction, page reordering, and metadata preservation. |
| **JsBarcode** (`JsBarcode.all.min.js`) | cdnjs.cloudflare.com | Generating vector SVG and canvas barcodes (CODE128, EAN-13, UPC, CODE39). |
| **QRCode.js** / Canvas QR | cdnjs.cloudflare.com | Generating Wi-Fi and direct WhatsApp QR codes. |

### Shared CSS Design System (`/css/`)

- [`css/style.css`](file:///Users/ameerkhan/Desktop/mytools-site/css/style.css): Global variables (`--primary`, `--primary-hover`, `--bg-main`, `--text-main`, etc.), responsive layout, header/footer, mobile navigation accordion, cookie banner, tool boxes, file dropzones, trust badges, and ad container slots.
- [`css/calculators.css`](file:///Users/ameerkhan/Desktop/mytools-site/css/calculators.css): Grid layouts, input cards, dynamic calculation badges, formula explanations, and metric displays for all math, student, and property calculators.
- [`css/business-doc.css`](file:///Users/ameerkhan/Desktop/mytools-site/css/business-doc.css): Live invoice, quotation, and receipt visual cards with `@media print` stylesheets for paper and PDF printing.
- [`css/handwriting.css`](file:///Users/ameerkhan/Desktop/mytools-site/css/handwriting.css): Ruled notebook paper styling, margins, ink coloring, and paper backgrounds.
- [`css/image-editor.css`](file:///Users/ameerkhan/Desktop/mytools-site/css/image-editor.css): Controls for aspect-ratio cropping, border padding, blur filters, and black & white rendering.
- [`css/pdf-advanced-tools.css`](file:///Users/ameerkhan/Desktop/mytools-site/css/pdf-advanced-tools.css): Watermark overlays, stamp rotation sliders, and signature placement canvases.
- [`css/pdf-grid-tool.css`](file:///Users/ameerkhan/Desktop/mytools-site/css/pdf-grid-tool.css): Multi-page PDF thumbnail grid with drag/drop reordering, page deletion badges, and rotation buttons.
- [`css/text-tools.css`](file:///Users/ameerkhan/Desktop/mytools-site/css/text-tools.css): Text converter controls, copy-to-clipboard badges, character/word counters, and unicode style grids.

### Core JavaScript Engines (`/js/`)

- [`js/main.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/main.js): Global navigation menu, mobile toggle/accordion, active link highlighting, search filter on homepage, cookie consent banner, and smooth scroll behaviors.
- [`js/image-tool.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/image-tool.js): Binary-search image compression engine. Iterates JPEG/WebP canvas compression qualities to match exact target file sizes (e.g. 20KB, 50KB, 100KB) while maximizing visual sharpness.
- [`js/image-editor.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/image-editor.js): Canvas-based cropping, border application, grayscale filters, and privacy area blur.
- [`js/pdf-tool.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/pdf-tool.js): PDF compressor. Renders PDF pages via PDF.js to canvas and re-encodes them into a compact jsPDF document.
- [`js/converter-tool.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/converter-tool.js): High-speed cross-format converter for HEIC, WebP, PNG, and JPG.
- [`js/merge-pdf-tool.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/merge-pdf-tool.js): Multi-file PDF merger using `pdf-lib`.
- [`js/pdf-pages-tool.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/pdf-pages-tool.js): Page splitter and page extractor.
- [`js/pdf-grid-tool.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/pdf-grid-tool.js): Visual thumbnail manager for reordering, rotating, and deleting PDF pages.
- [`js/pdf-crop-tool.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/pdf-crop-tool.js): Canvas crop bounding box tool for trimming PDF page margins.
- [`js/pdf-signature-tool.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/pdf-signature-tool.js): Signature drawing pad and PDF overlay placement engine.
- [`js/pdf-watermark-tool.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/pdf-watermark-tool.js): Text and image watermark generator for PDF pages.
- [`js/signature-tool.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/signature-tool.js): Signature resizer for official portal requirements (140x60, 200x80, etc.).
- [`js/passport-tool.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/passport-tool.js): Official passport photo cropper with DPI calculations (2x2 inch, 35x45 mm, 600x600 px).
- [`js/cnic-tool.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/cnic-tool.js): Two-card layout generator placing front and back ID card scans onto a single A4 page.
- [`js/calculators.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/calculators.js): Formulas for GPA, CGPA, Attendance, Loan/EMI, Construction, Plot Price, Discounts, and Hijri dates.
- [`js/business-doc.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/business-doc.js): Interactive invoice and quotation builder with dynamic line items, subtotals, taxes, and print styling.
- [`js/receipt-tool.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/receipt-tool.js): Rent and cash payment receipt generator.
- [`js/handwriting-tool.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/handwriting-tool.js): Renders digital text as handwriting onto ruled canvas notebook pages using bundled TTF fonts.
- [`js/generator-tools.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/generator-tools.js): Wi-Fi QR, Barcode, and WhatsApp click-to-chat link generation.
- [`js/text-tools.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/text-tools.js): Unicode text styling, duplicate line removal, and case conversion.
- [`js/pomodoro.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/pomodoro.js): Accurate interval study timer with web audio notifications.

---

## 3. Full Project Directory Structure

```text
mytools-site/
├── index.html                            # Master Homepage with Search & Size Picker
├── 404.html                              # Custom 404 Not Found Page
├── sitemap.xml                           # Master XML Sitemap (all 74 URLs)
├── robots.txt                            # Search Engine Directives
├── ads.txt                               # Google AdSense Publisher Verification
├── favicon.svg                           # SVG Site Icon
├── vercel.json                           # Vercel Deployment & URL Redirect Config
├── keyword-map.md                        # Primary & Secondary SEO Keyword Registry
├── common-rules.txt                      # Baseline Architectural Rules
├── common-rules-2.txt                    # Strict Page Quality & SEO Rules
├── WEBSITE.md                            # Comprehensive Website Master Documentation
├── README.md                             # Repository Overview & Quickstart Guide
│
├── assets/
│   └── fonts/                            # Embedded Fonts for Handwriting Generator
│       ├── ArchitectsDaughter-Regular.ttf
│       ├── Caveat-Regular.ttf
│       ├── IndieFlower-Regular.ttf
│       ├── Kalam-Regular.ttf
│       ├── PatrickHand-Regular.ttf
│       └── ShadowsIntoLight-Regular.ttf
│
├── css/
│   ├── style.css                         # Shared CSS Framework & Tokens
│   ├── calculators.css                   # Calculator Grids & Results Cards
│   ├── business-doc.css                  # Invoice & Quotation Print Styles
│   ├── handwriting.css                   # Lined Paper & Ink Preview Styles
│   ├── image-editor.css                  # Image Crop, Border & Filter Styles
│   ├── pdf-advanced-tools.css            # Watermark & Signature Stamp Styles
│   ├── pdf-grid-tool.css                 # Thumbnail Reordering & Grid Styles
│   └── text-tools.css                    # Text Utilities & Copy Badges
│
├── js/
│   ├── main.js                           # Global UI, Header Nav & Cookies
│   ├── image-tool.js                     # Binary-Search KB Image Compressor
│   ├── image-editor.js                   # Crop, Square, Border, Blur, B&W
│   ├── converter-tool.js                 # Image Format Converter (HEIC/WebP/PNG/JPG)
│   ├── passport-tool.js                  # Passport Photo Cropper & DPI Sizer
│   ├── cnic-tool.js                      # CNIC Front/Back on A4 Sheet
│   ├── pdf-tool.js                       # PDF File Size Compressor
│   ├── pdf-to-image-tool.js              # PDF to JPG / PNG Converter
│   ├── images-to-pdf-tool.js             # Multiple Images to PDF Compiler
│   ├── merge-pdf-tool.js                 # PDF Merger
│   ├── pdf-pages-tool.js                 # PDF Split & Page Extractor
│   ├── pdf-number-tool.js                # PDF Page Numbering Engine
│   ├── pdf-grid-tool.js                  # Reorder, Rotate & Remove Page Engine
│   ├── pdf-crop-tool.js                  # Visual PDF Crop Box
│   ├── pdf-watermark-tool.js             # PDF Text Watermark Engine
│   ├── pdf-signature-tool.js             # PDF Interactive Signature Placement
│   ├── signature-tool.js                 # Signature Resizer (140x60, 200x80)
│   ├── calculators.js                    # Math, Student & Financial Formulas
│   ├── pomodoro.js                       # Pomodoro Timer Engine
│   ├── handwriting-tool.js               # Text to Handwritten Canvas Engine
│   ├── cover-page.js                     # Assignment Title Page Builder
│   ├── cover-letter.js                   # Job Cover Letter Generator
│   ├── receipt-tool.js                   # Rent & Payment Receipt Formatter
│   ├── business-doc.js                   # Invoice & Quotation Formatter
│   ├── generator-tools.js                # QR Code & Barcode Generator
│   └── text-tools.js                     # Fancy Text, Case & Duplicate Filter
│
├── [75 Page Directories]                 # Individual SEO Tool & Legal Pages
│   └── <tool-folder>/
│       └── index.html
```

---

## 4. Master Directory of All Tools & Pages (75+ Pages)

### Image Compression & Target Size Tools
*Engine: `js/image-tool.js` | Privacy Flow: 3-Step ("Upload -> Adjust -> Download")*

| URL Slug | Primary Keyword | Target Size | Ideal For |
|---|---|---|---|
| [`/compress-image-to-20kb/`](file:///Users/ameerkhan/Desktop/mytools-site/compress-image-to-20kb/index.html) | `compress image to 20kb` | ≤ 20 KB | Strict government job forms (SSC, UPSC, FPSC, PPSC) |
| [`/compress-image-to-30kb/`](file:///Users/ameerkhan/Desktop/mytools-site/compress-image-to-30kb/index.html) | `compress image to 30kb` | ≤ 30 KB | State portal signature & photo upload requirements |
| [`/compress-image-to-50kb/`](file:///Users/ameerkhan/Desktop/mytools-site/compress-image-to-50kb/index.html) | `compress image to 50kb` | ≤ 50 KB | College & university admission forms |
| [`/compress-image-to-100kb/`](file:///Users/ameerkhan/Desktop/mytools-site/compress-image-to-100kb/index.html) | `compress image to 100kb` | ≤ 100 KB | Standard web applications, passports & portals |
| [`/compress-image-to-150kb/`](file:///Users/ameerkhan/Desktop/mytools-site/compress-image-to-150kb/index.html) | `compress image to 150kb` | ≤ 150 KB | Visa & consular service forms |
| [`/compress-image-to-200kb/`](file:///Users/ameerkhan/Desktop/mytools-site/compress-image-to-200kb/index.html) | `compress image to 200kb` | ≤ 200 KB | High-quality identity uploads & resume photos |
| [`/compress-image-to-500kb/`](file:///Users/ameerkhan/Desktop/mytools-site/compress-image-to-500kb/index.html) | `compress image to 500kb` | ≤ 500 KB | High-resolution photography & web uploads |
| [`/reduce-image-size-in-kb/`](file:///Users/ameerkhan/Desktop/mytools-site/reduce-image-size-in-kb/index.html) | `reduce image size in kb` | Custom KB | Custom target KB entry (e.g., exactly 75 KB, 350 KB) |

---

### Image Resizing & Social Media Dimensions
*Engine: `js/image-editor.js`, `js/signature-tool.js`, `js/passport-tool.js`, `js/cnic-tool.js`*

| URL Slug | Primary Keyword | Default Preset / Output | Key Features |
|---|---|---|---|
| [`/signature-resizer/`](file:///Users/ameerkhan/Desktop/mytools-site/signature-resizer/index.html) | `signature resizer` | 140x60px, 200x80px | Ink contrast enhancer, custom pixel dimensions |
| [`/passport-photo-size-in-pixels/`](file:///Users/ameerkhan/Desktop/mytools-site/passport-photo-size-in-pixels/index.html) | `passport photo size in pixels` | 2x2 in (600x600px), 35x45mm | 300 DPI support, head guide overlay |
| [`/cnic-front-and-back-in-one-page/`](file:///Users/ameerkhan/Desktop/mytools-site/cnic-front-and-back-in-one-page/index.html) | `cnic front and back in one page` | Single A4 Sheet / PDF | Combines 2 ID card photos onto 1 printable page |
| [`/youtube-thumbnail-size/`](file:///Users/ameerkhan/Desktop/mytools-site/youtube-thumbnail-size/index.html) | `youtube thumbnail size` | 1280x720px (16:9) | Ensures file is under 2MB limit with 16:9 crop |
| [`/instagram-profile-picture-size/`](file:///Users/ameerkhan/Desktop/mytools-site/instagram-profile-picture-size/index.html) | `instagram profile picture size` | 320x320px (1:1) | Circular avatar preview and square export |
| [`/whatsapp-dp-size/`](file:///Users/ameerkhan/Desktop/mytools-site/whatsapp-dp-size/index.html) | `whatsapp dp size` | 500x500px / 1080x1080px | No-crop border padding or centered crop |
| [`/make-photo-square/`](file:///Users/ameerkhan/Desktop/mytools-site/make-photo-square/index.html) | `make photo square` | 1:1 Aspect Ratio | Adds blurred or solid side bars without cropping |

---

### Image Editing & Visual Filters
*Engine: `js/image-editor.js`*

| URL Slug | Primary Keyword | Output Format | Description |
|---|---|---|---|
| [`/add-white-border-to-photo/`](file:///Users/ameerkhan/Desktop/mytools-site/add-white-border-to-photo/index.html) | `add white border to photo` | JPG / PNG | Polaroid and gallery-style border padding |
| [`/black-and-white-photo-converter/`](file:///Users/ameerkhan/Desktop/mytools-site/black-and-white-photo-converter/index.html) | `black and white photo converter` | JPG / PNG | Converts color pictures to clean monochrome / grayscale |
| [`/blur-image-online/`](file:///Users/ameerkhan/Desktop/mytools-site/blur-image-online/index.html) | `blur image online` | JPG / PNG | Selective rectangle blur for faces, license plates, sensitive data |

---

### PDF Compression Tools
*Engine: `js/pdf-tool.js` (pdf.js + jsPDF)*

| URL Slug | Primary Keyword | Target Size | Common Use Case |
|---|---|---|---|
| [`/compress-pdf-to-100kb/`](file:///Users/ameerkhan/Desktop/mytools-site/compress-pdf-to-100kb/index.html) | `compress pdf to 100kb` | ≤ 100 KB | Single-page forms, academic marksheets |
| [`/compress-pdf-to-200kb/`](file:///Users/ameerkhan/Desktop/mytools-site/compress-pdf-to-200kb/index.html) | `compress pdf to 200kb` | ≤ 200 KB | Government portal application attachments |
| [`/compress-pdf-to-500kb/`](file:///Users/ameerkhan/Desktop/mytools-site/compress-pdf-to-500kb/index.html) | `compress pdf to 500kb` | ≤ 500 KB | Multi-page resumes, bank statements, certificates |
| [`/compress-pdf-to-1mb/`](file:///Users/ameerkhan/Desktop/mytools-site/compress-pdf-to-1mb/index.html) | `compress pdf to 1mb` | ≤ 1 MB | University thesis drafts, scanned packets |
| [`/compress-pdf-to-2mb/`](file:///Users/ameerkhan/Desktop/mytools-site/compress-pdf-to-2mb/index.html) | `compress pdf to 2mb` | ≤ 2 MB | Standard email attachment limit compliance |

---

### PDF Manipulation & Editing Tools
*Engines: `js/merge-pdf-tool.js`, `js/pdf-pages-tool.js`, `js/pdf-grid-tool.js`, `js/pdf-number-tool.js`, `js/pdf-crop-tool.js`, `js/pdf-signature-tool.js`, `js/pdf-watermark-tool.js`*

| URL Slug | Primary Keyword | Action Performed |
|---|---|---|
| [`/merge-pdf-files/`](file:///Users/ameerkhan/Desktop/mytools-site/merge-pdf-files/index.html) | `merge pdf files` | Combines multiple separate PDF documents into a single document |
| [`/split-pdf/`](file:///Users/ameerkhan/Desktop/mytools-site/split-pdf/index.html) | `split pdf` | Splits a multi-page PDF into single-page files or custom page chunks |
| [`/extract-pages-from-pdf/`](file:///Users/ameerkhan/Desktop/mytools-site/extract-pages-from-pdf/index.html) | `extract pages from pdf` | Extracts specific selected pages (e.g. `1, 3-5`) into a new PDF |
| [`/remove-pages-from-pdf/`](file:///Users/ameerkhan/Desktop/mytools-site/remove-pages-from-pdf/index.html) | `remove pages from pdf` | Deletes selected pages or blank sheets from an existing PDF |
| [`/add-page-numbers-to-pdf/`](file:///Users/ameerkhan/Desktop/mytools-site/add-page-numbers-to-pdf/index.html) | `add page numbers to pdf` | Stamps customizable page numbers (top, bottom, center, offset) |
| [`/pdf-to-text/`](file:///Users/ameerkhan/Desktop/mytools-site/pdf-to-text/index.html) | `pdf to text` | Extracts all text layers from PDF into plain selectable/copyable text |
| [`/rotate-pdf/`](file:///Users/ameerkhan/Desktop/mytools-site/rotate-pdf/index.html) | `rotate pdf` | Rotates all or individual upside-down/sideways PDF pages by 90°/180° |
| [`/reorder-pdf-pages/`](file:///Users/ameerkhan/Desktop/mytools-site/reorder-pdf-pages/index.html) | `reorder pdf pages` | Visual drag-and-drop thumbnail organizer to resequence PDF pages |
| [`/crop-pdf/`](file:///Users/ameerkhan/Desktop/mytools-site/crop-pdf/index.html) | `crop pdf` | Visual margin trimmer to eliminate whitespace or scan borders |
| [`/add-signature-to-pdf/`](file:///Users/ameerkhan/Desktop/mytools-site/add-signature-to-pdf/index.html) | `add signature to pdf` | Draw or upload a signature and place it interactively onto PDF |
| [`/add-watermark-to-pdf/`](file:///Users/ameerkhan/Desktop/mytools-site/add-watermark-to-pdf/index.html) | `add watermark to pdf` | Applies diagonal text watermarks ("CONFIDENTIAL", "DRAFT", custom) |

---

### Format & File Converters
*Engines: `js/converter-tool.js`, `js/pdf-to-image-tool.js`, `js/images-to-pdf-tool.js`*

| URL Slug | Primary Keyword | Conversion Path |
|---|---|---|
| [`/jpeg-to-png/`](file:///Users/ameerkhan/Desktop/mytools-site/jpeg-to-png/index.html) | `jpeg to png` | JPEG/JPG → Lossless PNG |
| [`/png-to-jpg-converter/`](file:///Users/ameerkhan/Desktop/mytools-site/png-to-jpg-converter/index.html) | `png to jpg converter` | PNG → Optimized JPG with custom background fill |
| [`/heic-to-jpg/`](file:///Users/ameerkhan/Desktop/mytools-site/heic-to-jpg/index.html) | `heic to jpg` | Apple iPhone HEIC/HEIF → Standard JPG |
| [`/webp-to-jpg/`](file:///Users/ameerkhan/Desktop/mytools-site/webp-to-jpg/index.html) | `webp to jpg` | Modern WebP → Universal JPG |
| [`/webp-to-png/`](file:///Users/ameerkhan/Desktop/mytools-site/webp-to-png/index.html) | `webp to png` | WebP → Transparent PNG |
| [`/pdf-to-jpg-converter/`](file:///Users/ameerkhan/Desktop/mytools-site/pdf-to-jpg-converter/index.html) | `pdf to jpg converter` | PDF Pages → ZIP / Individual JPG Images |
| [`/pdf-to-png/`](file:///Users/ameerkhan/Desktop/mytools-site/pdf-to-png/index.html) | `pdf to png` | PDF Pages → Crisp High-Res PNG Images |
| [`/images-to-pdf/`](file:///Users/ameerkhan/Desktop/mytools-site/images-to-pdf/index.html) | `images to pdf` | Multiple JPG/PNG/WebP files → Single Multi-page PDF |
| [`/jpg-to-png/`](file:///Users/ameerkhan/Desktop/mytools-site/jpg-to-png/index.html) | *(Alias Redirect)* | Canonical redirect to `/jpeg-to-png/` |

---

### QR Code & Barcode Generators
*Engine: `js/generator-tools.js` (JsBarcode + QRCode.js)*

| URL Slug | Primary Keyword | Output Formats | Purpose |
|---|---|---|---|
| [`/wifi-qr-code-generator/`](file:///Users/ameerkhan/Desktop/mytools-site/wifi-qr-code-generator/index.html) | `wifi qr code generator` | PNG, SVG, Print Card | Generates scannable Wi-Fi login codes (WPA/WPA2/WEP/Hidden) |
| [`/barcode-generator/`](file:///Users/ameerkhan/Desktop/mytools-site/barcode-generator/index.html) | `barcode generator` | PNG, SVG | Standard barcodes (CODE128, EAN-13, UPC, CODE39) |
| [`/whatsapp-link-generator/`](file:///Users/ameerkhan/Desktop/mytools-site/whatsapp-link-generator/index.html) | `whatsapp link generator` | Click URL, QR Code | Generates `wa.me/` direct chat links with custom messages |

---

### Text & Writing Utilities
*Engines: `js/text-tools.js`, `js/handwriting-tool.js`*

| URL Slug | Primary Keyword | Key Features |
|---|---|---|
| [`/fancy-text-generator/`](file:///Users/ameerkhan/Desktop/mytools-site/fancy-text-generator/index.html) | `fancy text generator` | 50+ Unicode font styles (bold, cursive, gothic, bubbles, double-struck) |
| [`/case-converter/`](file:///Users/ameerkhan/Desktop/mytools-site/case-converter/index.html) | `case converter` | UPPERCASE, lowercase, Title Case, Sentence case, camelCase, snake_case |
| [`/remove-duplicate-lines/`](file:///Users/ameerkhan/Desktop/mytools-site/remove-duplicate-lines/index.html) | `remove duplicate lines` | Dedupes lists, sorts alphabetically, removes whitespace and blank lines |
| [`/text-to-handwriting-converter/`](file:///Users/ameerkhan/Desktop/mytools-site/text-to-handwriting-converter/index.html) | `text to handwriting converter` | Converts digital text to realistic handwritten ruled notebook pages |

---

### Business, Receipt & Document Makers
*Engines: `js/business-doc.js`, `js/receipt-tool.js`, `js/cover-page.js`, `js/cover-letter.js`*

| URL Slug | Primary Keyword | Output | Features |
|---|---|---|---|
| [`/invoice-generator/`](file:///Users/ameerkhan/Desktop/mytools-site/invoice-generator/index.html) | `invoice generator` | PDF, Print | Itemized billing, tax rates, discounts, custom currencies |
| [`/quotation-maker/`](file:///Users/ameerkhan/Desktop/mytools-site/quotation-maker/index.html) | `quotation maker` | PDF, Print | Formal price estimates, validity dates, terms & conditions |
| [`/rent-receipt-generator/`](file:///Users/ameerkhan/Desktop/mytools-site/rent-receipt-generator/index.html) | `rent receipt generator` | PDF, Print | Monthly/annual house & office rent slips with revenue stamp area |
| [`/payment-receipt-format/`](file:///Users/ameerkhan/Desktop/mytools-site/payment-receipt-format/index.html) | `payment receipt format` | PDF, Print | Cash, check, and digital payment receipts |
| [`/assignment-cover-page/`](file:///Users/ameerkhan/Desktop/mytools-site/assignment-cover-page/index.html) | `assignment cover page` | PDF | Academic assignment title page for universities & colleges |
| [`/cover-letter-generator/`](file:///Users/ameerkhan/Desktop/mytools-site/cover-letter-generator/index.html) | `cover letter generator` | PDF, Copy Text | Formats professional job application cover letters |

---

### Student & Academic Calculators
*Engines: `js/calculators.js`, `js/pomodoro.js`*

| URL Slug | Primary Keyword | Formula / Functionality |
|---|---|---|
| [`/gpa-calculator/`](file:///Users/ameerkhan/Desktop/mytools-site/gpa-calculator/index.html) | `gpa calculator` | Standard 4.0 semester GPA calculation based on credits and letter grades |
| [`/cgpa-calculator/`](file:///Users/ameerkhan/Desktop/mytools-site/cgpa-calculator/index.html) | `cgpa calculator` | Multi-semester cumulative GPA tracker |
| [`/cgpa-to-percentage/`](file:///Users/ameerkhan/Desktop/mytools-site/cgpa-to-percentage/index.html) | `cgpa to percentage` | University conversion formulas (e.g. `(CGPA * 9.5)` and 4.0 scaling) |
| [`/percentage-calculator/`](file:///Users/ameerkhan/Desktop/mytools-site/percentage-calculator/index.html) | `percentage calculator` | Three-way percentage solver (X% of Y, X is what % of Y, % difference) |
| [`/attendance-calculator/`](file:///Users/ameerkhan/Desktop/mytools-site/attendance-calculator/index.html) | `attendance calculator` | Calculates classes needed to reach target 75% or 80% criteria |
| [`/weighted-grade-calculator/`](file:///Users/ameerkhan/Desktop/mytools-site/weighted-grade-calculator/index.html) | `weighted grade calculator` | Weighted scores for homework, midterms, labs, and finals |
| [`/final-grade-calculator/`](file:///Users/ameerkhan/Desktop/mytools-site/final-grade-calculator/index.html) | `final grade calculator` | Exact exam score needed on final exam to achieve targeted letter grade |
| [`/pomodoro-timer/`](file:///Users/ameerkhan/Desktop/mytools-site/pomodoro-timer/index.html) | `pomodoro timer` | 25/5 study interval timer with sound alerts and session count |

---

### Financial, Property & Everyday Calculators
*Engine: `js/calculators.js`*

| URL Slug | Primary Keyword | Formula / Functionality |
|---|---|---|
| [`/house-construction-cost-calculator/`](file:///Users/ameerkhan/Desktop/mytools-site/house-construction-cost-calculator/index.html) | `house construction cost calculator` | Estimates grey structure & turnkey costs per sq ft / Marla / Kanal |
| [`/installment-calculator/`](file:///Users/ameerkhan/Desktop/mytools-site/installment-calculator/index.html) | `installment calculator` | Computes monthly installment, markup, and total payout for car/home loans |
| [`/plot-price-calculator/`](file:///Users/ameerkhan/Desktop/mytools-site/plot-price-calculator/index.html) | `plot price calculator` | Real estate land valuation: Marla, Kanal, Sq Feet, Sq Yards conversions |
| [`/loan-calculator/`](file:///Users/ameerkhan/Desktop/mytools-site/loan-calculator/index.html) | `loan calculator` | Standard loan EMI formula with amortization breakdown |
| [`/average-calculator/`](file:///Users/ameerkhan/Desktop/mytools-site/average-calculator/index.html) | `average calculator` | Calculates Mean, Median, Mode, Range, and Sum from number series |
| [`/discount-calculator/`](file:///Users/ameerkhan/Desktop/mytools-site/discount-calculator/index.html) | `discount calculator` | Calculates final price, money saved, and sales tax |
| [`/hijri-date-converter/`](file:///Users/ameerkhan/Desktop/mytools-site/hijri-date-converter/index.html) | `hijri date converter` | Converts Gregorian calendar dates to Islamic Hijri dates |

---

### Core & Legal Information Pages

| URL Slug | Title | Purpose & Content |
|---|---|---|
| [`/index.html`](file:///Users/ameerkhan/Desktop/mytools-site/index.html) | Free Online Tools for Image, PDF & Students \| FileShrink | Homepage: Quick Size Picker, categorized tool directory, search bar, FAQs |
| [`/404.html`](file:///Users/ameerkhan/Desktop/mytools-site/404.html) | 404 Page Not Found \| FileShrink | Helpful error recovery page with search bar and direct links to popular tools |
| [`/about/`](file:///Users/ameerkhan/Desktop/mytools-site/about/index.html) | About Us - Free File Compression \| FileShrink | Mission statement, technical background, zero-server privacy commitment |
| [`/contact/`](file:///Users/ameerkhan/Desktop/mytools-site/contact/index.html) | Contact Us - FileShrink | Feedback form, developer contact email, and support inquiry channel |
| [`/privacy-policy/`](file:///Users/ameerkhan/Desktop/mytools-site/privacy-policy/index.html) | Privacy Policy - FileShrink | Strict GDPR/CCPA and browser privacy statement (no user files ever stored) |
| [`/terms/`](file:///Users/ameerkhan/Desktop/mytools-site/terms/index.html) | Terms of Service - FileShrink | Free usage terms, disclaimer of warranties, and user guidelines |

---

## 5. Design System & UI/UX Standards

The design system is implemented in [`css/style.css`](file:///Users/ameerkhan/Desktop/mytools-site/css/style.css) using CSS Custom Properties. It provides clean contrast, modern card elevations, and consistent touch responsiveness.

### Color Tokens

```css
:root {
  --primary: #2563eb;          /* Trustworthy vivid royal blue */
  --primary-hover: #1d4ed8;    /* Deep cobalt for hover/active states */
  --primary-light: #eff6ff;    /* Soft tint for badge and card backgrounds */
  --accent: #10b981;           /* Crisp emerald green for success badges */
  --text-main: #1f2937;        /* High-contrast neutral dark for body typography */
  --text-light: #4b5563;       /* Balanced slate for subtitles and hints */
  --text-muted: #9ca3af;       /* Soft gray for borders and placeholders */
  --bg-main: #f8fafc;          /* Gentle off-white background */
  --bg-surface: #ffffff;       /* Pure white card backgrounds */
  --border-color: #e5e7eb;     /* Subtle divider lines */
  --border-focus: #3b82f6;     /* Accessible focus outline */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
}
```

### UX Principles
- **Touch Targets:** All interactive buttons and inputs have minimum dimensions of `48px × 48px` to ensure effortless usability on mobile touchscreens.
- **Micro-Animations:** Subtle transitions (`0.15s ease`) on button hover, card lift, and dragover events.
- **Clarity Over Clutter:** Functional tool cards are positioned immediately beneath the main page `<h1>` heading. Explanatory guides, how-to instructions, and FAQs are located beneath the tool so visitors can start working immediately without scrolling past lengthy text.

---

## 6. SEO, Structured Data & Metadata Strategy

All pages strictly follow the SEO guidelines codified in [`common-rules-2.txt`](file:///Users/ameerkhan/Desktop/mytools-site/common-rules-2.txt) and registered in [`keyword-map.md`](file:///Users/ameerkhan/Desktop/mytools-site/keyword-map.md):

1. **Title Tag Rule:**  
   Formatted as `Primary Keyword - Free Online | FileShrink` (Strictly under 60 characters).
2. **Meta Description Rule:**  
   140 to 155 characters. Always contains the primary keyword, `"free"`, and `"no signup"`. Includes `"no watermark"` for tools generating downloadable files.
3. **Heading Hierarchy:**  
   Single `<h1>` containing the primary keyword, accompanied by a concise subtitle (under 15 words).
4. **Structured Data (JSON-LD):**  
   Every tool page contains three integrated JSON-LD schemas:
   - `WebApplication`: Declares the browser app, operational status, and zero-cost pricing (`offers: { price: "0" }`).
   - `BreadcrumbList`: Establishes hierarchical crawl paths back to the homepage.
   - `FAQPage`: Encodes the 3 unique question-and-answer pairs displayed on the page for Google rich snippets.
5. **Open Graph & Twitter Cards:**  
   Complete `og:title`, `og:description`, `og:url`, `og:type="website"`, and `twitter:card="summary"` tags on every page.
6. **Canonical Consistency:**  
   Every page specifies its absolute canonical link targeting `https://fileshrink.vercel.app/<slug>/`.

---

## 7. Privacy & Security Model

User trust is FileShrink's core advantage.

- **Zero Network Egress for User Files:**  
  When an image or PDF is loaded, it is read into browser memory via `FileReader.readAsArrayBuffer()` or `URL.createObjectURL()`. Processing occurs on an in-memory HTML5 Canvas or Web Worker. No `fetch()`, `XMLHttpRequest`, or `WebSocket` transmits file payloads.
- **Clear Privacy Guarantee Lines:**  
  - File processing tools display: *"Your file never leaves your phone or computer."*  
  - Calculators & generators display: *"Nothing is uploaded or saved. Everything works on your device."*
- **LocalStorage Usage:**  
  User documents and images are **never** stored in browser `localStorage`. LocalStorage is only optionally utilized for non-sensitive UI settings (e.g., cookie consent acceptance) inside safe `try/catch` wrappers that degrade gracefully if storage is disabled or in incognito mode.

---

## 8. Google AdSense Integration & Layout Safety

FileShrink is engineered for high AdSense revenue while preventing policy violations and Cumulative Layout Shift (CLS):

- **Dedicated Ad Containers:**  
  Ad units are wrapped in isolated `.ad-slot` container elements with preset minimum heights (`min-height: 90px;` or `min-height: 250px;`) to reserve space prior to ad rendering.
- **No Overlap with Interactive Tool Elements:**  
  Ads are placed strictly outside the tool boundaries:
  - Unit 1: Above the tool container
  - Unit 2: Below the tool result section
  - Unit 3: Within the bottom textual content/FAQ section
- **Publisher Verification (`ads.txt`):**  
  Root [`ads.txt`](file:///Users/ameerkhan/Desktop/mytools-site/ads.txt) is configured for Google AdSense crawler authentication:
  ```text
  google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
  ```

---

## 9. Deployment & Server Configuration

Because FileShrink is 100% static, it can be hosted on any modern static hosting provider.

### Vercel (`vercel.json`)
The active production deployment is configured with [`vercel.json`](file:///Users/ameerkhan/Desktop/mytools-site/vercel.json):
```json
{
  "cleanUrls": true,
  "trailingSlash": true,
  "redirects": [
    {
      "source": "/jpg-to-png",
      "destination": "/jpeg-to-png/",
      "permanent": true
    },
    {
      "source": "/jpg-to-png/:path*",
      "destination": "/jpeg-to-png/",
      "permanent": true
    }
  ]
}
```

### Alternative Hosting Platforms
- **Cloudflare Pages:** Connect Git repository -> Framework preset: `None` -> Build command: *(leave blank)* -> Output directory: `/`.
- **Netlify:** Drag-and-drop the root folder or connect Git repository with default static settings.
- **GitHub Pages:** Repository Settings -> Pages -> Source: `Deploy from a branch` (`main` / `/ (root)`).

---

## 10. Development, Testing & Extension Guidelines

### Adding a New Tool Page

When adding a new tool to FileShrink, adhere to the 10-step protocol defined in [`common-rules-2.txt`](file:///Users/ameerkhan/Desktop/mytools-site/common-rules-2.txt):

1. **Create Directory:** Add a new hyphenated folder (e.g., `new-tool-name/index.html`).
2. **Assign Keywords:** Assign one primary keyword and 2–4 secondary keywords; document in [`keyword-map.md`](file:///Users/ameerkhan/Desktop/mytools-site/keyword-map.md).
3. **Follow Content Rules:**
   - Single `<h1>` with primary keyword.
   - Concise subtitle under 15 words.
   - Tool container right below header.
   - Privacy guarantee line.
   - 3-step or 2-step instructional guide.
   - Exactly 3 unique FAQs with FAQPage JSON-LD schema.
   - 4 related tool links in "More tools" section.
4. **Formula & Number Safety (Calculators):**
   - Use `inputmode="decimal"` or `numeric`.
   - Never display `NaN`, `Infinity`, or raw unrounded floating points.
   - Keep constants in a labeled config block at the top of the script.
5. **Update Navigation:**
   - Add new tool card to appropriate category in [`index.html`](file:///Users/ameerkhan/Desktop/mytools-site/index.html).
   - Add entry to the mobile/desktop navigation menu in [`js/main.js`](file:///Users/ameerkhan/Desktop/mytools-site/js/main.js) or header markup.
   - Register URL in [`sitemap.xml`](file:///Users/ameerkhan/Desktop/mytools-site/sitemap.xml).
6. **Responsive Testing Checklist:**
   - Test at **320px** (iPhone SE / small Android).
   - Test at **375px** (Standard iPhone).
   - Test at **768px** (Tablet / iPad).
   - Verify zero console errors and 100% offline/client-side execution.

---
*Documentation maintained by FileShrink Engineering Team. Last updated: October 2026.*
