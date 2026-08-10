/**
 * Smart Resume Parser
 * Takes raw text from PDF/DOCX and auto-detects sections,
 * personal info, and structure to populate the resume builder.
 */

import {
  ResumeData,
  PersonalInfo,
  ResumeSection,
  SectionType,
  SectionEntry,
  SECTION_LABELS,
} from "@/lib/resume-types";

// ─── Section Detection Patterns ───
const SECTION_PATTERNS: { type: SectionType; patterns: RegExp[] }[] = [
  { type: "experience", patterns: [/work\s*experience/i, /professional\s*experience/i, /employment/i, /work\s*history/i] },
  { type: "education", patterns: [/education/i, /academic/i, /qualification/i] },
  { type: "skills", patterns: [/skills/i, /technical\s*skills/i, /competenc/i, /proficien/i, /technologies/i] },
  { type: "projects", patterns: [/projects/i, /portfolio/i, /key\s*projects/i] },
  { type: "certifications", patterns: [/certificat/i, /license/i, /credential/i] },
  { type: "languages", patterns: [/languages/i, /language\s*proficiency/i] },
  { type: "achievements", patterns: [/achievement/i, /award/i, /honors/i, /accomplishment/i] },
  { type: "publications", patterns: [/publication/i, /papers/i, /research/i] },
  { type: "volunteer", patterns: [/volunteer/i, /community\s*service/i] },
  { type: "interests", patterns: [/interests/i, /hobbies/i, /activities/i] },
  { type: "references", patterns: [/references/i, /referee/i] },
];

// ─── Personal Info Extraction ───
function extractPersonalInfo(lines: string[]): { personal: PersonalInfo; summary: string; headerEndIndex: number } {
  const personal: PersonalInfo = {
    fullName: "",
    title: "",
    phone: "",
    email: "",
    address: "",
    website: "",
    linkedin: "",
    github: "",
    portfolio: "",
  };

  let headerEndIndex = 0;
  let summary = "";

  // Extract email
  const emailRegex = /[\w.+-]+@[\w-]+\.[\w.]+/;
  // Extract phone
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}/;
  // Extract LinkedIn
  const linkedinRegex = /linkedin\.com\/in\/[\w-]+/i;
  // Extract GitHub
  const githubRegex = /github\.com\/[\w-]+/i;
  // Extract URL
  const urlRegex = /https?:\/\/[\w.-]+[\w/.-]*/i;

  // The first few lines are usually the header
  const maxHeaderLines = Math.min(lines.length, 10);

  for (let i = 0; i < maxHeaderLines; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // First non-empty, non-meta line is likely the name
    if (!personal.fullName && !emailRegex.test(line) && !phoneRegex.test(line) && !linkedinRegex.test(line) && !githubRegex.test(line) && line.length > 2 && line.length < 60 && !line.includes("|") && !/^[A-Z\s]+$/.test(line) === false || (!personal.fullName && i === 0)) {
      // Check if it looks like a name (2-4 words, mostly letters)
      const words = line.split(/\s+/).filter(w => w.length > 0);
      if (words.length >= 2 && words.length <= 6 && words.every(w => /^[A-Z.a-z-]+$/.test(w))) {
        personal.fullName = line;
        headerEndIndex = i + 1;
        continue;
      }
    }

    // Try to extract metadata from the line
    const emailMatch = line.match(emailRegex);
    if (emailMatch && !personal.email) {
      personal.email = emailMatch[0];
      headerEndIndex = i + 1;
      continue;
    }

    const phoneMatch = line.match(phoneRegex);
    if (phoneMatch && !personal.phone) {
      personal.phone = phoneMatch[0].trim();
      headerEndIndex = i + 1;
      continue;
    }

    const linkedinMatch = line.match(linkedinRegex);
    if (linkedinMatch && !personal.linkedin) {
      personal.linkedin = linkedinMatch[0];
      headerEndIndex = i + 1;
      continue;
    }

    const githubMatch = line.match(githubRegex);
    if (githubMatch && !personal.github) {
      personal.github = githubMatch[0];
      headerEndIndex = i + 1;
      continue;
    }

    // Check for address-like patterns (city, state, zip)
    if (!personal.address && /\d{5,6}/.test(line) && /maharashtra|karnataka|tamil|delhi|gujarat|bengal|rajasthan|mp|up/i.test(line)) {
      personal.address = line.replace(/[,\s]*\d{5,6}.*$/, "$&").trim() || line.trim();
      headerEndIndex = i + 1;
      continue;
    }

    // Generic location pattern
    if (!personal.address && /^(.*?,\s*\w+\s*\d{4,6})/.test(line) && !personal.email && !personal.phone) {
      personal.address = line.trim();
      headerEndIndex = i + 1;
      continue;
    }
  }

  // If we didn't find a name, take the first line
  if (!personal.fullName && lines.length > 0) {
    personal.fullName = lines[0].trim();
    headerEndIndex = 1;
  }

  // Extract summary (text between header and first section)
  const firstSectionIdx = findFirstSectionIndex(lines);
  if (firstSectionIdx > headerEndIndex) {
    const summaryLines: string[] = [];
    for (let i = headerEndIndex; i < firstSectionIdx; i++) {
      const line = lines[i].trim();
      // Skip lines that are just metadata we already extracted
      if (line === personal.phone || line === personal.email || line === personal.address) continue;
      if (personal.linkedin && line.includes(personal.linkedin)) continue;
      if (personal.github && line.includes(personal.github)) continue;
      // Skip section headers
      if (isSectionHeader(line)) continue;
      if (line) summaryLines.push(line);
    }
    summary = summaryLines.join(" ").trim();
  }

  return { personal, summary, headerEndIndex };
}

