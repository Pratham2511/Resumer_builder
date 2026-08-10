import { NextRequest, NextResponse } from "next/server";
import { parseResumeText, detectFormatFromPdfMetadata, normalizeFontName } from "@/lib/parsers/resume-parser";

// ─── Regex-based XML Parsing Helpers ───
// No DOMParser needed — pure regex extraction from XML strings

/** Extract an attribute value from a tag snippet, e.g. getWVal(str) finds w:val="..." */
function getWVal(xml: string, attr: string): string | null {
  const re = new RegExp(`\\bw:${attr}\\s*=\\s*"([^"]*)"`, "i");
  const m = xml.match(re);
  return m ? m[1] : null;
}

/** Extract a generic attribute like w:styleId="..." from a tag */
function getAttr(xml: string, prefix: string, local: string): string | null {
  const re = new RegExp(`\\b${prefix}:${local}\\s*=\\s*"([^"]*)"`, "i");
  const m = xml.match(re);
  return m ? m[1] : null;
}

/** Extract the first child element's full content as a string slice.
 *  E.g. extractChild(xml, "w:rPr") returns the inner content of the first <w:rPr>...</w:rPr> */
function extractChild(xml: string, tag: string): string | null {
  // Handle both self-closing and normal tags
  const selfClosingRe = new RegExp(`<${tag}\\b[^>]*?/>`, "i");
  // Try normal tag first (with content)
  const openRe = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(xml)) !== null) {
    const startIdx = match.index;
    const afterOpen = startIdx + match[0].length;
    // Find matching close tag by tracking depth
    const closeTag = `</${tag}>`;
    const openTagRe = new RegExp(`<${tag}\\b[^>]*>`, "gi");
    const closeTagRe = new RegExp(closeTag, "gi");
    let depth = 1;
    let searchFrom = afterOpen;
    while (depth > 0 && searchFrom < xml.length) {
      openTagRe.lastIndex = searchFrom;
      closeTagRe.lastIndex = searchFrom;
      const nextOpen = openTagRe.exec(xml);
      const nextClose = closeTagRe.exec(xml);
      if (!nextClose) break; // No matching close found
      if (nextOpen && nextOpen.index < nextClose.index) {
        depth++;
        searchFrom = nextOpen.index + nextOpen[0].length;
      } else {
        depth--;
        if (depth === 0) {
          return xml.substring(afterOpen, nextClose.index);
        }
        searchFrom = nextClose.index + closeTag.length;
      }
    }
  }
  // Check for self-closing
  const scMatch = xml.match(selfClosingRe);
  if (scMatch) return "";
  return null;
}

/** Extract all child elements as array of their inner content */
function extractChildren(xml: string, tag: string): string[] {
  const results: string[] = [];
  const openRe = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(xml)) !== null) {
    const startIdx = match.index;
    const afterOpen = startIdx + match[0].length;
    const closeTag = `</${tag}>`;
    const openTagRe = new RegExp(`<${tag}\\b[^>]*>`, "gi");
    const closeTagRe = new RegExp(closeTag, "gi");
    let depth = 1;
    let searchFrom = afterOpen;
    while (depth > 0 && searchFrom < xml.length) {
      openTagRe.lastIndex = searchFrom;
      closeTagRe.lastIndex = searchFrom;
      const nextOpen = openTagRe.exec(xml);
      const nextClose = closeTagRe.exec(xml);
      if (!nextClose) break;
      if (nextOpen && nextOpen.index < nextClose.index) {
        depth++;
        searchFrom = nextOpen.index + nextOpen[0].length;
      } else {
        depth--;
        if (depth === 0) {
          results.push(xml.substring(afterOpen, nextClose.index));
        }
        searchFrom = nextClose.index + closeTag.length;
      }
    }
    if (depth > 0) {
      // Unclosed tag — take rest of string
      results.push(xml.substring(afterOpen));
    }
  }
  return results;
}

