"use client";

import React, { useState } from "react";
import { useResumeStore } from "@/lib/resume-store";
import { ResumeSection, SectionType, ALL_SECTION_TYPES, SECTION_LABELS, SectionEntry } from "@/lib/resume-types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronUp, ChevronDown, Plus, Trash2, GripVertical, Eye, EyeOff } from "lucide-react";

// ─── Personal Info Editor ───
export function PersonalInfoEditor() {
  const profile = useResumeStore((s) => s.getActiveProfile());
  const updatePersonal = useResumeStore((s) => s.updatePersonal);
  const updateSummary = useResumeStore((s) => s.updateSummary);
  if (!profile) return null;
  const p = profile.data.personal;

  const fields = [
    { key: "fullName", label: "Full Name", placeholder: "John Doe" },
    { key: "title", label: "Job Title", placeholder: "Software Developer" },
    { key: "phone", label: "Phone", placeholder: "+91 1234567890" },
    { key: "email", label: "Email", placeholder: "john@example.com" },
    { key: "address", label: "Address", placeholder: "City, State" },
    { key: "website", label: "Website", placeholder: "https://..." },
    { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/..." },
    { key: "github", label: "GitHub", placeholder: "github.com/..." },
    { key: "portfolio", label: "Portfolio", placeholder: "https://..." },
  ] as const;

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.key}>
          <Label className="text-xs text-muted-foreground mb-1">{f.label}</Label>
          <Input
            value={p[f.key as keyof typeof p] as string}
            onChange={(e) => updatePersonal({ [f.key]: e.target.value })}
            placeholder={f.placeholder}
            className="h-8 text-sm"
          />
        </div>
      ))}
      <div>
        <Label className="text-xs text-muted-foreground mb-1">Professional Summary</Label>
        <Textarea
          value={profile.data.summary}
          onChange={(e) => updateSummary(e.target.value)}
          placeholder="Brief professional summary..."
          rows={4}
          className="text-sm resize-none"
        />
      </div>
    </div>
  );
}

