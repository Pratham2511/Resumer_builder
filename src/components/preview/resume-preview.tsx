"use client";

import React, { forwardRef } from "react";
import {
  ResumeData,
  ResumeFormat,
  ResumeSection,
  SectionEntry,
  SectionType,
} from "@/lib/resume-types";

interface ResumePreviewProps {
  data: ResumeData;
  format: ResumeFormat;
  forPdf?: boolean;
}

const PAGE_SIZES = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};

function SectionRenderer({ section, fmt }: { section: ResumeSection; fmt: ResumeFormat }) {
  if (!section.visible || section.entries.length === 0) return null;
  const isSkills = section.type === "skills";
  const isLanguages = section.type === "languages";
  const isInterests = section.type === "interests";
  const isSimple = isSkills || isLanguages || isInterests;

  return (
    <>
      <hr style={{ border: "none", borderTop: `${fmt.dividerWeight}pt solid ${fmt.colors.divider}`, margin: `${fmt.sectionSpacing}pt 0 0 0` }} />
      <div style={{ fontSize: `${fmt.fonts.sectionSize}pt`, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: `${fmt.fonts.sectionLetterSpacing}px`, color: fmt.colors.primary, marginBottom: "6pt", marginTop: "1pt" }}>
        {section.title}
      </div>
      {isSimple ? <SimpleSection section={section} fmt={fmt} /> : <DetailedSection section={section} fmt={fmt} />}
    </>
  );
}

function SimpleSection({ section, fmt }: { section: ResumeSection; fmt: ResumeFormat }) {
  if (section.type === "skills") {
    const categories = section.entries.filter((e) => e.category.trim());
    if (categories.length === 0) return null;
    const cols = Math.min(categories.length, 3);
    return (
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "3pt 18pt", fontSize: `${fmt.fonts.bodySize}pt`, color: fmt.colors.primary }}>
        {categories.map((entry) => (
          <div key={entry.id}><strong>{entry.category}</strong><br />{entry.items}</div>
        ))}
      </div>
    );
  }
  if (section.type === "languages") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "4pt 16pt", fontSize: `${fmt.fonts.bodySize}pt`, color: fmt.colors.primary }}>
        {section.entries.map((entry) => (
          <span key={entry.id}><strong>{entry.title}</strong>{entry.proficiency ? ` — ${entry.proficiency}` : ""}</span>
        ))}
      </div>
    );
  }
  return (
    <div style={{ fontSize: `${fmt.fonts.bodySize}pt`, color: fmt.colors.primary }}>
      {section.entries.map((e) => e.title).filter(Boolean).join(", ")}
    </div>
  );
}

function DetailedSection({ section, fmt }: { section: ResumeSection; fmt: ResumeFormat }) {
  return (
    <>{section.entries.map((entry, idx) => (
      <EntryRenderer key={entry.id} entry={entry} type={section.type} fmt={fmt} isLast={idx === section.entries.length - 1} />
    ))}</>
  );
}