/** Extract the full opening tag (including attributes) for the first occurrence */
function extractOpeningTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b([^>]*?)>`, "i");
  const m = xml.match(re);
  return m ? m[0] : null;
}

/** Check if a self-closing or empty element exists, e.g. <w:b/> or <w:b w:val="1"/> */
function hasElement(xml: string, tag: string): boolean {
  const re = new RegExp(`<${tag}\\b[^>]*/?>`, "i");
  return re.test(xml);
}

/** Extract text content from <w:t>...</w:t> elements */
function extractText(xml: string): string {
  const texts: string[] = [];
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    texts.push(m[1]);
  }
  return texts.join("");
}

// ─── Unit Conversion Helpers ───

/** Convert half-points (DOCX font sizes) to points */
function halfPointsToPt(hp: string | null): number | null {
  if (!hp) return null;
  const val = parseInt(hp, 10);
  if (isNaN(val)) return null;
  return val / 2;
}

/** Convert twips (DOCX margins/indents) to points. 1 pt = 20 twips */
function twipsToPt(twips: string | null): number | null {
  if (!twips) return null;
  const val = parseInt(twips, 10);
  if (isNaN(val)) return null;
  return Math.abs(val) / 20;
}

/** Parse a DOCX color value (hex string) */
function parseColor(val: string | null): string | null {
  if (!val || val === "auto" || val === "null") return null;
  if (val.length === 6 && /^[0-9a-fA-F]{6}$/.test(val)) return `#${val.toLowerCase()}`;
  if (val.startsWith("#")) return val.toLowerCase();
  return null;
}

// ─── Data Structures ───

interface DocxRunStyle {
  fontSize: number | null;
  fontFamily: string | null;
  color: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

interface DocxParagraphStyle {
  alignment: string | null; // "center", "left", "right", "both"
  spacing: { before: number | null; after: number | null; line: number | null };
  indent: { left: number | null; right: number | null };
  runStyle: DocxRunStyle;
}

interface DocxStyleDef {
  styleId: string;
  name: string | null;
  type: string | null;
  basedOn: string | null;
  paragraphProps: DocxParagraphStyle;
  runProps: DocxRunStyle;
}

interface DocxFormatData {
  defaultRunStyle: DocxRunStyle;
  defaultParaStyle: DocxParagraphStyle;
  styles: Map<string, DocxStyleDef>;
  pageMargins: { top: number; right: number; bottom: number; left: number };
  pageSize: { width: number; height: number };
}

// ─── Default values ───

const DEFAULT_RUN_STYLE: DocxRunStyle = {
  fontSize: 11,
  fontFamily: "Calibri",
  color: "#000000",
  bold: false,
  italic: false,
  underline: false,
};

const DEFAULT_PARA_STYLE: DocxParagraphStyle = {
  alignment: "left",
  spacing: { before: 0, after: 0, line: null },
  indent: { left: 0, right: 0 },
  runStyle: DEFAULT_RUN_STYLE,
};

// ─── Parse run properties (w:rPr) using regex ───
function parseRunProps(
  rPrXml: string | null,
  defaults: DocxRunStyle = DEFAULT_RUN_STYLE
): DocxRunStyle {
  if (!rPrXml) return { ...defaults };

  // Font size: <w:sz w:val="44"/>
  const szMatch = rPrXml.match(/<w:sz\b[^>]*>/i);
  const fontSize = szMatch
    ? (halfPointsToPt(getWVal(szMatch[0], "val")) ?? defaults.fontSize)
    : defaults.fontSize;

  // Font family: <w:rFonts w:ascii="Calibri" w:hAnsi="..." .../>
  const rFontsMatch = rPrXml.match(/<w:rFonts\b[^>]*>/i);
  let fontFamily = defaults.fontFamily;
  if (rFontsMatch) {
    const tag = rFontsMatch[0];
    const asciiMatch = tag.match(/w:ascii\s*=\s*"([^"]*)"/i);
    const hAnsiMatch = tag.match(/w:hAnsi\s*=\s*"([^"]*)"/i);
    const eastAsiaMatch = tag.match(/w:eastAsia\s*=\s*"([^"]*)"/i);
    const csMatch = tag.match(/w:cs\s*=\s*"([^"]*)"/i);
    fontFamily = asciiMatch?.[1] || hAnsiMatch?.[1] || eastAsiaMatch?.[1] || csMatch?.[1] || defaults.fontFamily;
    // Skip theme references (e.g. w:asciiTheme="minorHAnsi")
    if (fontFamily && /theme/i.test(fontFamily)) fontFamily = defaults.fontFamily;
  }

  // Color: <w:color w:val="1A3C5E"/>
  const colorMatch = rPrXml.match(/<w:color\b[^>]*>/i);
  const color = colorMatch
    ? (parseColor(getWVal(colorMatch[0], "val")) ?? defaults.color)
    : defaults.color;

  // Bold: <w:b/> or <w:b w:val="1"/>
  const bMatch = rPrXml.match(/<w:b\b[^>]*\/?>/i);
  const bold = bMatch ? getWVal(bMatch[0], "val") !== "0" : defaults.bold;

  // Italic: <w:i/>
  const iMatch = rPrXml.match(/<w:i\b[^>]*\/?>/i);
  const italic = iMatch ? getWVal(iMatch[0], "val") !== "0" : defaults.italic;

  // Underline: <w:u .../>
  const underline = hasElement(rPrXml, "w:u") || defaults.underline;

  return { fontSize, fontFamily, color, bold, italic, underline };
}