function isSectionHeader(line: string): boolean {
  for (const { patterns } of SECTION_PATTERNS) {
    for (const pat of patterns) {
      if (pat.test(line)) return true;
    }
  }
  // Also check "About Me" / "Summary" / "Profile"
  if (/^(about\s*me|summary|profile|objective|career\s*objective)/i.test(line)) return true;
  return false;
}

function findFirstSectionIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (isSectionHeader(lines[i].trim())) return i;
  }
  return -1;
}

// ─── Section Splitting ───
interface RawSection {
  type: SectionType | "summary";
  title: string;
  lines: string[];
}

function splitIntoSections(lines: string[]): RawSection[] {
  const sections: RawSection[] = [];
  let currentSection: RawSection | null = null;
  let inSummary = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check if this line is a section header
    let matched = false;
    for (const { type, patterns } of SECTION_PATTERNS) {
      for (const pat of patterns) {
        if (pat.test(line)) {
          if (currentSection) sections.push(currentSection);
          currentSection = { type, title: line, lines: [] };
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    // Check for summary/about me
    if (!matched && /^(about\s*me|summary|profile|objective|career\s*objective|professional\s*summary)/i.test(line)) {
      if (currentSection) sections.push(currentSection);
      currentSection = { type: "summary", title: line, lines: [] };
      inSummary = true;
      matched = true;
    }

    if (!matched && currentSection) {
      currentSection.lines.push(line);
    } else if (!matched && !currentSection) {
      // Content before any section — likely part of header
      // Skip, already handled in personal info extraction
    }
  }

  if (currentSection) sections.push(currentSection);
  return sections;
}

// ─── Entry Parsing ───
function parseEntries(sectionType: SectionType, lines: string[]): SectionEntry[] {
  const entries: SectionEntry[] = [];

  if (sectionType === "skills") {
    // Skills are often formatted as "Category: item1, item2, item3"
    // or just comma-separated lists
    const entries2 = parseSkillsEntries(lines);
    return entries2;
  }

  if (sectionType === "languages") {
    return lines.filter(Boolean).map((line) => ({
      id: crypto.randomUUID(),
      title: line.replace(/[—–-]\s*(Native|Fluent|Advanced|Intermediate|Basic|Beginner|Expert|Proficient).*$/i, "").trim(),
      subtitle: "",
      dateRange: "",
      description: "",
      bullets: [],
      category: "",
      items: "",
      issuer: "",
      proficiency: (line.match(/[—–-]\s*(Native|Fluent|Advanced|Intermediate|Basic|Beginner|Expert|Proficient)/i) || [])[1] || "",
      link: "",
      linkLabel: "",
    }));
  }

  if (sectionType === "interests") {
    // Combine all lines into one entry
    return [{
      id: crypto.randomUUID(),
      title: lines.join(", "),
      subtitle: "", dateRange: "", description: "", bullets: [], category: "", items: "", issuer: "", proficiency: "", link: "", linkLabel: "",
    }];
  }

  // For experience, education, projects, etc. — detect entry boundaries
  // Heuristic: a date range or a bold/title-like line starts a new entry
  const datePattern = /\d{4}\s*[-–—]\s*(\d{4}|present|current|now)/i;
  const entryStartPattern = /^[A-Z][\w\s]+\s*\|/; // "Company | Date" format

  let currentEntry: SectionEntry | null = null;
  let collectingBullets = false;

  for (const line of lines) {
    const isBullet = /^\s*[•·●◦►▸▹\-*]/.test(line) || /^\s*\d+[.)]\s/.test(line);
    const hasDate = datePattern.test(line);
    const looksLikeTitle = !isBullet && !hasDate && line.length < 100 && line === line.trim() && /^[A-Z]/.test(line) && !line.endsWith(".");

    if ((hasDate || (looksLikeTitle && !isBullet)) && !collectingBullets) {
      // New entry
      if (currentEntry) entries.push(currentEntry);

      const dateMatch = line.match(datePattern);
      const cleanLine = line.replace(datePattern, "").replace(/\|/g, "").trim();

      currentEntry = {
        id: crypto.randomUUID(),
        title: "",
        subtitle: cleanLine,
        dateRange: dateMatch ? dateMatch[0] : "",
        description: "",
        bullets: [],
        category: "",
        items: "",
        issuer: "",
        proficiency: "",
        link: "",
        linkLabel: "",
      };
      collectingBullets = false;
    } else if (isBullet && currentEntry) {
      const bulletText = line.replace(/^\s*[•·●◦►▸▹\-*]\s*/, "").replace(/^\s*\d+[.)]\s*/, "").trim();
      if (bulletText) {
        currentEntry.bullets.push(bulletText);
      }
      collectingBullets = true;
    } else if (currentEntry) {
      // If we have a current entry and this isn't a bullet, it might be:
      // - The title of the entry
      // - A continuation of description
      if (!currentEntry.title && looksLikeTitle) {
        currentEntry.title = line;
      } else if (!currentEntry.title && !currentEntry.subtitle) {
        currentEntry.subtitle = line;
      } else if (currentEntry.bullets.length === 0 && !isBullet) {
        // Might be a description line or a title
        if (!currentEntry.title) {
          currentEntry.title = line;
        } else {
          currentEntry.bullets.push(line);
        }
      } else {
        // Add as bullet text
        const clean = line.replace(/^\s*[•·●◦►▸▹\-*]\s*/, "").trim();
        if (clean) currentEntry.bullets.push(clean);
        collectingBullets = true;
      }
    } else {
      // No current entry — start one
      currentEntry = {
        id: crypto.randomUUID(),
        title: line,
        subtitle: "",
        dateRange: "",
        description: "",
        bullets: [],
        category: "",
        items: "",
        issuer: "",
        proficiency: "",
        link: "",
        linkLabel: "",
      };
    }
  }

  if (currentEntry) entries.push(currentEntry);
  return entries;
}

