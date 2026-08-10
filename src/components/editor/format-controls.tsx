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
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Format Controls</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs text-slate-400 hover:text-blue-500" onClick={resetFormat}>
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>
      </div>

      {/* Page Size */}
      <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
        <Label className="text-xs text-slate-500 font-medium">Page Size</Label>
        <Select value={fmt.pageSize} onValueChange={(v) => up({ pageSize: v as "a4" | "letter" })}>
          <SelectTrigger className="h-7 text-sm mt-1 border-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
            <SelectItem value="letter">Letter (216 × 279 mm)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Margins */}
      <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
        <Label className="text-xs text-slate-500 mb-1 block font-medium">Margins (pt)</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <div key={side} className="flex items-center gap-1">
              <span className="text-xs w-8 capitalize text-slate-500">{side}</span>
              <Input type="number" value={fmt.margins[side]} onChange={(e) => up({ margins: { ...fmt.margins, [side]: Number(e.target.value) } })} className="h-7 text-sm w-16 border-slate-200 focus-visible:ring-blue-500/30" />
            </div>
          ))}
        </div>
      </div>

      {/* Font Sizes */}
      <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
        <Label className="text-xs text-slate-500 mb-2 block font-medium">Font Sizes (pt)</Label>
        <div className="space-y-2.5">
          {([
            { key: "nameSize", label: "Name" },
            { key: "sectionSize", label: "Section" },
            { key: "entryTitleSize", label: "Entry Title" },
            { key: "bodySize", label: "Body" },
            { key: "metaSize", label: "Meta/Contact" },
          ] as const).map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs w-20 text-slate-500">{label}</span>
              <Slider
                value={[fmt.fonts[key]]}
                onValueChange={([v]) => up({ fonts: { ...fmt.fonts, [key]: v } })}
                min={6} max={36} step={0.5}
                className="flex-1"
              />
              <span className="text-xs w-8 text-right text-slate-600 font-medium">{fmt.fonts[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Line Height */}
      <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
        <div className="flex items-center gap-2">
          <Label className="text-xs w-20 text-slate-500 font-medium">Line Height</Label>
          <Slider value={[fmt.fonts.lineHeight]} onValueChange={([v]) => up({ fonts: { ...fmt.fonts, lineHeight: v } })} min={1} max={2} step={0.05} className="flex-1" />
          <span className="text-xs w-8 text-right text-slate-600 font-medium">{fmt.fonts.lineHeight}</span>
        </div>
      </div>

      {/* Spacing */}
      <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 space-y-2.5">
        <Label className="text-xs text-slate-500 font-medium">Spacing & Dividers</Label>
        <div className="flex items-center gap-2">
          <span className="text-xs w-20 text-slate-500">Section Gap</span>
          <Slider value={[fmt.sectionSpacing]} onValueChange={([v]) => up({ sectionSpacing: v })} min={2} max={20} step={1} className="flex-1" />
          <span className="text-xs w-8 text-right text-slate-600 font-medium">{fmt.sectionSpacing}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs w-20 text-slate-500">Entry Gap</span>
          <Slider value={[fmt.entrySpacing]} onValueChange={([v]) => up({ entrySpacing: v })} min={2} max={20} step={1} className="flex-1" />
          <span className="text-xs w-8 text-right text-slate-600 font-medium">{fmt.entrySpacing}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs w-20 text-slate-500">Divider</span>
          <Slider value={[fmt.dividerWeight]} onValueChange={([v]) => up({ dividerWeight: v })} min={0} max={3} step={0.25} className="flex-1" />
          <span className="text-xs w-8 text-right text-slate-600 font-medium">{fmt.dividerWeight}</span>
        </div>
      </div>

      {/* Colors */}
      <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
        <Label className="text-xs text-slate-500 mb-2 block font-medium">Colors</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["primary", "secondary", "divider"] as const).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs capitalize w-16 text-slate-500">{key}</span>
              <input type="color" value={fmt.colors[key]} onChange={(e) => up({ colors: { ...fmt.colors, [key]: e.target.value } })} className="h-7 w-7 rounded-md cursor-pointer border border-slate-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
        <Label className="text-xs text-slate-500 mb-2 block font-medium">Header</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs w-20 text-slate-500">Alignment</span>
            <Select value={fmt.header.align} onValueChange={(v) => up({ header: { ...fmt.header, align: v as "center" | "left" } })}>
              <SelectTrigger className="h-7 text-sm flex-1 border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="left">Left</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={fmt.header.showSubtitle} onCheckedChange={(v) => up({ header: { ...fmt.header, showSubtitle: v } })} />
            <Label className="text-xs text-slate-600">Show subtitle</Label>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
        <Label className="text-xs text-slate-500 mb-2 block font-medium">Footer</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Switch checked={fmt.footer.showName} onCheckedChange={(v) => up({ footer: { ...fmt.footer, showName: v } })} />
            <Label className="text-xs text-slate-600">Show name</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={fmt.footer.showPageNumbers} onCheckedChange={(v) => up({ footer: { ...fmt.footer, showPageNumbers: v } })} />
            <Label className="text-xs text-slate-600">Page numbers</Label>
          </div>
          <div>
            <Input value={fmt.footer.customText} onChange={(e) => up({ footer: { ...fmt.footer, customText: e.target.value } })} placeholder="Custom footer text" className="h-7 text-sm border-slate-200 focus-visible:ring-blue-500/30" />
          </div>
        </div>
      </div>
    </div>
  );
}
