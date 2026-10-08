# FileShrink (FileShrink.com)

A free, 100% client-side file compression suite built for mobile users in Pakistan, India, and worldwide to shrink images and PDFs to exact target file sizes (20KB, 50KB, 100KB, 200KB, 500KB, 1MB) for job portals, university admissions, and government applications.

---

## 📁 Project Structure

```
mytools-site/
├── index.html                   # Homepage with Quick Size Picker
├── 404.html                     # Custom 404 error page
├── sitemap.xml                  # XML sitemap with all 14 URLs
├── robots.txt                   # Search crawler directives
├── ads.txt                      # AdSense verification placeholder
├── favicon.svg                  # Vector SVG favicon
├── css/
│   └── style.css                # Shared mobile-first CSS design system
├── js/
│   ├── main.js                  # Shared UI helpers, cookie banner
│   ├── image-tool.js            # Image compression engine (binary search)
│   ├── signature-tool.js        # Signature pixel resizer & compressor
│   └── pdf-tool.js              # PDF page rasterizer & re-encoder (pdf.js + jsPDF)
├── compress-image-to-20kb/      # Image tool (20 KB target)
│   └── index.html
├── compress-image-to-50kb/      # Image tool (50 KB target)
│   └── index.html
├── compress-image-to-100kb/     # Image tool (100 KB target)
│   └── index.html
├── compress-image-to-200kb/     # Image tool (200 KB target)
│   └── index.html
├── signature-resizer/           # Signature resizer tool (140x60, 200x80, custom)
│   └── index.html
├── compress-pdf-to-100kb/       # PDF tool (100 KB target)
│   └── index.html
├── compress-pdf-to-200kb/       # PDF tool (200 KB target)
│   └── index.html
├── compress-pdf-to-500kb/       # PDF tool (500 KB target)
│   └── index.html
├── compress-pdf-to-1mb/         # PDF tool (1 MB target)
│   └── index.html
├── about/                       # About Us page
│   └── index.html
├── contact/                     # Contact page
│   └── index.html
├── privacy-policy/              # Complete Privacy Policy
│   └── index.html
└── terms/                       # Terms of Service
    └── index.html
```

---

## 🚀 Deployment Instructions

### 1. Cloudflare Pages (Recommended)
1. Push your repository to GitHub or GitLab.
2. In the Cloudflare Dashboard, go to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Select your repository.
4. Set **Build command** to blank (none required) and **Build output directory** to `/`.
5. Click **Save and Deploy**.

### 2. Netlify
1. Log in to Netlify and drag & drop the `mytools-site` folder into the Netlify dashboard, or connect your Git repository.
2. Leave the build settings empty and deploy directly.

### 3. GitHub Pages
1. Go to your GitHub repository > **Settings** > **Pages**.
2. Under **Source**, choose `Deploy from a branch` > branch `main` > folder `/ (root)`.
3. Save to publish.

---

## 💰 Google AdSense Setup

### 1. Adding the AdSense Verification Script
Once you receive your AdSense Publisher Code, paste the script inside the `<head>` tag of every HTML page:
```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
```

### 2. Inserting Ad Units
On each page, replace the placeholder comments inside the `<div class="ad-slot">` containers:
```html
<!-- Inside any <div class="ad-slot"> -->
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
     data-ad-slot="YYYYYYYYYY"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>
     (adsbygoogle = window.adsbygoogle || []).push({});
</script>
```

### 3. Setting up `ads.txt`
Edit `/ads.txt` in the root folder and replace with your verified line:
```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```
