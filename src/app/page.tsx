"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useResumeStore } from "@/lib/resume-store";
import { createDefaultProfile, ResumeData, ResumeFormat } from "@/lib/resume-types";
import ResumePreview from "@/components/preview/resume-preview";
import { PersonalInfoEditor, SectionsEditor, AddSectionEditor } from "@/components/editor/editor-panel";
import { FormatControls } from "@/components/editor/format-controls";
import { ProfileManager } from "@/components/editor/profile-manager";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Download, FileText, Settings, User, Layers, ZoomIn, ZoomOut, Maximize2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { profiles, activeProfileId, getActiveProfile, createProfile } = useResumeStore();
  const profile = getActiveProfile();
  const previewRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [zoom, setZoom] = useState(0.55);
  const [downloading, setDownloading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && profiles.length === 0) {
      createProfile("My Resume");
    }
  }, [hydrated, profiles.length, createProfile]);

  const handleDownload = useCallback(async () => {
    if (!profile || !previewRef.current) return;
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const element = previewRef.current;
      const pageSize = profile.format.pageSize === "a4" ? "a4" : "letter";

      const opt = {
        margin: 0,
        filename: `${profile.name.replace(/\s+/g, "_")}_Resume.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: pageSize as "a4" | "letter", orientation: "portrait" as const },
      };

      await html2pdf().set(opt).from(element).save();
      toast({ title: "PDF downloaded!", description: "Your resume has been saved" });
    } catch (err) {
      console.error(err);
      toast({ title: "Download failed", description: "Could not generate PDF", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }, [profile, toast]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Loading ResumeForge...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
        <Button onClick={() => createProfile("My Resume")} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Create Your First Resume
        </Button>
      </div>
    );
  }

  const emptyData: ResumeData = { personal: { fullName: "Your Name Here", title: "", phone: "", email: "", address: "", website: "", linkedin: "", github: "", portfolio: "" }, summary: "", sections: [] };
  const previewData = profile.data.personal.fullName ? profile.data : { ...profile.data, personal: { ...profile.data.personal, fullName: profile.data.personal.fullName || "Your Name Here" } };
  const hasContent = profile.data.sections.some((s) => s.entries.length > 0) || profile.data.summary.trim().length > 0 || profile.data.personal.fullName.trim().length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50/20">
      {/* Top Bar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-5 py-2.5 flex items-center gap-3 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <FileText className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold text-sm bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">ResumeForge</span>
        </div>
        <div className="flex-1 max-w-xs">
          <ProfileManager />
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} title="Zoom out">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-slate-500 w-10 text-center font-medium">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setZoom((z) => Math.min(1.2, z + 0.1))} title="Zoom in">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setZoom(0.55)} title="Reset zoom">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button size="sm" className="ml-2 gap-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-sm border-0" onClick={handleDownload} disabled={downloading || !hasContent}>
            <Download className="h-3.5 w-3.5" />
            {downloading ? "Generating..." : "Download PDF"}
          </Button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Editor */}
        <div className="w-[380px] shrink-0 border-r border-slate-200/60 bg-white overflow-y-auto">
          <Tabs defaultValue="content" className="h-full flex flex-col">
            <TabsList className="w-full rounded-none border-b border-slate-200/60 bg-slate-50/50 h-10 px-2 gap-1">
              <TabsTrigger value="content" className="flex-1 text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:rounded-md font-medium">
                <User className="h-3.5 w-3.5" /> Content
              </TabsTrigger>
              <TabsTrigger value="sections" className="flex-1 text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:rounded-md font-medium">
                <Layers className="h-3.5 w-3.5" /> Sections
              </TabsTrigger>
              <TabsTrigger value="format" className="flex-1 text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:rounded-md font-medium">
                <Settings className="h-3.5 w-3.5" /> Format
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="flex-1 overflow-y-auto p-4 mt-0">
              <Accordion type="multiple" defaultValue={["personal"]} className="space-y-2">
                <AccordionItem value="personal" className="border border-slate-200 rounded-xl px-3 shadow-sm bg-white">
                  <AccordionTrigger className="text-sm font-semibold py-2.5 hover:no-underline">
                    Personal Information
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <PersonalInfoEditor />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            <TabsContent value="sections" className="flex-1 overflow-y-auto p-4 mt-0 space-y-4">
              <SectionsEditor />
              <AddSectionEditor />
            </TabsContent>

            <TabsContent value="format" className="flex-1 overflow-y-auto p-4 mt-0">
              <FormatControls />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Panel - Preview */}
        <div className="flex-1 overflow-auto flex items-start justify-center p-8 bg-gradient-to-br from-slate-100/80 to-blue-50/30">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }} className="transition-transform duration-200">
            <ResumePreview ref={previewRef} data={previewData} format={profile.format} />
          </div>
        </div>
      </div>
    </div>
  );
}
