"use client";

import React from "react";
import { useResumeStore } from "@/lib/resume-store";
import { ResumeFormat, DEFAULT_FORMAT } from "@/lib/resume-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export function FormatControls() {
  const profile = useResumeStore((s) => s.getActiveProfile());
  const updateFormat = useResumeStore((s) => s.updateFormat);
  const resetFormat = useResumeStore((s) => s.resetFormat);

  if (!profile) return null;
  const fmt = profile.format;
  const up = (partial: Partial<ResumeFormat>) => updateFormat(partial);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Format Controls</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={resetFormat}>
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>
      </div>

      {/* Page Size */}
      <div>
        <Label className="text-xs text-muted-foreground">Page Size</Label>
        <Select value={fmt.pageSize} onValueChange={(v) => up({ pageSize: v as "a4" | "letter" })}>
          <SelectTrigger className="h-7 text-sm mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
            <SelectItem value="letter">Letter (216 × 279 mm)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Margins */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Margins (pt)</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <div key={side} className="flex items-center gap-1">
              <span className="text-xs w-8 capitalize">{side}</span>
              <Input type="number" value={fmt.margins[side]} onChange={(e) => up({ margins: { ...fmt.margins, [side]: Number(e.target.value) } })} className="h-7 text-sm w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Font Sizes */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Font Sizes (pt)</Label>
        <div className="space-y-2">
          {([
            { key: "nameSize", label: "Name" },
            { key: "sectionSize", label: "Section" },
            { key: "entryTitleSize", label: "Entry Title" },
            { key: "bodySize", label: "Body" },
            { key: "metaSize", label: "Meta/Contact" },
          ] as const).map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs w-20">{label}</span>
              <Slider
                value={[fmt.fonts[key]]}
                onValueChange={([v]) => up({ fonts: { ...fmt.fonts, [key]: v } })}
                min={6} max={36} step={0.5}
                className="flex-1"
              />
              <span className="text-xs w-8 text-right">{fmt.fonts[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Line Height */}
      <div className="flex items-center gap-2">
        <Label className="text-xs w-20">Line Height</Label>
        <Slider value={[fmt.fonts.lineHeight]} onValueChange={([v]) => up({ fonts: { ...fmt.fonts, lineHeight: v } })} min={1} max={2} step={0.05} className="flex-1" />
        <span className="text-xs w-8 text-right">{fmt.fonts.lineHeight}</span>
      </div>

      {/* Spacing */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs w-20">Section Gap</Label>
          <Slider value={[fmt.sectionSpacing]} onValueChange={([v]) => up({ sectionSpacing: v })} min={2} max={20} step={1} className="flex-1" />
          <span className="text-xs w-8 text-right">{fmt.sectionSpacing}</span>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs w-20">Entry Gap</Label>
          <Slider value={[fmt.entrySpacing]} onValueChange={([v]) => up({ entrySpacing: v })} min={2} max={20} step={1} className="flex-1" />
          <span className="text-xs w-8 text-right">{fmt.entrySpacing}</span>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs w-20">Divider</Label>
          <Slider value={[fmt.dividerWeight]} onValueChange={([v]) => up({ dividerWeight: v })} min={0} max={3} step={0.25} className="flex-1" />
          <span className="text-xs w-8 text-right">{fmt.dividerWeight}</span>
        </div>
      </div>

      {/* Colors */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Colors</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["primary", "secondary", "divider"] as const).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs capitalize w-16">{key}</span>
              <input type="color" value={fmt.colors[key]} onChange={(e) => up({ colors: { ...fmt.colors, [key]: e.target.value } })} className="h-7 w-7 rounded cursor-pointer" />
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Header</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs w-20">Alignment</span>
            <Select value={fmt.header.align} onValueChange={(v) => up({ header: { ...fmt.header, align: v as "center" | "left" } })}>
              <SelectTrigger className="h-7 text-sm flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="left">Left</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={fmt.header.showSubtitle} onCheckedChange={(v) => up({ header: { ...fmt.header, showSubtitle: v } })} />
            <Label className="text-xs">Show subtitle</Label>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Footer</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Switch checked={fmt.footer.showName} onCheckedChange={(v) => up({ footer: { ...fmt.footer, showName: v } })} />
            <Label className="text-xs">Show name</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={fmt.footer.showPageNumbers} onCheckedChange={(v) => up({ footer: { ...fmt.footer, showPageNumbers: v } })} />
            <Label className="text-xs">Page numbers</Label>
          </div>
          <div>
            <Input value={fmt.footer.customText} onChange={(e) => up({ footer: { ...fmt.footer, customText: e.target.value } })} placeholder="Custom footer text" className="h-7 text-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