// ─── Parse paragraph properties (w:pPr) using regex ───
function parseParaProps(
  pPrXml: string | null,
  defaults: DocxParagraphStyle = DEFAULT_PARA_STYLE
): DocxParagraphStyle {
  if (!pPrXml) return { ...defaults, spacing: { ...defaults.spacing }, indent: { ...defaults.indent }, runStyle: { ...defaults.runStyle } };

  // Alignment: <w:jc w:val="center"/>
  const jcMatch = pPrXml.match(/<w:jc\b[^>]*>/i);
  const alignment = jcMatch ? getWVal(jcMatch[0], "val") : defaults.alignment;

  // Spacing: <w:spacing w:before="..." w:after="..." w:line="..."/>
  const spacingMatch = pPrXml.match(/<w:spacing\b[^>]*>/i);
  const spacing = {
    before: spacingMatch ? (twipsToPt(getWVal(spacingMatch[0], "before")) ?? defaults.spacing.before) : defaults.spacing.before,
    after: spacingMatch ? (twipsToPt(getWVal(spacingMatch[0], "after")) ?? defaults.spacing.after) : defaults.spacing.after,
    line: spacingMatch ? (twipsToPt(getWVal(spacingMatch[0], "line")) ?? defaults.spacing.line) : defaults.spacing.line,
  };

  // Indent: <w:ind w:left="..." w:right="..."/>
  const indMatch = pPrXml.match(/<w:ind\b[^>]*>/i);
  const indent = {
    left: indMatch ? (twipsToPt(getWVal(indMatch[0], "left")) ?? defaults.indent.left) : defaults.indent.left,
    right: indMatch ? (twipsToPt(getWVal(indMatch[0], "right")) ?? defaults.indent.right) : defaults.indent.right,
  };

  // Run properties within paragraph properties
  const rPrXml = extractChild(pPrXml, "w:rPr");
  const runStyle = rPrXml !== null
    ? parseRunProps(rPrXml, defaults.runStyle)
    : { ...defaults.runStyle };

  return { alignment, spacing, indent, runStyle };
}

