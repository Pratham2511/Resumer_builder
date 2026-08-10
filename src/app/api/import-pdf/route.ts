import { NextRequest, NextResponse } from "next/server";
import { parseResumeText, detectFormatFromPdfMetadata, normalizeFontName } from "@/lib/parsers/resume-parser";

interface TextItem {
  str: string;
  x: number;
  y: number;
  fontSize: number;
  fontName: string;
  fontFamily: string;  // from styles — the actual CSS font family
  color: string;
  isBold: boolean;
  width: number;
}

interface PageInfo {
  width: number;
  height: number;
  items: TextItem[];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Extract colors from operator list by correlating setFillRGBColor with subsequent text
function extractColorsFromOps(ops: any, pdfjsOps: any): Map<string, string> {
  const fontColorMap = new Map<string, string>();
  let currentColor: [number, number, number] = [0, 0, 0];
  let currentFont = "";

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];

    // Track fill color
    if (fn === pdfjsOps.setFillRGBColor) {
      let [r, g, b] = args;
      const maxVal = Math.max(r, g, b);

      if (maxVal <= 1) {
        // Already normalized 0-1
        currentColor = [r, g, b];
      } else if (maxVal <= 255) {
        // 8-bit integers (0-255) — common in many PDFs
        currentColor = [r / 255, g / 255, b / 255];
      } else {
        // 16-bit fixed point (0-65535)
        currentColor = [r / 65535, g / 65535, b / 65535];
      }
    }

    // Track font being set
    if (fn === pdfjsOps.setFont) {
      currentFont = args[0] || "";
      // Map font → color
      const hex = rgbToHex(currentColor[0], currentColor[1], currentColor[2]);
      if (!fontColorMap.has(currentFont)) {
        fontColorMap.set(currentFont, hex);
      }
    }
  }

  return fontColorMap;
}