function EntryRenderer({ entry, type, fmt, isLast }: { entry: SectionEntry; type: SectionType; fmt: ResumeFormat; isLast: boolean }) {
  const metaParts = [entry.subtitle, entry.dateRange, entry.issuer].filter(Boolean);
  return (
    <div style={{ marginBottom: isLast ? 0 : `${fmt.entrySpacing}pt` }}>
      {metaParts.length > 0 && (
        <div style={{ fontSize: `${fmt.fonts.metaSize}pt`, color: fmt.colors.secondary, fontWeight: 600, marginBottom: "1pt" }}>
          {metaParts.join(" | ")}
        </div>
      )}
      {entry.title && (
        <div style={{ fontSize: `${fmt.fonts.entryTitleSize}pt`, fontWeight: 700, color: fmt.colors.primary, marginBottom: "2pt" }}>
          {entry.title}
          {entry.linkLabel && entry.link && (
            <span style={{ fontSize: `${fmt.fonts.metaSize}pt`, fontWeight: 400, color: fmt.colors.secondary, marginLeft: "6pt" }}>{entry.linkLabel}</span>
          )}
        </div>
      )}
      {entry.description && (
        <div style={{ fontSize: `${fmt.fonts.bodySize}pt`, color: fmt.colors.primary, lineHeight: fmt.fonts.lineHeight, textAlign: "justify" as const, marginBottom: "2pt" }}>
          {entry.description}
        </div>
      )}
      {entry.bullets.filter(Boolean).length > 0 && (
        <ul style={{ paddingLeft: "15px", fontSize: `${fmt.fonts.bodySize}pt`, color: fmt.colors.primary, lineHeight: fmt.fonts.lineHeight, margin: 0 }}>
          {entry.bullets.filter(Boolean).map((bullet, i) => (
            <li key={i} style={{ marginBottom: "0.5pt", textAlign: "justify" as const }}>{bullet}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ResumePreview = forwardRef<HTMLDivElement, ResumePreviewProps>(
  ({ data, format: fmt, forPdf = false }, ref) => {
    const pageSize = PAGE_SIZES[fmt.pageSize];
    const pad = fmt.margins;
    const visibleSections = data.sections.filter((s) => s.visible && s.entries.length > 0);
    const hasSummary = data.summary.trim().length > 0;
    const contactItems = [data.personal.phone, data.personal.email, data.personal.address].filter(Boolean);
    const linkItems = [data.personal.website, data.personal.linkedin, data.personal.github, data.personal.portfolio].filter(Boolean);

    const baseStyle: React.CSSProperties = {
      width: `${pageSize.width}mm`,
      minHeight: `${pageSize.height}mm`,
      padding: `${pad.top}pt ${pad.right}pt ${pad.bottom}pt ${pad.left}pt`,
      background: "#fff",
      color: fmt.colors.primary,
      fontFamily: `'${fmt.fonts.family}', 'Inter', sans-serif`,
      fontSize: `${fmt.fonts.bodySize}pt`,
      lineHeight: fmt.fonts.lineHeight,
      position: "relative" as const,
      ...(forPdf ? {} : { boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }),
    };

    const showFooter = fmt.footer.showName || fmt.footer.showPageNumbers || fmt.footer.customText;

    return (
      <div ref={ref} style={baseStyle}>
        {/* Header */}
        <div style={{ textAlign: fmt.header.align as "center" | "left", marginBottom: "10pt" }}>
          {data.personal.fullName && (
            <div style={{ fontSize: `${fmt.fonts.nameSize}pt`, fontWeight: 700, letterSpacing: `${fmt.fonts.nameLetterSpacing}px`, textTransform: "uppercase" as const, color: fmt.colors.primary, lineHeight: 1.15, marginBottom: "6pt" }}>
              {data.personal.fullName}
            </div>
          )}
          {fmt.header.showSubtitle && data.personal.title && (
            <div style={{ fontSize: `${fmt.fonts.sectionSize + 2}pt`, fontWeight: 600, color: fmt.colors.primary, marginBottom: "6pt" }}>{data.personal.title}</div>
          )}
          {(contactItems.length > 0 || linkItems.length > 0) && (
            <div style={{ display: "flex", justifyContent: fmt.header.align === "center" ? "center" : "flex-start", flexWrap: "wrap" as const, gap: "4pt 16pt", fontSize: `${fmt.fonts.metaSize}pt`, color: fmt.colors.secondary, marginTop: "4pt" }}>
              {contactItems.map((item, i) => <span key={i}>{item}</span>)}
              {linkItems.map((item, i) => <span key={`l${i}`}>{item}</span>)}
            </div>
          )}
        </div>

        {/* Summary */}
        {hasSummary && (
          <>
            <hr style={{ border: "none", borderTop: `${fmt.dividerWeight}pt solid ${fmt.colors.divider}`, margin: `${fmt.sectionSpacing}pt 0 0 0` }} />
            <div style={{ fontSize: `${fmt.fonts.sectionSize}pt`, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: `${fmt.fonts.sectionLetterSpacing}px`, color: fmt.colors.primary, marginBottom: "6pt", marginTop: "1pt" }}>About Me</div>
            <p style={{ fontSize: `${fmt.fonts.bodySize}pt`, color: fmt.colors.primary, lineHeight: fmt.fonts.lineHeight, textAlign: "justify" as const, margin: 0 }}>{data.summary}</p>
          </>
        )}

        {/* Sections */}
        {visibleSections.map((section) => (
          <SectionRenderer key={section.id} section={section} fmt={fmt} />
        ))}

        {/* Footer */}
        {showFooter && (
          <div style={{ position: "absolute" as const, bottom: "22pt", left: `${pad.left}pt`, right: `${pad.right}pt`, display: "flex", justifyContent: "space-between", fontSize: "7pt", color: "#aaa", borderTop: "0.4pt solid #ddd", paddingTop: "3pt" }}>
            <span>{fmt.footer.showName && data.personal.fullName ? data.personal.fullName : ""}</span>
            <span>{fmt.footer.customText || ""}</span>
          </div>
        )}
      </div>
    );
  }
);

ResumePreview.displayName = "ResumePreview";
export default ResumePreview;
