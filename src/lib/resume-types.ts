// ─── Resume Data Types ───

export type SectionType =
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "languages"
  | "achievements"
  | "publications"
  | "volunteer"
  | "interests"
  | "references"
  | "custom";

export const SECTION_LABELS: Record<SectionType, string> = {
  experience: "Work Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  languages: "Languages",
  achievements: "Achievements",
  publications: "Publications",
  volunteer: "Volunteer Work",
  interests: "Interests",
  references: "References",
  custom: "Custom Section",
};

export const ALL_SECTION_TYPES: SectionType[] = [
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "languages",
  "achievements",
  "publications",
  "volunteer",
  "interests",
  "references",
  "custom",
];

export interface PersonalInfo {
  fullName: string;
  title: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface SectionEntry {
  id: string;
  title: string;
  subtitle: string;
  dateRange: string;
  description: string;
  bullets: string[];
  category: string;       // for skills grouping
  items: string;          // for skills items (comma-separated)
  issuer: string;         // for certifications
  proficiency: string;    // for languages
  link: string;
  linkLabel: string;
}

export interface ResumeSection {
  id: string;
  type: SectionType;
  title: string;         // custom title override
  visible: boolean;
  entries: SectionEntry[];
}

export interface ResumeData {
  personal: PersonalInfo;
  summary: string;
  sections: ResumeSection[];
}

// ─── Format Types ───

export interface ResumeFormat {
  margins: { top: number; right: number; bottom: number; left: number };
  fonts: {
    family: string;
    nameSize: number;
    sectionSize: number;
    bodySize: number;
    metaSize: number;
    entryTitleSize: number;
    lineHeight: number;
    nameLetterSpacing: number;
    sectionLetterSpacing: number;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    divider: string;
  };
  header: {
    align: "center" | "left";
    showSubtitle: boolean;
  };
  footer: {
    showPageNumbers: boolean;
    showName: boolean;
    customText: string;
  };
  pageSize: "a4" | "letter";
  sectionSpacing: number;
  entrySpacing: number;
  dividerWeight: number;
}

// ─── Profile Type ───

export interface ResumeProfile {
  id: string;
  name: string;
  data: ResumeData;
  format: ResumeFormat;
  createdAt: number;
  updatedAt: number;
}

// ─── Defaults ───

export const DEFAULT_PERSONAL: PersonalInfo = {
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

export const DEFAULT_FORMAT: ResumeFormat = {
  margins: { top: 48, right: 60, bottom: 52, left: 60 },
  fonts: {
    family: "Inter",
    nameSize: 26,
    sectionSize: 12,
    bodySize: 9.5,
    metaSize: 9.5,
    entryTitleSize: 10.5,
    lineHeight: 1.5,
    nameLetterSpacing: 2.5,
    sectionLetterSpacing: 1,
  },
  colors: {
    primary: "#2E2C2C",
    secondary: "#666464",
    accent: "#2E2C2C",
    divider: "#2E2C2C",
  },
  header: {
    align: "center",
    showSubtitle: true,
  },
  footer: {
    showPageNumbers: true,
    showName: true,
    customText: "",
  },
  pageSize: "a4",
  sectionSpacing: 8,
  entrySpacing: 8,
  dividerWeight: 0.75,
};

export function createEntry(partial?: Partial<SectionEntry>): SectionEntry {
  return {
    id: crypto.randomUUID(),
    title: "",
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
    ...partial,
  };
}

export function createSection(type: SectionType, partial?: Partial<ResumeSection>): ResumeSection {
  return {
    id: crypto.randomUUID(),
    type,
    title: SECTION_LABELS[type],
    visible: true,
    entries: [],
    ...partial,
  };
}

export function createDefaultData(): ResumeData {
  return {
    personal: { ...DEFAULT_PERSONAL },
    summary: "",
    sections: [
      createSection("education"),
      createSection("skills"),
      createSection("projects"),
    ],
  };
}

export function createDefaultProfile(name: string = "My Resume"): ResumeProfile {
  return {
    id: crypto.randomUUID(),
    name,
    data: createDefaultData(),
    format: { ...DEFAULT_FORMAT },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