// Detect dividers (horizontal lines) from operator list
function detectDividersFromOps(ops: any, pdfjsOps: any, pageHeight: number): { weight: number; y: number }[] {
  const dividers: { weight: number; y: number }[] = [];
  let currentY = 0;
  let currentLineWidth = 0;

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];

    if (fn === pdfjsOps.setLineWidth) {
      currentLineWidth = args[0] || 0;
    }

    // Track position from transform/moveTo
    if (fn === pdfjsOps.moveTo) {
      if (args.length >= 2) currentY = args[1];
    }

    // A stroke after moveTo+lineTo could be a horizontal line (divider)
    if (fn === pdfjsOps.stroke && currentLineWidth > 0) {
      dividers.push({ weight: currentLineWidth, y: currentY });
    }
  }

  return dividers;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uint8Array = new Uint8Array(buffer);

    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.js");
    const pdfjs = pdfjsLib.default || pdfjsLib;
    const workerSrc = await import("pdfjs-dist/legacy/build/pdf.worker.js");
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc.default || "";
    const pdfDoc = await pdfjs.getDocument({ data: uint8Array }).promise;

    const numPages = pdfDoc.numPages;
    const pages: PageInfo[] = [];
    const textParts: string[] = [];
    let hasPhoto = false;
    let allDividers: { weight: number; y: number }[] = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const styles = textContent.styles as Record<string, any> || {};

      // Get operator list for color extraction + photo detection + dividers
      let fontColorMap = new Map<string, string>();
      let ops: any = null;
      try {
        ops = await page.getOperatorList();

        // Extract color → font mapping
        fontColorMap = extractColorsFromOps(ops, pdfjs.OPS);

        // Detect dividers
        const pageDividers = detectDividersFromOps(ops, pdfjs.OPS, viewport.height);
        allDividers.push(...pageDividers);

        // Photo detection
        if (ops.fnArray.includes(pdfjs.OPS.paintImageXObject)) {
          hasPhoto = true;
        }
      } catch {
        // Ignore operator list errors
      }

      const pageItems: TextItem[] = [];
      const pageLines: string[] = [];

      // Extract text items with detailed style info
      for (const item of textContent.items as any[]) {
        if (!item.str || !item.str.trim()) continue;

        const fontSize = Math.abs(item.transform?.[3] || item.height || 9.5);
        const x = item.transform?.[4] || 0;
        const y = item.transform?.[5] || 0;
        const fontName = item.fontName || "";
        const width = item.width || 0;

        // Get fontFamily from styles (more reliable than fontName)
        const styleInfo = styles[fontName] || {};
        const fontFamily = styleInfo.fontFamily || "";

        // Detect bold from font name + style
        const isBold = /bold|black|heavy|demibold|semibold/i.test(fontName) ||
                       (styleInfo.fontWeight && Number(styleInfo.fontWeight) >= 600);

        // Get color from operator list mapping
        let color = fontColorMap.get(fontName) || "#000000";
        // Also check style for color
        try {
          if (styleInfo.color) {
            if (Array.isArray(styleInfo.color) && styleInfo.color.length >= 3) {
              color = rgbToHex(styleInfo.color[0], styleInfo.color[1], styleInfo.color[2]);
            }
          }
        } catch {
          // Keep operator list color
        }

        pageItems.push({
          str: item.str,
          x, y,
          fontSize: Math.round(fontSize * 10) / 10,
          fontName,
          fontFamily,
          color,
          isBold,
          width,
        });
      }

      // Sort items by Y (top to bottom = descending Y in PDF), then X
      pageItems.sort((a, b) => {
        const yDiff = a.y - b.y;
        if (Math.abs(yDiff) > 2) return -yDiff;
        return a.x - b.x;
      });

      // Group into lines
      if (pageItems.length > 0) {
        let currentLine = "";
        let lastY = pageItems[0].y;

        for (const item of pageItems) {
          if (Math.abs(item.y - lastY) > 2) {
            if (currentLine.trim()) pageLines.push(currentLine.trim());
            currentLine = item.str;
            lastY = item.y;
          } else {
            const gap = currentLine.endsWith(" ") || item.str.startsWith(" ") ? "" : " ";
            currentLine += gap + item.str;
          }
        }
        if (currentLine.trim()) pageLines.push(currentLine.trim());
        textParts.push(pageLines.join("\n"));
      }

      pages.push({ width: viewport.width, height: viewport.height, items: pageItems });
    }

    const text = textParts.join("\n\n");

    // ─── ADVANCED FORMAT EXTRACTION ───
    const allItems = pages.flatMap(p => p.items);
    const firstPageItems = pages[0]?.items || [];
    const pageWidth = pages[0]?.width || 612;
    const pageHeight = pages[0]?.height || 792;

    // 1. FONT FAMILY — prefer fontFamily from styles, fall back to fontName
    const fontCounts: Record<string, number> = {};
    for (const item of allItems) {
      // Use fontFamily from PDF styles if available, else normalize fontName
      const rawFont = item.fontFamily || item.fontName;
      if (rawFont) {
        const clean = rawFont.replace(/^g_d\d+_f/, "Font").replace(/^C\./, "").replace(/\+/, " ");
        fontCounts[clean] = (fontCounts[clean] || 0) + item.str.length;
      }
    }
    const dominantFont = Object.entries(fontCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Inter";
    // If the dominant font is a generic family (like "sans-serif"), try to find a more specific one
    let fontFamily = normalizeFontName(dominantFont);
    if (fontFamily === "sans-serif" || fontFamily === "serif" || fontFamily === "monospace") {
      // Look for a non-generic font in the list
      const specificFont = Object.entries(fontCounts)
        .sort((a, b) => b[1] - a[1])
        .find(([name]) => {
          const normalized = normalizeFontName(name);
          return normalized !== "sans-serif" && normalized !== "serif" && normalized !== "monospace";
        });
      if (specificFont) fontFamily = normalizeFontName(specificFont[0]);
      else if (fontFamily === "sans-serif") fontFamily = "Helvetica"; // most common sans-serif in PDFs
      else if (fontFamily === "serif") fontFamily = "Times New Roman";
    }

    // 2. FONT SIZES — classify by role
    const sizeFreq: Record<number, number> = {};
    for (const item of allItems) {
      const rounded = Math.round(item.fontSize * 2) / 2;
      sizeFreq[rounded] = (sizeFreq[rounded] || 0) + item.str.length;
    }
    const sortedSizes = Object.entries(sizeFreq)
      .map(([s, f]) => ({ size: parseFloat(s), freq: f }))
      .sort((a, b) => b.freq - a.freq);

    // Name size = largest font on first page top portion
    const nameSizeCandidates = firstPageItems
      .filter(item => item.y > pageHeight * 0.5) // top half (PDF Y is from bottom)
      .map(item => item.fontSize)
      .sort((a, b) => b - a);
    const nameSize = nameSizeCandidates[0] || sortedSizes[0]?.size || 26;

    // Section header size = bold uppercase text that isn't the name
    const sectionSizeCandidates = allItems
      .filter(item => item.isBold && item.str === item.str.toUpperCase() && item.str.length > 2 && item.str.length < 30 && item.fontSize < nameSize)
      .map(item => item.fontSize);
    const sectionSize = sectionSizeCandidates.length > 0
      ? modeOf(sectionSizeCandidates)
      : (sortedSizes.find(s => s.size < nameSize && s.size >= 10)?.size || 12);

    // Body size = most common small font
    const bodySize = sortedSizes.find(s => s.size < sectionSize && s.size >= 7)?.size || 9.5;

    // Meta/contact size
    const metaSize = sortedSizes.find(s => s.size <= bodySize && s.size >= 7)?.size || bodySize;

    // Entry title size = bold text between section and body
    const entryTitleCandidates = allItems
      .filter(item => item.isBold && item.fontSize > bodySize && item.fontSize < nameSize && Math.abs(item.fontSize - sectionSize) > 0.5)
      .map(item => item.fontSize);
    const entryTitleSize = entryTitleCandidates.length > 0
      ? modeOf(entryTitleCandidates)
      : Math.round(((bodySize + sectionSize) / 2) * 10) / 10;

    // 3. COLORS — from operator list extraction
    // Weight colors by "importance": bold/large text counts more than body text
    const colorFreq: Record<string, number> = {};
    for (const item of allItems) {
      const c = item.color.toLowerCase();
      if (c === "#000000" || c === "#000" || c === "#010000" || c === "#000100") continue;
      // Weight: bold text × 3, large text (headings) × 2, body text × 1
      const isHeading = item.fontSize >= sectionSize || item.isBold;
      const weight = item.isBold ? 3 : (isHeading ? 2 : 1);
      colorFreq[c] = (colorFreq[c] || 0) + item.str.length * weight;
    }
    const sortedColors = Object.entries(colorFreq)
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);

    // Primary = most used accent color (typically for headings/names)
    // Secondary = second accent color (for contact info, meta)
    const primaryColor = sortedColors[0] || "#2E2C2C";
    const secondaryColor = sortedColors[1] || "#666464";
    const accentColor = sortedColors.find(c => c !== primaryColor) || primaryColor;

    // 4. MARGINS — from text positions relative to page edges
    // Use only substantial content items (not stray single-char items)
    const contentItems = firstPageItems.filter(item => item.str.length > 1 && item.width > 5);
    const leftMargin = contentItems.length > 0 ? Math.max(0, Math.min(...contentItems.map(item => item.x))) : 56;
    const rightEdge = contentItems.length > 0 ? Math.max(...contentItems.map(item => item.x + item.width)) : (pageWidth - 56);
    const rightMargin = Math.max(0, pageWidth - rightEdge);
    const topEdge = contentItems.length > 0 ? Math.max(...contentItems.map(item => item.y)) : (pageHeight - 72);
    const topMargin = Math.max(0, pageHeight - topEdge);
    const bottomEdge = contentItems.length > 0 ? Math.min(...contentItems.map(item => item.y)) : 72;
    const bottomMargin = Math.max(0, bottomEdge);

    const margins = {
      top: clampMargin(topMargin),
      right: clampMargin(rightMargin),
      bottom: clampMargin(bottomMargin),
      left: clampMargin(leftMargin),
    };

    // If right/bottom margins seem unreasonably large (content doesn't fill the page),
    // assume symmetrical margins based on left/top
    if (margins.right > margins.left * 2) margins.right = margins.left;
    if (margins.bottom > margins.top * 2) margins.bottom = margins.top;
    // If bottom margin is still much larger than top, use top as bottom (common for resumes)
    if (margins.bottom > margins.top * 1.2 && margins.top < 100) margins.bottom = margins.top;

    // 5. HEADER ALIGNMENT
    const nameItems = firstPageItems.filter(item => item.fontSize >= nameSize - 1);
    let headerAlign: "center" | "left" = "left";
    if (nameItems.length > 0) {
      const nameCenterX = nameItems.reduce((sum, item) => sum + item.x + item.width / 2, 0) / nameItems.length;
      const pageCenter = pageWidth / 2;
      const offset = Math.abs(nameCenterX - pageCenter);
      headerAlign = offset < pageWidth * 0.1 ? "center" : "left";
    }

    // 6. LINE HEIGHT — from Y gaps between body-sized items within paragraphs
    // Only consider consecutive items with the SAME font size that are close together
    // (within the same paragraph), not items separated by paragraph breaks
    const sameSizeItems = allItems
      .filter(item => Math.abs(item.fontSize - bodySize) < 1)
      .sort((a, b) => b.y - a.y);
    let lineHeight = 1.5;
    if (sameSizeItems.length > 2) {
      const yDiffs: number[] = [];
      for (let i = 1; i < Math.min(sameSizeItems.length, 50); i++) {
        const diff = Math.abs(sameSizeItems[i - 1].y - sameSizeItems[i].y);
        // Only include gaps that look like line spacing (1x to 2x the font size)
        // Skip larger gaps which are paragraph breaks
        if (diff > bodySize * 0.8 && diff < bodySize * 2.2) yDiffs.push(diff);
      }
      if (yDiffs.length > 0) {
        // Use the mode (most common gap) rather than average to avoid paragraph breaks
        const avgLineGap = modeOf(yDiffs, 0.5);
        lineHeight = Math.round((avgLineGap / bodySize) * 20) / 20;
        lineHeight = Math.max(1, Math.min(2, lineHeight));
      }
    }

    // 7. LETTER SPACING
    const nameLetterSpacing = /condensed|narrow|compact/i.test(dominantFont) ? 0 : 2.5;
    const sectionLetterSpacing = 1;

    // 8. SECTION/ENTRY SPACING
    const sectionSpacing = 8;
    const entrySpacing = 8;

    // 9. DIVIDER WEIGHT — from detected horizontal lines
    let dividerWeight = 0.75;
    if (allDividers.length > 0) {
      const avgWeight = allDividers.reduce((sum, d) => sum + d.weight, 0) / allDividers.length;
      dividerWeight = Math.round(avgWeight * 4) / 4; // round to 0.25
      dividerWeight = Math.max(0.25, Math.min(3, dividerWeight));
    }

    // 10. FOOTER DETECTION
    const lastPageItems = pages[numPages - 1]?.items || [];
    const footerItems = lastPageItems.filter(item => item.y < pageHeight * 0.1);
    const hasPageNumbers = footerItems.some(item => /^\d+$/.test(item.str.trim()) && item.str.trim().length <= 2);
    const hasNameInFooter = footerItems.some(item => item.fontSize < bodySize + 1);

    // 11. SUBTITLE DETECTION
    const showSubtitle = firstPageItems.some(item =>
      item.fontSize < nameSize &&
      item.fontSize > bodySize &&
      item.y > (pageHeight - topMargin - nameSize * 3) &&
      item.y < (pageHeight - topMargin + nameSize)
    );

    // Parse resume structure
    const resumeData = parseResumeText(text);

    const detectedFormat = detectFormatFromPdfMetadata({
      headerAlign,
      hasPhoto,
      fontFamily,
      lineHeight,
      nameLetterSpacing,
      sectionLetterSpacing,
      fontSizes: {
        name: Math.round(nameSize * 10) / 10,
        section: Math.round(sectionSize * 10) / 10,
        body: Math.round(bodySize * 10) / 10,
        meta: Math.round(metaSize * 10) / 10,
        entryTitle: Math.round(entryTitleSize * 10) / 10,
      },
      colors: {
        primary: primaryColor,
        secondary: secondaryColor,
        accent: accentColor,
        divider: primaryColor,
      },
      margins,
      sectionSpacing,
      entrySpacing,
      dividerWeight,
      footer: { showPageNumbers: hasPageNumbers, showName: hasNameInFooter, customText: "" },
      showSubtitle,
    });

    return NextResponse.json({
      success: true,
      data: resumeData,
      format: detectedFormat,
      rawText: text,
      pageCount: numPages,
    });
  } catch (error: unknown) {
    console.error("PDF import error:", error);
    const message = error instanceof Error ? error.message : "Failed to parse PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Utility Functions ───

function clampMargin(v: number): number {
  return Math.max(15, Math.min(120, Math.round(v)));
}

function modeOf(values: number[], tolerance: number = 0.5): number {
  if (values.length === 0) return 10.5;
  const freq: Record<number, number> = {};
  for (const v of values) {
    const rounded = Math.round(v / tolerance) * tolerance;
    freq[rounded] = (freq[rounded] || 0) + 1;
  }
  return parseFloat(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
}

function isDarkerColor(hex: string): boolean {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  } catch {
    return true;
  }
}