function parseSkillsEntries(lines: string[]): SectionEntry[] {
  const entries: SectionEntry[] = [];

  for (const line of lines) {
    // Try "Category: items" or "Category — items"
    const catMatch = line.match(/^([\w\s/.]+?)\s*[:—–-]\s*(.+)$/);
    if (catMatch) {
      entries.push({
        id: crypto.randomUUID(),
        title: "",
        subtitle: "",
        dateRange: "",
        description: "",
        bullets: [],
        category: catMatch[1].trim(),
        items: catMatch[2].trim(),
        issuer: "",
        proficiency: "",
        link: "",
        linkLabel: "",
      });
    } else if (line.includes(",") && !line.includes(":")) {
      // Just a comma-separated list — put in first entry's items or create one
      if (entries.length === 0) {
        entries.push({
          id: crypto.randomUUID(),
          title: "",
          subtitle: "",
          dateRange: "",
          description: "",
          bullets: [],
          category: "Skills",
          items: line.trim(),
          issuer: "",
          proficiency: "",
          link: "",
          linkLabel: "",
        });
      } else {
        // Append to last entry
        entries[entries.length - 1].items += ", " + line.trim();
      }
    } else {
      // Single item
      if (entries.length === 0) {
        entries.push({
          id: crypto.randomUUID(),
          title: "",
          subtitle: "",
          dateRange: "",
          description: "",
          bullets: [],
          category: "Other",
          items: line.trim(),
          issuer: "",
          proficiency: "",
          link: "",
          linkLabel: "",
        });
      }
    }
  }

  return entries;
}