// ─── Parse styles.xml using regex ───
function parseStylesXml(xmlStr: string): { styles: Map<string, DocxStyleDef>; defaultRunStyle: DocxRunStyle; defaultParaStyle: DocxParagraphStyle } {
  const styles = new Map<string, DocxStyleDef>();

  const defaultRunStyle: DocxRunStyle = { ...DEFAULT_RUN_STYLE };
  const defaultParaStyle: DocxParagraphStyle = {
    ...DEFAULT_PARA_STYLE,
    spacing: { ...DEFAULT_PARA_STYLE.spacing },
    indent: { ...DEFAULT_PARA_STYLE.indent },
    runStyle: defaultRunStyle,
  };

  // Parse document defaults: <w:docDefaults>...</w:docDefaults>
  const docDefaultsXml = extractChild(xmlStr, "w:docDefaults");
  if (docDefaultsXml) {
    // Run defaults
    const rPrDefaultXml = extractChild(docDefaultsXml, "w:rPrDefault");
    if (rPrDefaultXml) {
      const rPrXml = extractChild(rPrDefaultXml, "w:rPr");
      if (rPrXml) {
        const parsed = parseRunProps(rPrXml);
        if (parsed.fontSize) defaultRunStyle.fontSize = parsed.fontSize;
        if (parsed.fontFamily) defaultRunStyle.fontFamily = parsed.fontFamily;
        if (parsed.color) defaultRunStyle.color = parsed.color;
      }
    }
    // Paragraph defaults
    const pPrDefaultXml = extractChild(docDefaultsXml, "w:pPrDefault");
    if (pPrDefaultXml) {
      const pPrXml = extractChild(pPrDefaultXml, "w:pPr");
      if (pPrXml) {
        const parsed = parseParaProps(pPrXml);
        if (parsed.spacing.line) defaultParaStyle.spacing.line = parsed.spacing.line;
      }
    }
  }

  // Parse named styles: <w:style w:type="..." w:styleId="...">...</w:style>
  const styleBlocks = extractChildren(xmlStr, "w:style");
  for (const styleBlock of styleBlocks) {
    // Extract styleId from the opening tag — need to find it in the original XML
    // Since extractChildren gives us inner content, we need to look at the original
    // Actually, let's find the styleId from the full tag including attributes
    // We need a different approach: extract full style elements including their opening tags
    continue; // placeholder
  }

  // Better approach: use regex to find all <w:style ...>...</w:style> with their attributes
  const styleFullRe = /<w:style\b([^>]*?)>([\s\S]*?)<\/w:style>/gi;
  let styleMatch: RegExpExecArray | null;
  while ((styleMatch = styleFullRe.exec(xmlStr)) !== null) {
    const attrs = styleMatch[1];
    const content = styleMatch[2];

    const styleId = getAttr(attrs, "w", "styleId") || "";
    if (!styleId) continue;

    // Name: <w:name w:val="..."/>
    const nameMatch = content.match(/<w:name\b[^>]*>/i);
    const name = nameMatch ? getWVal(nameMatch[0], "val") : null;

    const type = getAttr(attrs, "w", "type") || null;

    // basedOn: <w:basedOn w:val="..."/>
    const basedOnMatch = content.match(/<w:basedOn\b[^>]*>/i);
    const basedOn = basedOnMatch ? getWVal(basedOnMatch[0], "val") : null;

    const pPrXml = extractChild(content, "w:pPr");
    const rPrXml = extractChild(content, "w:rPr");

    styles.set(styleId, {
      styleId,
      name,
      type,
      basedOn,
      paragraphProps: pPrXml !== null
        ? parseParaProps(pPrXml, defaultParaStyle)
        : { ...defaultParaStyle, spacing: { ...defaultParaStyle.spacing }, indent: { ...defaultParaStyle.indent }, runStyle: { ...defaultParaStyle.runStyle } },
      runProps: rPrXml !== null
        ? parseRunProps(rPrXml, defaultRunStyle)
        : { ...defaultRunStyle },
    });
  }

  return { styles, defaultRunStyle, defaultParaStyle };
}

