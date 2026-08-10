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
        currentColor = [r, g, b];
      } else if (maxVal <= 255) {
        currentColor = [r / 255, g / 255, b / 255];
      } else {
        currentColor = [r / 65535, g / 65535, b / 65535];
      }
    }

    // Track font being set
    if (fn === pdfjsOps.setFont) {
      currentFont = args[0] || "";
      // Map font → color (update every time to catch color changes for same font)
      const hex = rgbToHex(currentColor[0], currentColor[1], currentColor[2]);
      fontColorMap.set(currentFont, hex);
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

    if (fn === pdfjsOps.moveTo) {
      if (args.length >= 2) currentY = args[1];
    }

    if (fn === pdfjsOps.stroke && currentLineWidth > 0) {
      dividers.push({ weight: currentLineWidth, y: currentY });
    }
  }

  return dividers;
}

// ─── Histogram-based margin detection ───
// Instead of min/max (which outliers distort), use the most common left edge
function detectMarginFromPositions(positions: number[], tolerance: number = 3): number {
  if (positions.length === 0) return 56;
  // Build a frequency histogram
  const freq: Record<number, number> = {};
  for (const pos of positions) {
    const rounded = Math.round(pos / tolerance) * tolerance;
    freq[rounded] = (freq[rounded] || 0) + 1;
  }
  // Find the most common position (the margin)
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return parseFloat(sorted[0][0]);
}