// ─── Format Detection from PDF ───
export interface DetectedFormat {
  hasPhoto: boolean;
  colors: { primary: string; secondary: string; accent: string; divider: string };
  margins: { top: number; right: number; bottom: number; left: number };
  fontSizes: { name: number; section: number; body: number; meta: number; entryTitle: number };
  fontFamily: string;
  lineHeight: number;
  nameLetterSpacing: number;
  sectionLetterSpacing: number;
  headerAlign: "center" | "left";
  sectionSpacing: number;
  entrySpacing: number;
  dividerWeight: number;
  footer: { showPageNumbers: boolean; showName: boolean; customText: string };
  showSubtitle: boolean;
}

export function detectFormatFromPdfMetadata(metadata: {
  colors?: { primary?: string; secondary?: string; accent?: string; divider?: string };
  margins?: { top: number; right: number; bottom: number; left: number };
  fontSizes?: { name?: number; section?: number; body?: number; meta?: number; entryTitle?: number };
  fontFamily?: string;
  lineHeight?: number;
  nameLetterSpacing?: number;
  sectionLetterSpacing?: number;
  headerAlign?: "center" | "left";
  hasPhoto?: boolean;
  sectionSpacing?: number;
  entrySpacing?: number;
  dividerWeight?: number;
  footer?: { showPageNumbers: boolean; showName: boolean; customText: string };
  showSubtitle?: boolean;
}): DetectedFormat {
  return {
    hasPhoto: metadata.hasPhoto || false,
    colors: {
      primary: metadata.colors?.primary || "#2E2C2C",
      secondary: metadata.colors?.secondary || "#666464",
      accent: metadata.colors?.accent || metadata.colors?.primary || "#2E2C2C",
      divider: metadata.colors?.divider || metadata.colors?.primary || "#2E2C2C",
    },
    margins: metadata.margins || { top: 48, right: 60, bottom: 52, left: 60 },
    fontSizes: {
      name: metadata.fontSizes?.name || 26,
      section: metadata.fontSizes?.section || 12,
      body: metadata.fontSizes?.body || 9.5,
      meta: metadata.fontSizes?.meta || metadata.fontSizes?.body || 9.5,
      entryTitle: metadata.fontSizes?.entryTitle || 10.5,
    },
    fontFamily: metadata.fontFamily || "Inter",
    lineHeight: metadata.lineHeight || 1.5,
    nameLetterSpacing: metadata.nameLetterSpacing ?? 2.5,
    sectionLetterSpacing: metadata.sectionLetterSpacing ?? 1,
    headerAlign: metadata.headerAlign || "center",
    sectionSpacing: metadata.sectionSpacing ?? 8,
    entrySpacing: metadata.entrySpacing ?? 8,
    dividerWeight: metadata.dividerWeight ?? 0.75,
    footer: metadata.footer || { showPageNumbers: true, showName: true, customText: "" },
    showSubtitle: metadata.showSubtitle ?? true,
  };
}