// ─── Parse page setup from document.xml using regex ───
function parsePageSetup(xmlStr: string): { margins: { top: number; right: number; bottom: number; left: number }; size: { width: number; height: number } } {
  // Find sectPr (section properties)
  let sectPrXml = extractChild(xmlStr, "w:sectPr");

  // If not found at top level, look inside body
  if (sectPrXml === null) {
    const bodyXml = extractChild(xmlStr, "w:body");
    if (bodyXml) {
      sectPrXml = extractChild(bodyXml, "w:sectPr");
    }
  }

  if (!sectPrXml) {
    return { margins: { top: 48, right: 60, bottom: 52, left: 60 }, size: { width: 612, height: 792 } };
  }

  // Page margins: <w:pgMar w:top="1134" w:right="850" .../>
  const pgMarMatch = sectPrXml.match(/<w:pgMar\b[^>]*>/i);
  const margins = {
    top: pgMarMatch ? (twipsToPt(getWVal(pgMarMatch[0], "top")) ?? 48) : 48,
    right: pgMarMatch ? (twipsToPt(getWVal(pgMarMatch[0], "right")) ?? 60) : 60,
    bottom: pgMarMatch ? (twipsToPt(getWVal(pgMarMatch[0], "bottom")) ?? 52) : 52,
    left: pgMarMatch ? (twipsToPt(getWVal(pgMarMatch[0], "left")) ?? 60) : 60,
  };

  // Page size: <w:pgSz w:w="12240" w:h="15840"/>
  const pgSzMatch = sectPrXml.match(/<w:pgSz\b[^>]*>/i);
  const size = {
    width: pgSzMatch ? (twipsToPt(getWVal(pgSzMatch[0], "w")) ?? 612) : 612,
    height: pgSzMatch ? (twipsToPt(getWVal(pgSzMatch[0], "h")) ?? 792) : 792,
  };

  return { margins, size };
}

// ─── Parse document.xml for content + formatting using regex ───

interface ParagraphInfo {
  text: string;
  style: DocxParagraphStyle;
  effectiveRun: DocxRunStyle;
  isHeading: boolean;
  headingLevel: number | null;
}