// Detect page size (A4 vs Letter)
function detectPageSize(width: number, height: number): "a4" | "letter" {
  // A4: 595.28 x 841.89 pt
  // Letter: 612 x 792 pt
  const a4Diff = Math.abs(width - 595.28) + Math.abs(height - 841.89);
  const letterDiff = Math.abs(width - 612) + Math.abs(height - 792);
  return a4Diff < letterDiff ? "a4" : "letter";
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
        fontColorMap = extractColorsFromOps(ops, pdfjs.OPS);
        const pageDividers = detectDividersFromOps(ops, pdfjs.OPS, viewport.height);
        allDividers.push(...pageDividers);
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

    // 0. PAGE SIZE detection
    const pageSize = detectPageSize(pageWidth, pageHeight);

    // 1. FONT FAMILY — prefer fontFamily from styles, fall back to fontName
    const fontCounts: Record<string, number> = {};
    for (const item of allItems) {
      const rawFont = item.fontFamily || item.fontName;
      if (rawFont) {
        const clean = rawFont.replace(/^g_d\d+_f/, "Font").replace(/^C\./, "").replace(/\+/, " ");
        fontCounts[clean] = (fontCounts[clean] || 0) + item.str.length;
      }
    }
    const dominantFont = Object.entries(fontCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Inter";
    let fontFamily = normalizeFontName(dominantFont);
    if (fontFamily === "sans-serif" || fontFamily === "serif" || fontFamily === "monospace") {
      const specificFont = Object.entries(fontCounts)
        .sort((a, b) => b[1] - a[1])
        .find(([name]) => {
          const normalized = normalizeFontName(name);
          return normalized !== "sans-serif" && normalized !== "serif" && normalized !== "monospace";
        });
      if (specificFont) fontFamily = normalizeFontName(specificFont[0]);
      else if (fontFamily === "sans-serif") fontFamily = "Helvetica";
      else if (fontFamily === "serif") fontFamily = "Times New Roman";
    }

    // 2. FONT SIZES — improved role classification using position + style
    // Build frequency map of all font sizes
    const sizeFreq: Record<number, number> = {};
    for (const item of allItems) {
      const rounded = Math.round(item.fontSize * 2) / 2;
      sizeFreq[rounded] = (sizeFreq[rounded] || 0) + item.str.length;
    }
    const sortedSizes = Object.entries(sizeFreq)
      .map(([s, f]) => ({ size: parseFloat(s), freq: f }))
      .sort((a, b) => b.freq - a.freq);

    // Name size = largest font in the top 30% of the first page
    // PDF Y goes from bottom (0) to top (height), so top 30% = y > pageHeight * 0.7
    const topRegionItems = firstPageItems.filter(item => item.y > pageHeight * 0.7);
    const nameSizeCandidates = topRegionItems
      .map(item => item.fontSize)
      .sort((a, b) => b - a);
    // The name is typically the largest text item in the top region
    const nameSize = nameSizeCandidates[0] || sortedSizes[0]?.size || 26;

    // Section header size — improved detection:
    // Look for bold text that is ALL CAPS or short headings, smaller than name
    // Also consider items that are the start of new "blocks" (significant Y gap from previous)
    const sectionSizeCandidates: number[] = [];

    // Method A: Bold + ALL CAPS + reasonable length
    for (const item of allItems) {
      if (item.isBold && item.str === item.str.toUpperCase() &&
          item.str.length > 2 && item.str.length < 30 &&
          item.fontSize < nameSize && item.fontSize > 7) {
        sectionSizeCandidates.push(item.fontSize);
      }
    }

    // Method B: Bold text that appears right before a group of smaller text (section header pattern)
    // We detect this by looking at consecutive items in Y order
    const sortedByY = [...firstPageItems].sort((a, b) => b.y - a.y);
    for (let i = 0; i < sortedByY.length - 3; i++) {
      const item = sortedByY[i];
      const nextItems = sortedByY.slice(i + 1, i + 4);
      // If this bold item is followed by smaller non-bold items → likely a section header
      if (item.isBold && item.fontSize < nameSize && item.fontSize > 7) {
        const isFollowedBySmaller = nextItems.some(n =>
          !n.isBold && n.fontSize < item.fontSize && Math.abs(n.y - item.y) < item.fontSize * 4
        );
        if (isFollowedBySmaller || item.str === item.str.toUpperCase()) {
          sectionSizeCandidates.push(item.fontSize);
        }
      }
    }

    const sectionSize = sectionSizeCandidates.length > 0
      ? modeOf(sectionSizeCandidates)
      : (sortedSizes.find(s => s.size < nameSize && s.size >= 10)?.size || 12);

    // Body size = most common font size that's smaller than section size
    // Use character-length weighted frequency for accuracy
    const bodySizeCandidates = sortedSizes.filter(s => s.size < sectionSize && s.size >= 7);
    const bodySize = bodySizeCandidates.length > 0
      ? bodySizeCandidates[0].size  // most frequent (already sorted by freq)
      : 9.5;

    // Meta/contact size — typically same as body or slightly smaller, used for contact info
    const metaSizeCandidates = sortedSizes.filter(s => s.size <= bodySize + 0.5 && s.size >= 7);
    const metaSize = metaSizeCandidates.length > 0
      ? metaSizeCandidates[0].size
      : bodySize;

    // Entry title size = bold text between section and body sizes
    const entryTitleCandidates = allItems
      .filter(item => item.isBold && item.fontSize >= bodySize && item.fontSize < sectionSize && item.fontSize < nameSize)
      .map(item => item.fontSize);
    const entryTitleSize = entryTitleCandidates.length > 0
      ? modeOf(entryTitleCandidates)
      : Math.round(((bodySize + sectionSize) / 2) * 10) / 10;

    // 3. COLORS — improved with per-item tracking
    const colorFreq: Record<string, number> = {};
    for (const item of allItems) {
      const c = item.color.toLowerCase();
      if (c === "#000000" || c === "#000" || c === "#010000" || c === "#000100" || c === "#010001") continue;
      // Weight: name-sized text × 5, bold × 3, heading × 2, body × 1
      let weight = item.str.length;
      if (item.fontSize >= nameSize - 1) weight *= 5;
      else if (item.isBold) weight *= 3;
      else if (item.fontSize >= sectionSize) weight *= 2;
      colorFreq[c] = (colorFreq[c] || 0) + weight;
    }
    const sortedColors = Object.entries(colorFreq)
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);

    const primaryColor = sortedColors[0] || "#2E2C2C";
    const secondaryColor = sortedColors[1] || "#666464";
    const accentColor = sortedColors.find(c => c !== primaryColor) || primaryColor;

    // 4. MARGINS — improved histogram-based detection
    // Only use substantial content items (length > 1, width > 5) from first page
    const contentItems = firstPageItems.filter(item => item.str.length > 1 && item.width > 5);

    // Left margin: most common x position of content starts
    const leftPositions = contentItems.map(item => item.x);
    const leftMarginRaw = detectMarginFromPositions(leftPositions);

    // Right margin: most common right edge, then subtract from page width
    const rightPositions = contentItems.map(item => item.x + item.width);
    const rightEdgeRaw = detectMarginFromPositions(rightPositions);
    const rightMarginRaw = Math.max(0, pageWidth - rightEdgeRaw);

    // Top margin: highest y position (PDF y goes up)
    const topPositions = contentItems.map(item => item.y);
    const topEdgeRaw = detectMarginFromPositions(topPositions);
    const topMarginRaw = Math.max(0, pageHeight - topEdgeRaw);

    // Bottom margin: lowest y position
    const bottomPositions = contentItems.map(item => item.y);
    const bottomEdgeRaw = contentItems.length > 0 ? Math.min(...bottomPositions) : 72;
    const bottomMarginRaw = Math.max(0, bottomEdgeRaw);

    let margins = {
      top: clampMargin(topMarginRaw),
      right: clampMargin(rightMarginRaw),
      bottom: clampMargin(bottomMarginRaw),
      left: clampMargin(leftMarginRaw),
    };

    // Symmetry adjustments — resumes typically have similar left/right and top/bottom
    if (margins.right > margins.left * 2.5) margins.right = margins.left;
    if (margins.left > margins.right * 2.5) margins.left = margins.right;
    if (margins.bottom > margins.top * 2) margins.bottom = margins.top;
    if (margins.top > margins.bottom * 2) margins.top = margins.bottom;

    // 5. HEADER ALIGNMENT — improved detection
    // Check all items in the name-sized range for center vs left alignment
    const nameItems = firstPageItems.filter(item => item.fontSize >= nameSize - 1);
    let headerAlign: "center" | "left" = "left";
    if (nameItems.length > 0) {
      const nameCenterX = nameItems.reduce((sum, item) => sum + item.x + item.width / 2, 0) / nameItems.length;
      const pageCenter = pageWidth / 2;
      const offset = Math.abs(nameCenterX - pageCenter);
      headerAlign = offset < pageWidth * 0.08 ? "center" : "left";
    }
    // Also check contact info (meta-sized items near the top) for alignment
    const headerMetaItems = firstPageItems.filter(item =>
      item.fontSize <= metaSize + 1 && item.y > pageHeight * 0.6
    );
    if (headerMetaItems.length > 3) {
      const metaCenterX = headerMetaItems.reduce((sum, item) => sum + item.x + item.width / 2, 0) / headerMetaItems.length;
      const pageCenter = pageWidth / 2;
      const metaOffset = Math.abs(metaCenterX - pageCenter);
      // If meta items are centered, override to center
      if (metaOffset < pageWidth * 0.08 && headerAlign === "left") {
        headerAlign = "center";
      }
    }

    // 6. LINE HEIGHT — improved with same-font-size consecutive items
    const sameSizeItems = allItems
      .filter(item => Math.abs(item.fontSize - bodySize) < 1)
      .sort((a, b) => b.y - a.y);
    let lineHeight = 1.5;
    if (sameSizeItems.length > 2) {
      const yDiffs: number[] = [];
      for (let i = 1; i < Math.min(sameSizeItems.length, 80); i++) {
        const diff = Math.abs(sameSizeItems[i - 1].y - sameSizeItems[i].y);
        if (diff > bodySize * 0.8 && diff < bodySize * 2.5) yDiffs.push(diff);
      }
      if (yDiffs.length > 0) {
        const avgLineGap = modeOf(yDiffs, 0.5);
        lineHeight = Math.round((avgLineGap / bodySize) * 20) / 20;
        lineHeight = Math.max(1, Math.min(2.5, lineHeight));
      }
    }

    // 7. LETTER SPACING — detect from font characteristics
    const nameLetterSpacing = /condensed|narrow|compact/i.test(dominantFont) ? 0 : 2.5;
    const sectionLetterSpacing = 1;

    // 8. SECTION/ENTRY SPACING — detect from Y gaps between sections
    let sectionSpacing = 8;
    let entrySpacing = 8;
    // Look for Y gaps larger than line height but smaller than section breaks
    if (firstPageItems.length > 5) {
      const sortedFirst = [...firstPageItems].sort((a, b) => b.y - a.y);
      const gaps: number[] = [];
      for (let i = 1; i < sortedFirst.length; i++) {
        const gap = Math.abs(sortedFirst[i - 1].y - sortedFirst[i].y);
        // Gaps between line-height × 2 and line-height × 6 are section/entry spacing
        if (gap > bodySize * lineHeight * 1.5 && gap < bodySize * lineHeight * 6) {
          gaps.push(gap);
        }
      }
      if (gaps.length > 2) {
        const avgGap = modeOf(gaps, 1);
        // Convert to pt (approximate)
        sectionSpacing = Math.round(avgGap * 0.6);
        entrySpacing = Math.round(avgGap * 0.4);
        sectionSpacing = Math.max(4, Math.min(20, sectionSpacing));
        entrySpacing = Math.max(4, Math.min(16, entrySpacing));
      }
    }

    // 9. DIVIDER WEIGHT — from detected horizontal lines
    let dividerWeight = 0.75;
    if (allDividers.length > 0) {
      const avgWeight = allDividers.reduce((sum, d) => sum + d.weight, 0) / allDividers.length;
      dividerWeight = Math.round(avgWeight * 4) / 4;
      dividerWeight = Math.max(0.25, Math.min(3, dividerWeight));
    }

    // 10. FOOTER DETECTION — improved with multi-page analysis
    const lastPageItems = pages[numPages - 1]?.items || [];
    // Footer region = bottom 15% of the page (PDF y < 15% of height)
    const footerItems = lastPageItems.filter(item => item.y < pageHeight * 0.15);
    const hasPageNumbers = footerItems.some(item => /^\d+$/.test(item.str.trim()) && item.str.trim().length <= 2);
    // Check for name-like text in footer (text smaller than body, at very bottom)
    const hasNameInFooter = footerItems.some(item =>
      item.fontSize <= metaSize + 1 && item.str.length > 3 && !/^\d+$/.test(item.str.trim())
    );
    // Extract custom footer text (e.g., "Page 1 of 2", "References available")
    let customFooterText = "";
    const footerTextParts = footerItems
      .filter(item => item.str.trim().length > 2 && !/^\d+$/.test(item.str.trim()))
      .map(item => item.str.trim());
    if (footerTextParts.length > 0 && !hasPageNumbers) {
      customFooterText = footerTextParts.join(" ").substring(0, 50);
    }

    // 11. SUBTITLE DETECTION — improved
    // Subtitle = text near the name that's smaller than name but larger than body
    const showSubtitle = firstPageItems.some(item => {
      const nearName = nameItems.length > 0
        ? Math.abs(item.y - nameItems[0].y) < nameSize * 2.5
        : item.y > pageHeight * 0.6;
      return nearName &&
             item.fontSize < nameSize &&
             item.fontSize > bodySize + 1 &&
             !item.isBold;
    });

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
      footer: { showPageNumbers: hasPageNumbers, showName: hasNameInFooter, customText: customFooterText },
      showSubtitle,
    });

    return NextResponse.json({
      success: true,
      data: resumeData,
      format: detectedFormat,
      rawText: text,
      pageCount: numPages,
      pageSize,  // pass detected page size
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
