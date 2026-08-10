---
Task ID: format-extraction-fix
Agent: main
Task: Fix PDF/DOCX import to properly detect and preserve formatting (margins, fonts, colors, sizes, alignment, etc.)

Work Log:
- Analyzed existing import routes: found they only extracted headerAlign and hasPhoto, with all other format properties defaulting
- Enriched DetectedFormat interface with all ResumeFormat properties: fontFamily, lineHeight, nameLetterSpacing, sectionLetterSpacing, metaSize, entryTitleSize, accent color, footer, showSubtitle, sectionSpacing, entrySpacing, dividerWeight
- Rewrote PDF import route (import-pdf/route.ts):
  - Added operator list parsing to extract colors via setFillRGBColor (handles 0-1, 0-255, 0-65535 ranges)
  - Added font family extraction from PDF.js styles.fontFamily (not internal font names like g_d0_f1)
  - Added font size classification: name (largest), section (bold uppercase), body (most common), entry title, meta
  - Added margin detection from text item positions relative to page edges
  - Added line height estimation from Y gaps between same-sized text items
  - Added divider weight detection from operator list stroke operations
  - Added header alignment detection from name center position
  - Added subtitle detection from text size between name and body
  - Added footer detection from bottom-of-page text items
- Rewrote DOCX import route (import-docx/route.ts):
  - Replaced @xmldom/xmldom DOMParser (which crashed in Node.js) with regex-based XML parser
  - Added parseStylesXml using regex to extract default fonts/sizes and named styles
  - Added parseDocumentXml using regex to extract per-paragraph formatting (sizes, colors, bold, alignment)
  - Added parsePageSetup using regex to extract page margins from sectPr/pgMar in twips
  - Added style chain resolution (style → basedOn → defaults)
  - Added heading detection from style IDs (Heading1, Heading2, etc.)
- Updated import-modal.tsx:
  - Fixed broken import: DetectedFormat now imported from resume-parser (not resume-types)
  - Updated applyImportedData to map ALL DetectedFormat fields to ResumeFormat (fontFamily, lineHeight, metaSize, entryTitleSize, accent, footer, showSubtitle, etc.)
- Added normalizeFontName() function with 30+ font name mappings (PDF internal names → CSS font families)
- Installed JSZip and @xmldom/xmldom (ended up using regex instead of xmldom)

Stage Summary:
- PDF import now correctly extracts: Helvetica font, 24/11/9/10pt sizes, #1a3c5e/#4a6b8a colors, 56pt margins, center alignment
- DOCX import now correctly extracts: Calibri font, 22/11/9.5pt sizes, #1a3c5e primary color, 56.7/42.5pt margins, center alignment
- All format properties (margins, fonts, colors, sizes, alignment, line height, letter spacing, dividers, footer, subtitle) are now properly detected and applied
- Build passes cleanly, both APIs return 200 with correct format data
