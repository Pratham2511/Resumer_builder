# ResumeForge — Professional Resume Builder

A modern, full-featured resume builder with **real-time preview**, **PDF/DOCX import with format preservation**, **multiple profiles**, and **PDF export**. Built with Next.js 16, React 19, TypeScript, and Tailwind CSS 4.

![ResumeForge](https://img.shields.io/badge/Next.js-16-black?style=flat-square) ![React](https://img.shields.io/badge/React-19-blue?style=flat-square) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square)

## ✨ Features

- **WYSIWYG Editor** — Edit resume content with live A4/Letter preview
- **Format-Preserving PDF Import** — Import PDFs and preserve fonts, sizes, colors, margins, spacing, alignment, dividers, and page size
- **Format-Preserving DOCX Import** — Import Word documents with full style extraction (fonts, colors, margins, bold/italic, alignment)
- **JSON Import/Export** — Share and backup profiles as JSON
- **PDF Export** — Generate high-quality PDFs via html2pdf.js
- **Multiple Profiles** — Create, switch, rename, duplicate, and delete resume profiles
- **Fine-Grained Format Controls** — Adjust every aspect: margins, font sizes, line height, letter spacing, colors, header alignment, footer, and more
- **13 Section Types** — Experience, Education, Skills, Projects, Certifications, Languages, Achievements, Publications, Volunteer, Interests, References, Custom
- **Photo Support** — Upload and display profile photos
- **Auto-Detection** — Smart section detection, personal info extraction, and format analysis from imported documents

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| State | Zustand 5 with localStorage persistence |
| PDF Parsing | pdfjs-dist 3.11 |
| DOCX Parsing | jszip + mammoth (fallback) |
| PDF Export | html2pdf.js |
| UI Components | 47+ shadcn/ui components (Radix primitives) |
| Icons | Lucide React |

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ or **Bun** runtime
- **npm** or **bun** package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/Pratham2511/Resumer_builder.git
cd Resumer_builder

# Install dependencies
npm install
# or with bun
bun install
```

### Development

```bash
# Start the development server
npm run dev
# or
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm run start
# or
bun run start
```

The production build uses Next.js standalone output for optimized deployment.

## 📖 How to Use

### Creating a Resume

1. On first launch, a default "My Resume" profile is created
2. Use the **Content** tab to fill in personal information and professional summary
3. Use the **Sections** tab to add and edit resume sections (Experience, Education, Skills, etc.)
4. Use the **Format** tab to customize layout, fonts, colors, and spacing
5. Click **Download PDF** to export your resume

### Importing a Resume

1. Click the **Upload** icon (⬆) in the profile manager bar
2. Choose **PDF**, **DOCX**, or **JSON** tab
3. Upload your file — the app will:
   - Extract all text content and detect sections
   - Preserve the original formatting (fonts, sizes, colors, margins, spacing)
   - Create a new profile with the imported data
4. Fine-tune the imported resume using the editor

### Managing Profiles

- **Create** — Click the + button to create a new profile
- **Switch** — Use the dropdown to switch between profiles
- **Rename** — Edit the profile name inline
- **Duplicate** — Click the copy icon to clone a profile
- **Export** — Click the download icon to save as JSON
- **Delete** — Click the trash icon (at least one profile must exist)

### Format Controls

| Control | Description |
|---------|-------------|
| Page Size | A4 (210×297mm) or Letter (216×279mm) |
| Margins | Top, right, bottom, left in points |
| Font Sizes | Name, section, entry title, body, meta — in points |
| Line Height | Body text line height ratio (1.0–2.0) |
| Section/Entry Gap | Spacing between sections and entries |
| Divider | Weight of section divider lines |
| Colors | Primary, secondary, divider — hex color pickers |
| Header | Alignment (center/left), show subtitle toggle |
| Footer | Show name, page numbers, custom text |

## 📁 Project Structure

```
src/
├── app/
│   ├── globals.css          # Tailwind CSS + theme variables
│   ├── layout.tsx           # Root layout (Geist fonts, Toaster)
│   ├── page.tsx             # Main page (editor + preview split layout)
│   └── api/
│       ├── route.ts         # Health check endpoint
│       ├── import-pdf/      # PDF import with format extraction
│       └── import-docx/     # DOCX import with style extraction
├── components/
│   ├── editor/
│   │   ├── editor-panel.tsx     # Personal info, entry, section editors
│   │   ├── format-controls.tsx  # Format/layout control panel
│   │   ├── import-modal.tsx     # PDF/DOCX/JSON import dialog
│   │   └── profile-manager.tsx  # Profile CRUD + import/export
│   ├── preview/
│   │   └── resume-preview.tsx   # A4/Letter resume renderer
│   └── ui/                  # 47 shadcn/ui components
├── hooks/
│   ├── use-mobile.ts        # Mobile breakpoint hook
│   └── use-toast.ts         # Toast notification hook
└── lib/
    ├── utils.ts             # cn() utility (clsx + tailwind-merge)
    ├── resume-types.ts      # All TypeScript types + defaults
    ├── resume-store.ts      # Zustand store with localStorage persist
    └── parsers/
        └── resume-parser.ts # Smart text parser + format detection
```

## 🔧 Format Preservation Details

### PDF Import

The PDF parser uses `pdfjs-dist` to extract:
- **Font family** — weighted by character count, normalized to CSS-safe names (30+ font mappings)
- **Font sizes** — name (largest in header), section (bold+ALL CAPS), body (most common), meta, entry title
- **Font styles** — bold (weight ≥ 600), italic, underline detection
- **Colors** — per-text-item from operator list (RGB + CMYK color spaces), weighted by importance
- **Margins** — histogram-based detection for all 4 sides with symmetry adjustments
- **Page size** — A4 vs Letter from page dimensions
- **Header alignment** — center vs left from name and meta item positions
- **Line height** — from consecutive same-font-size Y gaps
- **Section/entry spacing** — from Y gaps between content blocks
- **Divider weight** — from horizontal line detection in operator list
- **Footer** — page numbers, name, custom text from bottom 15% of page
- **Photo** — detection from embedded images in operator list

### DOCX Import

The DOCX parser uses regex-based XML parsing of `document.xml`, `styles.xml`, and `numbering.xml`:
- Font family, size, color, bold, italic, underline per run
- Paragraph alignment, spacing, and indentation
- Default and named styles with inheritance (`basedOn`)
- Page margins and size from `document.xml`
- Bullet/list style detection from `numbering.xml`
- Falls back to mammoth for simple text extraction if XML parsing fails

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