function parseDocumentXml(
  xmlStr: string,
  formatData: DocxFormatData
): { paragraphs: ParagraphInfo[]; hasPhoto: boolean; photoBase64: string | null } {
  const paragraphs: ParagraphInfo[] = [];
  let hasPhoto = false;

  // Get body content
  const bodyXml = extractChild(xmlStr, "w:body");
  if (!bodyXml) return { paragraphs, hasPhoto, photoBase64: null };

  // Check for images: <w:drawing>, <wp:inline>, <w:pict>
  if (/<w:drawing\b/i.test(bodyXml)) hasPhoto = true;
  if (/<wp:inline\b/i.test(bodyXml)) hasPhoto = true;
  if (/<w:pict\b/i.test(bodyXml)) hasPhoto = true;

  // Parse all paragraphs: <w:p>...</w:p>
  // Use regex to find all <w:p>...</w:p> blocks including their opening tag attributes
  const paraBlocks = extractChildren(bodyXml, "w:p");

  for (const paraContent of paraBlocks) {
    // Paragraph properties: <w:pPr>...</w:pPr>
    const pPrXml = extractChild(paraContent, "w:pPr");

    // Style reference: <w:pStyle w:val="Heading1"/>
    let styleId: string | null = null;
    if (pPrXml) {
      const pStyleMatch = pPrXml.match(/<w:pStyle\b[^>]*>/i);
      styleId = pStyleMatch ? getWVal(pStyleMatch[0], "val") : null;
    }

    // Resolve style chain (style -> basedOn -> defaults)
    let resolvedParaStyle: DocxParagraphStyle = {
      ...formatData.defaultParaStyle,
      spacing: { ...formatData.defaultParaStyle.spacing },
      indent: { ...formatData.defaultParaStyle.indent },
      runStyle: { ...formatData.defaultParaStyle.runStyle },
    };
    let resolvedRunStyle = { ...formatData.defaultRunStyle };

    if (styleId && formatData.styles.has(styleId)) {
      const styleDef = formatData.styles.get(styleId)!;
      // Merge style properties
      resolvedParaStyle = {
        ...resolvedParaStyle,
        ...styleDef.paragraphProps,
        spacing: { ...resolvedParaStyle.spacing, ...styleDef.paragraphProps.spacing },
        indent: { ...resolvedParaStyle.indent, ...styleDef.paragraphProps.indent },
        runStyle: { ...resolvedParaStyle.runStyle, ...styleDef.paragraphProps.runStyle },
      };
      resolvedRunStyle = { ...resolvedRunStyle, ...styleDef.runProps };

      // Resolve base style
      if (styleDef.basedOn && formatData.styles.has(styleDef.basedOn)) {
        const baseStyle = formatData.styles.get(styleDef.basedOn)!;
        resolvedRunStyle = { ...resolvedRunStyle, ...baseStyle.runProps };
      }
    }

    // Apply direct paragraph formatting (overrides style)
    if (pPrXml) {
      const directPara = parseParaProps(pPrXml, resolvedParaStyle);
      resolvedParaStyle = {
        ...resolvedParaStyle,
        ...directPara,
        spacing: { ...resolvedParaStyle.spacing, ...directPara.spacing },
        indent: { ...resolvedParaStyle.indent, ...directPara.indent },
      };
      if (directPara.runStyle.fontSize) resolvedRunStyle.fontSize = directPara.runStyle.fontSize;
      if (directPara.runStyle.fontFamily) resolvedRunStyle.fontFamily = directPara.runStyle.fontFamily;
      if (directPara.runStyle.color) resolvedRunStyle.color = directPara.runStyle.color;
      if (directPara.runStyle.bold) resolvedRunStyle.bold = true;
    }

    // Detect heading level from style name
    let isHeading = false;
    let headingLevel: number | null = null;
    if (styleId) {
      const headingMatch = styleId.match(/Heading(\d)/i);
      if (headingMatch) {
        isHeading = true;
        headingLevel = parseInt(headingMatch[1]);
      }
      const styleName = formatData.styles.get(styleId)?.name;
      if (styleName && /heading|title/i.test(styleName)) {
        isHeading = true;
        headingLevel = headingLevel || 1;
      }
    }

    // Collect run text with per-run formatting
    const runBlocks = extractChildren(paraContent, "w:r");
    let paraText = "";
    let dominantRunStyle = { ...resolvedRunStyle };
    let maxRunLen = 0;

    for (const runContent of runBlocks) {
      const rPrXml = extractChild(runContent, "w:rPr");
      const runStyle = rPrXml !== null
        ? parseRunProps(rPrXml, resolvedRunStyle)
        : { ...resolvedRunStyle };

      // Get text content from <w:t>...</w:t>
      let runText = extractText(runContent);

      // Check for tab, break
      if (/<w:br\b/i.test(runContent)) runText += "\n";
      if (/<w:tab\b/i.test(runContent)) runText += "\t";

      paraText += runText;

      // Track the dominant run style (by text length)
      if (runText.length > maxRunLen) {
        maxRunLen = runText.length;
        dominantRunStyle = runStyle;
      }
    }

    // Normalize whitespace
    paraText = paraText.replace(/\t/g, "  ").replace(/\n/g, " ").trim();

    if (paraText || pPrXml) {
      paragraphs.push({
        text: paraText,
        style: resolvedParaStyle,
        effectiveRun: dominantRunStyle,
        isHeading,
        headingLevel,
      });
    }
  }

  return { paragraphs, hasPhoto, photoBase64: null };
}

