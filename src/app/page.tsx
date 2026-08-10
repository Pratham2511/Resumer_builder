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
import { Download, FileText, Settings, User, Layers, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { profiles, activeProfileId, getActiveProfile, createProfile } = useResumeStore();
  const profile = getActiveProfile();
  const previewRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [zoom, setZoom] = useState(0.55);
  const [downloading, setDownloading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydration guard for zustand persist
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Auto-create first profile
  useEffect(() => {
    if (hydrated && profiles.length === 0) {
      const id = createProfile("My Resume");
    }
  }, [hydrated, profiles.length, createProfile]);

  // PDF Download
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
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="text-neutral-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <Button onClick={() => createProfile("My Resume")}>Create Your First Resume</Button>
      </div>
    );
  }

  const emptyData: ResumeData = { personal: { fullName: "Your Name Here", title: "", phone: "", email: "", address: "", website: "", linkedin: "", github: "", portfolio: "" }, summary: "", sections: [] };
  const previewData = profile.data.personal.fullName ? profile.data : { ...profile.data, personal: { ...profile.data.personal, fullName: profile.data.personal.fullName || "Your Name Here" } };
  const hasContent = profile.data.sections.some((s) => s.entries.length > 0) || profile.data.summary.trim().length > 0 || profile.data.personal.fullName.trim().length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-neutral-100">
      {/* Top Bar */}
      <header className="bg-white border-b border-border px-4 py-2 flex items-center gap-3 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-neutral-700" />
          <span className="font-semibold text-sm text-neutral-800">ResumeForge</span>
        </div>
        <div className="flex-1 max-w-xs">
          <ProfileManager />
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(1.2, z + 0.1))} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(0.55)} title="Reset zoom">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button size="sm" className="ml-2 gap-1.5" onClick={handleDownload} disabled={downloading || !hasContent}>
            <Download className="h-4 w-4" />
            {downloading ? "Generating..." : "Download PDF"}
          </Button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Editor */}
        <div className="w-[380px] shrink-0 border-r border-border bg-white overflow-y-auto">
          <Tabs defaultValue="content" className="h-full flex flex-col">
            <TabsList className="w-full rounded-none border-b bg-transparent h-9 px-2">
              <TabsTrigger value="content" className="flex-1 text-xs gap-1 data-[state=active]:shadow-none">
                <User className="h-3 w-3" /> Content
              </TabsTrigger>
              <TabsTrigger value="sections" className="flex-1 text-xs gap-1 data-[state=active]:shadow-none">
                <Layers className="h-3 w-3" /> Sections
              </TabsTrigger>
              <TabsTrigger value="format" className="flex-1 text-xs gap-1 data-[state=active]:shadow-none">
                <Settings className="h-3 w-3" /> Format
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="flex-1 overflow-y-auto p-4 mt-0">
              <Accordion type="multiple" defaultValue={["personal"]} className="space-y-2">
                <AccordionItem value="personal" className="border rounded-lg px-3">
                  <AccordionTrigger className="text-sm font-semibold py-2 hover:no-underline">
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
        <div className="flex-1 overflow-auto flex items-start justify-center p-8 bg-neutral-200/50">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }} className="transition-transform duration-200">
            <ResumePreview ref={previewRef} data={previewData} format={profile.format} />
          </div>
        </div>
      </div>
    </div>
  );
}
