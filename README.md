# ResumeForge — Professional Resume Builder

A modern, full-featured resume builder with real-time preview, PDF/DOCX import, format preservation, and PDF export. Built with Next.js 16, TypeScript, Tailwind CSS, and Zustand.

## Features

- **Live A4/Letter Preview** — See your resume update in real-time as you edit
- **PDF & DOCX Import** — Upload existing resumes and preserve the original formatting (fonts, margins, colors, layout)
- **Format Preservation** — Imported resumes maintain their carbon copy design: font family, font sizes, margins, colors, header/footer alignment, line height, and more
- **Smart Section Detection** — Automatically detects Experience, Education, Skills, Projects, Certifications, and more
- **Photo Auto-Detection** — Detects if the source resume has a photo placeholder and enables the photo option automatically
- **Multiple Profiles** — Create and switch between multiple resume versions
- **PDF Export** — Download your resume as a high-quality PDF
- **JSON Export/Import** — Share and backup resume data as JSON
- **Format Controls** — Fine-tune margins, fonts, colors, spacing, and layout
- **Zoom Control** — Adjust preview zoom level for comfortable editing
- **Drag & Drop Reorder** — Reorder sections and entries with drag and drop

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| State | Zustand (with localStorage persistence) |
| PDF Parsing | pdfjs-dist |
| DOCX Parsing | jszip + mammoth (fallback) |
| PDF Export | html2pdf.js |
| UI Components | Radix UI primitives |
| Icons | Lucide React |

## Getting Started

### Prerequisites

- **Node.js** 18+ or **Bun** 1.0+
- **npm** or **bun** package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/Pratham2511/Resumer_builder.git
cd Resumer_builder

# Install dependencies
npm install
# or
bun install
```

### Development

```bash
# Start the development server
npm run dev
# or
bun run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm run start
```

## How to Use

### Creating a Resume

1. The app starts with a default "My Resume" profile
2. Fill in your **Personal Information** in the Content tab (name, email, phone, LinkedIn, etc.)
3. Add your **Summary** and **Sections** (Experience, Education, Skills, etc.)
4. Fine-tune the **Format** in the Format tab (margins, fonts, colors, layout)
5. Click **Download PDF** to export

### Importing a Resume

1. Click the **Import** button (upload icon) in the profile bar
2. Choose **PDF** or **DOCX** tab
3. Upload your existing resume file
4. The app will:
   - Extract all text content and detect sections
   - Preserve the original formatting (fonts, margins, colors, layout)
   - Auto-detect if the source has a photo placeholder
   - Create a new profile with the imported data
5. Edit the imported resume as needed

### Managing Profiles

- **Create** — Click the + button to add a new profile
- **Switch** — Use the dropdown to switch between profiles
- **Rename** — Edit the profile name inline
- **Duplicate** — Copy an existing profile
- **Export JSON** — Download profile data as JSON for backup
- **Delete** — Remove a profile (at least one must remain)

## Format Controls

The Format tab provides fine-grained control over:

| Control | Description |
|---------|-------------|
| Page Size | A4 or Letter |
| Margins | Top, right, bottom, left (in points) |
| Font Sizes | Name, section header, entry title, body, meta |
| Line Height | Line spacing multiplier |
| Colors | Primary, secondary, divider |
| Header | Alignment (left/center), show subtitle |
| Footer | Show page numbers, show name, custom text |
| Spacing | Section gap, entry gap, divider weight |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── import-pdf/route.ts    # PDF import API endpoint
│   │   └── import-docx/route.ts   # DOCX import API endpoint
│   ├── layout.tsx
│   └── page.tsx                   # Main application page
├── components/
│   ├── editor/
│   │   ├── editor-panel.tsx       # Content & sections editor
│   │   ├── format-controls.tsx    # Format/layout controls
│   │   ├── import-modal.tsx       # Import PDF/DOCX/JSON modal
│   │   └── profile-manager.tsx    # Profile switcher & management
│   ├── preview/
│   │   └── resume-preview.tsx     # Live A4/Letter resume preview
│   └── ui/                        # shadcn/ui components
├── lib/
│   ├── resume-types.ts            # Type definitions & defaults
│   ├── resume-store.ts            # Zustand state store
│   └── parsers/
│       └── resume-parser.ts       # Resume text parser & format detection
└── hooks/                         # Custom React hooks
```

## Import Format Preservation

When importing a PDF or DOCX, the app extracts and preserves:

- **Font Family** — Dominant font from the source document (mapped to CSS-safe names)
- **Font Sizes** — Name, section headers, entry titles, body text, meta/contact info
- **Margins** — Actual page margins (histogram-based detection for PDFs, section properties for DOCX)
- **Colors** — Primary, secondary, accent colors (weighted by importance)
- **Header Alignment** — Left or center (detected from name/contact position)
- **Line Height** — Inter-line spacing ratio
- **Page Size** — A4 or Letter (detected from page dimensions)
- **Dividers** — Horizontal rule thickness between sections
- **Footer** — Page numbers and custom footer text
- **Photo** — Auto-detected from embedded images

## License

MIT