// ─── Mode of array ───
function modeOf(values: number[], tolerance: number = 0.5): number {
  if (values.length === 0) return 11;
  const freq: Record<number, number> = {};
  for (const v of values) {
    const rounded = Math.round(v / tolerance) * tolerance;
    freq[rounded] = (freq[rounded] || 0) + 1;
  }
  return parseFloat(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
}

// ─── Is darker color ───
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

// ─── Main Handler ───
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ── Method 1: Rich XML parsing with JSZip ──
    let useXmlParsing = false;
    let paragraphs: ParagraphInfo[] = [];
    let hasPhoto = false;
    let pageMargins = { top: 48, right: 60, bottom: 52, left: 60 };

    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buffer);

      // Extract styles.xml
      const stylesFile = zip.file("word/styles.xml");
      const stylesXml = stylesFile ? await stylesFile.async("string") : null;

      // Extract document.xml
      const docFile = zip.file("word/document.xml");
      const docXml = docFile ? await docFile.async("string") : null;

      if (docXml) {
        // Parse styles (synchronous — no DOMParser needed)
        const { styles, defaultRunStyle, defaultParaStyle } = stylesXml
          ? parseStylesXml(stylesXml)
          : {
              styles: new Map<string, DocxStyleDef>(),
              defaultRunStyle: { ...DEFAULT_RUN_STYLE },
              defaultParaStyle: {
                ...DEFAULT_PARA_STYLE,
                spacing: { ...DEFAULT_PARA_STYLE.spacing },
                indent: { ...DEFAULT_PARA_STYLE.indent },
                runStyle: { ...DEFAULT_RUN_STYLE },
              },
            };

        // Parse page setup (synchronous)
        const { margins, size } = parsePageSetup(docXml);
        pageMargins = margins;

        // Parse document content (synchronous)
        const formatData: DocxFormatData = {
          defaultRunStyle,
          defaultParaStyle,
          styles,
          pageMargins: margins,
          pageSize: size,
        };

        const result = parseDocumentXml(docXml, formatData);
        paragraphs = result.paragraphs;
        hasPhoto = result.hasPhoto;
        useXmlParsing = true;
      }
    } catch (zipErr) {
      console.warn("JSZip parsing failed, falling back to mammoth:", zipErr);
    }

    // ── Method 2: Fallback to mammoth for text extraction ──
    let text = "";
    if (!useXmlParsing) {
      const mammoth = (await import("mammoth")).default;
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;

      // Check for images
      try {
        const htmlResult = await mammoth.convertToHtml({ buffer });
        if (htmlResult.value.includes("<img") || htmlResult.value.includes("<image")) {
          hasPhoto = true;
        }
      } catch {
        // Ignore
      }
    } else {
      // Build text from XML-parsed paragraphs
      text = paragraphs.map(p => p.text).filter(Boolean).join("\n");
    }

    // ── FORMAT EXTRACTION ──
    if (useXmlParsing && paragraphs.length > 0) {
      // Rich format extraction from XML data

      // 1. Font family — most used font across all paragraphs
      const fontFreq: Record<string, number> = {};
      for (const p of paragraphs) {
        if (p.effectiveRun.fontFamily) {
          const clean = p.effectiveRun.fontFamily;
          fontFreq[clean] = (fontFreq[clean] || 0) + p.text.length;
        }
      }
      const dominantFont = Object.entries(fontFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "Calibri";
      const fontFamily = normalizeFontName(dominantFont);

      // 2. Font sizes — classify by role
      const allSizes = paragraphs
        .filter(p => p.text.trim() && p.effectiveRun.fontSize)
        .map(p => ({ size: p.effectiveRun.fontSize!, bold: p.effectiveRun.bold, text: p.text, isHeading: p.isHeading, headingLevel: p.headingLevel }));

      // Name size = largest font (or heading 1)
      const headingSizes = allSizes.filter(s => s.isHeading && (s.headingLevel === 1 || s.headingLevel === 2));
      const maxHeadingSize = headingSizes.length > 0 ? Math.max(...headingSizes.map(s => s.size)) : 0;
      const maxBodySize = allSizes.length > 0 ? Math.max(...allSizes.map(s => s.size)) : 11;
      const nameSize = maxHeadingSize > 0 ? maxHeadingSize : maxBodySize;

      // Section header size = heading 2/3 or bold text smaller than name
      const sectionCandidates = allSizes.filter(s => (s.isHeading && s.headingLevel && s.headingLevel >= 2) || (s.bold && s.size < nameSize && s.size > 9));
      const sectionSize = sectionCandidates.length > 0
        ? modeOf(sectionCandidates.map(s => s.size))
        : allSizes.filter(s => s.size < nameSize && s.size >= 10).length > 0
          ? modeOf(allSizes.filter(s => s.size < nameSize && s.size >= 10).map(s => s.size))
          : 12;

      // Body size = most common non-bold size
      const bodyCandidates = allSizes.filter(s => !s.bold && s.size <= sectionSize);
      const bodySize = bodyCandidates.length > 0
        ? modeOf(bodyCandidates.map(s => s.size))
        : allSizes.length > 0
          ? modeOf(allSizes.map(s => s.size))
          : 9.5;

      // Entry title size = bold text between section and body
      const entryTitleCandidates = allSizes.filter(s => s.bold && s.size > bodySize && s.size < nameSize);
      const entryTitleSize = entryTitleCandidates.length > 0
        ? modeOf(entryTitleCandidates.map(s => s.size))
        : (bodySize + sectionSize) / 2;

      // Meta size = same as body or slightly smaller
      const metaCandidates = allSizes.filter(s => s.size <= bodySize && s.size >= 7);
      const metaSize = metaCandidates.length > 0 ? modeOf(metaCandidates.map(s => s.size)) : bodySize;

      // 3. Colors — find accent/primary color (non-black)
      // Weight bold/heading text more heavily since heading colors define the resume's visual identity
      const colorFreq: Record<string, number> = {};
      for (const p of paragraphs) {
        if (p.effectiveRun.color && p.effectiveRun.color !== "#000000" && p.text.trim()) {
          // Bold text gets 3x weight, heading/large text gets 2x weight
          let weight = p.text.length;
          if (p.effectiveRun.bold) weight *= 3;
          else if (p.effectiveRun.fontSize && p.effectiveRun.fontSize > (bodySize || 9.5)) weight *= 2;
          colorFreq[p.effectiveRun.color] = (colorFreq[p.effectiveRun.color] || 0) + weight;
        }
      }
      const sortedColors = Object.entries(colorFreq).sort((a, b) => b[1] - a[1]).map(([c]) => c);
      const primaryColor = sortedColors[0] || "#2E2C2C";
      const secondaryColor = sortedColors[1] || "#666464";
      const accentColor = sortedColors.find(c => !isDarkerColor(c)) || primaryColor;

      // 4. Header alignment — check first few paragraphs
      const firstNonEmpty = paragraphs.find(p => p.text.trim());
      const headerAlign: "center" | "left" = firstNonEmpty?.style.alignment === "center" ? "center" : "left";

      // 5. Line height — from paragraph spacing
      const lineValues = paragraphs
        .map(p => p.style.spacing.line)
        .filter((v): v is number => v !== null && v > 0);
      const lineHeight = lineValues.length > 0
        ? Math.round((modeOf(lineValues) / (bodySize || 11)) * 20) / 20
        : 1.5;

      // 6. Show subtitle — check if second line has a different style (like a job title)
      const secondLine = paragraphs.find((p, i) => i > 0 && p.text.trim() && !p.isHeading);
      const showSubtitle = secondLine ? secondLine.effectiveRun.fontSize !== undefined && secondLine.effectiveRun.fontSize! < nameSize && secondLine.effectiveRun.fontSize! > bodySize : false;

      // Parse resume content
      const resumeData = parseResumeText(text);

      const detectedFormat = detectFormatFromPdfMetadata({
        headerAlign,
        hasPhoto,
        fontFamily,
        lineHeight: Math.max(1, Math.min(2.5, lineHeight)),
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
        margins: pageMargins,
        showSubtitle,
        sectionSpacing: 8,
        entrySpacing: 8,
        dividerWeight: 0.75,
        footer: { showPageNumbers: false, showName: false, customText: "" },
      });

      return NextResponse.json({
        success: true,
        data: resumeData,
        format: detectedFormat,
        rawText: text,
      });
    }

    // ── Fallback: mammoth-only with basic format detection ──
    const resumeData = parseResumeText(text);
    const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
    let headerAlign: "center" | "left" = "left";

    if (lines.length > 0 && lines[0].length < 40) {
      headerAlign = "center";
    }

    const detectedFormat = detectFormatFromPdfMetadata({
      headerAlign,
      hasPhoto,
      fontFamily: "Calibri", // Default DOCX font
      fontSizes: {
        name: 16,
        section: 13,
        body: 11,
        meta: 10,
        entryTitle: 11,
      },
      margins: { top: 72, right: 72, bottom: 72, left: 72 }, // Default Word margins (1 inch = 72pt)
    });

    return NextResponse.json({
      success: true,
      data: resumeData,
      format: detectedFormat,
      rawText: text,
    });
  } catch (error: unknown) {
    console.error("DOCX import error:", error);
    const message = error instanceof Error ? error.message : "Failed to parse DOCX";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