// ─── Entry Editor ───
function EntryEditor({ sectionId, entry, type }: { sectionId: string; entry: SectionEntry; type: SectionType }) {
  const updateEntry = useResumeStore((s) => s.updateEntry);
  const removeEntry = useResumeStore((s) => s.removeEntry);
  const addBullet = useResumeStore((s) => s.addBullet);
  const updateBullet = useResumeStore((s) => s.updateBullet);
  const removeBullet = useResumeStore((s) => s.removeBullet);

  const up = (partial: Partial<SectionEntry>) => updateEntry(sectionId, entry.id, partial);

  const needsTitle = !["interests"].includes(type);
  const needsSubtitle = ["experience", "education", "certifications", "volunteer"].includes(type);
  const needsDateRange = ["experience", "education", "certifications", "publications", "volunteer"].includes(type);
  const needsBullets = ["experience", "projects", "volunteer"].includes(type);
  const needsDescription = ["experience", "projects", "publications", "volunteer", "achievements", "references"].includes(type);
  const needsIssuer = type === "certifications";
  const needsProficiency = type === "languages";
  const needsCategory = type === "skills";
  const needsLink = type === "projects";

  return (
    <div className="border border-border rounded-md p-3 space-y-2 bg-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground truncate">{entry.title || entry.category || "New Entry"}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeEntry(sectionId, entry.id)}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>

      {needsCategory && (
        <>
          <Input value={entry.category} onChange={(e) => up({ category: e.target.value })} placeholder="Category (e.g. Languages)" className="h-7 text-sm" />
          <Input value={entry.items} onChange={(e) => up({ items: e.target.value })} placeholder="Items (comma-separated: Python, JS, SQL)" className="h-7 text-sm" />
        </>
      )}

      {needsTitle && (
        <Input value={entry.title} onChange={(e) => up({ title: e.target.value })} placeholder={type === "languages" ? "Language" : "Title"} className="h-7 text-sm" />
      )}

      {needsProficiency && (
        <Select value={entry.proficiency} onValueChange={(v) => up({ proficiency: v })}>
          <SelectTrigger className="h-7 text-sm"><SelectValue placeholder="Proficiency" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Native">Native</SelectItem>
            <SelectItem value="Fluent">Fluent</SelectItem>
            <SelectItem value="Advanced">Advanced</SelectItem>
            <SelectItem value="Intermediate">Intermediate</SelectItem>
            <SelectItem value="Basic">Basic</SelectItem>
          </SelectContent>
        </Select>
      )}

      {needsSubtitle && <Input value={entry.subtitle} onChange={(e) => up({ subtitle: e.target.value })} placeholder="Organization / Institution" className="h-7 text-sm" />}
      {needsDateRange && <Input value={entry.dateRange} onChange={(e) => up({ dateRange: e.target.value })} placeholder="2020 - 2024" className="h-7 text-sm" />}
      {needsIssuer && <Input value={entry.issuer} onChange={(e) => up({ issuer: e.target.value })} placeholder="Issuing organization" className="h-7 text-sm" />}
      {needsLink && (
        <div className="grid grid-cols-2 gap-2">
          <Input value={entry.linkLabel} onChange={(e) => up({ linkLabel: e.target.value })} placeholder="Link label" className="h-7 text-sm" />
          <Input value={entry.link} onChange={(e) => up({ link: e.target.value })} placeholder="https://..." className="h-7 text-sm" />
        </div>
      )}

      {needsDescription && (
        <Textarea value={entry.description} onChange={(e) => up({ description: e.target.value })} placeholder="Description..." rows={2} className="text-sm resize-none" />
      )}

      {needsBullets && (
        <div className="space-y-1">
          {entry.bullets.map((bullet, i) => (
            <div key={i} className="flex gap-1">
              <Textarea value={bullet} onChange={(e) => updateBullet(sectionId, entry.id, i, e.target.value)} placeholder={`Bullet ${i + 1}`} rows={2} className="text-sm resize-none flex-1" />
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeBullet(sectionId, entry.id, i)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-6 text-xs w-full" onClick={() => addBullet(sectionId, entry.id)}>
            <Plus className="h-3 w-3 mr-1" /> Add Bullet
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Section Editor ───
function SectionEditor({ section, index, total }: { section: ResumeSection; index: number; total: number }) {
  const updateSectionTitle = useResumeStore((s) => s.updateSectionTitle);
  const removeSection = useResumeStore((s) => s.removeSection);
  const toggleSectionVisibility = useResumeStore((s) => s.toggleSectionVisibility);
  const moveSection = useResumeStore((s) => s.moveSection);
  const addEntry = useResumeStore((s) => s.addEntry);
  const moveEntry = useResumeStore((s) => s.moveEntry);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-1 p-2 bg-muted/50">
        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => moveSection(section.id, "up")}>
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === total - 1} onClick={() => moveSection(section.id, "down")}>
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Input
          value={section.title}
          onChange={(e) => updateSectionTitle(section.id, e.target.value)}
          className="h-6 text-sm font-semibold flex-1 border-none bg-transparent focus-visible:ring-1"
        />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleSectionVisibility(section.id)}>
          {section.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSection(section.id)}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>

      {section.visible && (
        <div className="p-3 space-y-2">
          {section.entries.map((entry, ei) => (
            <div key={entry.id} className="relative">
              {section.entries.length > 1 && (
                <div className="absolute -left-1 top-1 flex flex-col gap-0.5">
                  <Button variant="ghost" size="icon" className="h-4 w-4" disabled={ei === 0} onClick={() => moveEntry(section.id, entry.id, "up")}>
                    <ChevronUp className="h-2 w-2" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-4 w-4" disabled={ei === section.entries.length - 1} onClick={() => moveEntry(section.id, entry.id, "down")}>
                    <ChevronDown className="h-2 w-2" />
                  </Button>
                </div>
              )}
              <EntryEditor sectionId={section.id} entry={entry} type={section.type} />
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => addEntry(section.id)}>
            <Plus className="h-3 w-3 mr-1" /> Add Entry
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Add Section ───
export function AddSectionEditor() {
  const addSection = useResumeStore((s) => s.addSection);
  const profile = useResumeStore((s) => s.getActiveProfile());
  const [open, setOpen] = useState(false);

  if (!profile) return null;
  const existingTypes = new Set(profile.data.sections.map((s) => s.type));
  const available = ALL_SECTION_TYPES.filter((t) => t === "custom" || !existingTypes.has(t));

  if (available.length === 0) return null;

  return (
    <div>
      {open ? (
        <div className="space-y-1 p-2 border border-dashed border-border rounded-lg">
          {available.map((type) => (
            <Button key={type} variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => { addSection(type); setOpen(false); }}>
              <Plus className="h-3 w-3 mr-2" /> {SECTION_LABELS[type]}
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="w-full text-xs h-7 text-muted-foreground" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full text-xs border-dashed" onClick={() => setOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Add Section
        </Button>
      )}
    </div>
  );
}

// ─── Sections List Editor ───
export function SectionsEditor() {
  const profile = useResumeStore((s) => s.getActiveProfile());
  if (!profile) return null;

  return (
    <div className="space-y-3">
      {profile.data.sections.map((section, i) => (
        <SectionEditor key={section.id} section={section} index={i} total={profile.data.sections.length} />
      ))}
    </div>
  );
}