// ─── Font Name Normalization ───
// Maps raw PDF/DOCX font names to clean CSS font family names
export function normalizeFontName(raw: string): string {
  if (!raw) return "Inter";
  const lower = raw.toLowerCase().replace(/[-_+]/g, " ");

  // Direct mappings for common resume fonts
  const fontMap: Record<string, string> = {
    "arial": "Arial",
    "arialmt": "Arial",
    "arial unicode ms": "Arial",
    "helvetica": "Helvetica",
    "timesnewroman": "Times New Roman",
    "timesnewromanpsmt": "Times New Roman",
    "times-roman": "Times New Roman",
    "calibri": "Calibri",
    "calibrimt": "Calibri",
    "cambria": "Cambria",
    "cambriamath": "Cambria",
    "georgia": "Georgia",
    "verdana": "Verdana",
    "trebuchet": "Trebuchet MS",
    "trebuchetms": "Trebuchet MS",
    "garamond": "Garamond",
    "book antiqua": "Book Antiqua",
    "palatino": "Palatino",
    "palatino linotype": "Palatino Linotype",
    "century": "Century",
    "century gothic": "Century Gothic",
    "franklin": "Franklin Gothic",
    "roboto": "Roboto",
    "opensans": "Open Sans",
    "open sans": "Open Sans",
    "lato": "Lato",
    "montserrat": "Montserrat",
    "raleway": "Raleway",
    "ptsans": "PT Sans",
    "pt sans": "PT Sans",
    "ptserif": "PT Serif",
    "pt serif": "PT Serif",
    "nunito": "Nunito",
    "source sans": "Source Sans Pro",
    "sourcesanspro": "Source Sans Pro",
    "dejavusans": "DejaVu Sans",
    "dejavu sans": "DejaVu Sans",
    "dejavuserif": "DejaVu Serif",
    "dejavu serif": "DejaVu Serif",
    "liberationsans": "Liberation Sans",
    "liberation sans": "Liberation Sans",
    "liberationserif": "Liberation Serif",
    "liberation serif": "Liberation Serif",
    "noto sans": "Noto Sans",
    "notosans": "Noto Sans",
    "notoserif": "Noto Serif",
    "noto serif": "Noto Serif",
    "rpbolliviamtstandard": "Bolivia",
    "gill sans": "Gill Sans",
    "gillsans": "Gill Sans",
    "consolas": "Consolas",
    "courier": "Courier",
    "couriernew": "Courier New",
    "courier new": "Courier New",
    "sansserif": "sans-serif",
    "serif": "serif",
    "monospace": "monospace",
  };

  // Try exact lowercase match
  const cleaned = lower.replace(/\s+/g, "");
  if (fontMap[cleaned]) return fontMap[cleaned];
  if (fontMap[lower]) return fontMap[lower];

  // Try partial match
  for (const [key, value] of Object.entries(fontMap)) {
    if (lower.includes(key) || key.includes(lower.replace(/\s/g, ""))) {
      return value;
    }
  }

  // Return the original with some cleanup
  return raw.replace(/^([a-z])/i, (_, c) => c.toUpperCase());
}

// ─── Main Parse Function ───
export function parseResumeText(rawText: string): ResumeData {
  const lines = rawText.split(/\n/).map((l) => l.trim());

  // Extract personal info from header
  const { personal, summary, headerEndIndex } = extractPersonalInfo(lines);

  // Split remaining content into sections
  const rawSections = splitIntoSections(lines);

  // Convert raw sections to ResumeSection[]
  const sections: ResumeSection[] = [];

  for (const raw of rawSections) {
    if (raw.type === "summary") continue; // Already handled

    const entries = parseEntries(raw.type, raw.lines);
    sections.push({
      id: crypto.randomUUID(),
      type: raw.type,
      title: raw.title || SECTION_LABELS[raw.type],
      visible: true,
      entries,
    });
  }

  // Ensure at least Education and Skills sections exist
  if (!sections.find((s) => s.type === "education")) {
    sections.unshift({
      id: crypto.randomUUID(),
      type: "education",
      title: "Education",
      visible: true,
      entries: [],
    });
  }
  if (!sections.find((s) => s.type === "skills")) {
    sections.push({
      id: crypto.randomUUID(),
      type: "skills",
      title: "Skills",
      visible: true,
      entries: [],
    });
  }

  return { personal, summary, sections };
}
