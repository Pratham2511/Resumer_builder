"use client";

import React, { useState, useRef } from "react";
import { useResumeStore } from "@/lib/resume-store";
import { ResumeData, ResumeFormat, DEFAULT_FORMAT } from "@/lib/resume-types";
import { DetectedFormat } from "@/lib/parsers/resume-parser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, File, Code, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ImportStatus = "idle" | "loading" | "success" | "error";

interface ImportResult {
  data: ResumeData;
  format?: DetectedFormat;
  rawText?: string;
  pageCount?: number;
  pageSize?: "a4" | "letter";
}

export function ImportModal() {
  const { updatePersonal, updateSummary, importProfile, profiles, activeProfileId, createProfile, addSection, addEntry, updateEntry, updateFormat } = useResumeStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const docxInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStatus("idle");
    setErrorMsg("");
    setResult(null);
    setJsonText("");
  };

  const applyImportedData = (imported: ImportResult) => {
    const data = imported.data;

    updatePersonal(data.personal);
    updateSummary(data.summary);

    const newProfileId = createProfile(data.personal.fullName || "Imported Resume");

    const fmt = imported.format;
    const formatObj: ResumeFormat = fmt ? {
      margins: fmt.margins,
      fonts: {
        family: fmt.fontFamily || DEFAULT_FORMAT.fonts.family,
        nameSize: fmt.fontSizes.name,
        sectionSize: fmt.fontSizes.section,
        bodySize: fmt.fontSizes.body,
        metaSize: fmt.fontSizes.meta || fmt.fontSizes.body,
        entryTitleSize: fmt.fontSizes.entryTitle || ((fmt.fontSizes.body + fmt.fontSizes.section) / 2),
        lineHeight: fmt.lineHeight || DEFAULT_FORMAT.fonts.lineHeight,
        nameLetterSpacing: fmt.nameLetterSpacing ?? DEFAULT_FORMAT.fonts.nameLetterSpacing,
        sectionLetterSpacing: fmt.sectionLetterSpacing ?? DEFAULT_FORMAT.fonts.sectionLetterSpacing,
      },
      colors: {
        primary: fmt.colors.primary,
        secondary: fmt.colors.secondary,
        accent: fmt.colors.accent || fmt.colors.primary,
        divider: fmt.colors.divider || fmt.colors.primary,
      },
      header: {
        align: fmt.headerAlign,
        showSubtitle: fmt.showSubtitle ?? !!data.personal.title,
      },
      footer: fmt.footer || DEFAULT_FORMAT.footer,
      pageSize: imported.pageSize || fmt.pageSize || DEFAULT_FORMAT.pageSize,
      sectionSpacing: fmt.sectionSpacing ?? DEFAULT_FORMAT.sectionSpacing,
      entrySpacing: fmt.entrySpacing ?? DEFAULT_FORMAT.entrySpacing,
      dividerWeight: fmt.dividerWeight ?? DEFAULT_FORMAT.dividerWeight,
    } : DEFAULT_FORMAT;

    const profileJson = JSON.stringify({
      id: crypto.randomUUID(),
      name: data.personal.fullName || "Imported Resume",
      data: {
        ...data,
        personal: {
          ...data.personal,
          showPhoto: imported.format?.hasPhoto ? true : data.personal.showPhoto,
        },
      },
      format: formatObj,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const { deleteProfile } = useResumeStore.getState();
    deleteProfile(newProfileId);

    const importedId = importProfile(profileJson);
    if (!importedId) {
      setStatus("error");
      setErrorMsg("Failed to apply imported data");
      return;
    }

    setResult(imported);
    setStatus("success");
    toast({
      title: "Resume imported!",
      description: `${data.sections.length} sections detected with ${data.sections.reduce((acc, s) => acc + s.entries.length, 0)} entries`,
    });
  };

  const handlePdfImport = async (file: File) => {
    setStatus("loading");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to parse PDF");
      }

      const imported: ImportResult = await response.json();
      applyImportedData(imported);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      toast({ title: "Import failed", description: "Could not parse PDF file", variant: "destructive" });
    }
  };

  const handleDocxImport = async (file: File) => {
    setStatus("loading");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import-docx", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to parse DOCX");
      }

      const imported: ImportResult = await response.json();
      applyImportedData(imported);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      toast({ title: "Import failed", description: "Could not parse DOCX file", variant: "destructive" });
    }
  };

  const handleJsonImport = () => {
    setStatus("loading");
    try {
      const id = importProfile(jsonText);
      if (id) {
        setStatus("success");
        toast({ title: "Profile imported from JSON" });
      } else {
        setStatus("error");
        setErrorMsg("Invalid JSON format");
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-blue-500" title="Import Resume">
          <Upload className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-blue-500" />
            Import Resume
          </DialogTitle>
        </DialogHeader>

        {status === "success" ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Resume imported successfully!</p>
            {result && (
              <div className="text-xs text-slate-500 text-center">
                <p className="font-medium">{result.data.personal.fullName}</p>
                <p>{result.data.sections.length} sections · {result.data.sections.reduce((a, s) => a + s.entries.length, 0)} entries</p>
                {result.pageCount && <p>{result.pageCount} pages detected</p>}
                {result.format?.hasPhoto && <p className="text-amber-600 font-medium mt-1">Photo detected — enable it in Content tab</p>}
              </div>
            )}
            <Button size="sm" onClick={() => setOpen(false)} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0">Close</Button>
          </div>
        ) : status === "error" ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Import failed</p>
            <p className="text-xs text-slate-500">{errorMsg}</p>
            <Button size="sm" variant="outline" onClick={resetState} className="border-slate-200">Try Again</Button>
          </div>
        ) : status === "loading" ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Parsing resume...</p>
          </div>
        ) : (
          <Tabs defaultValue="pdf" className="w-full">
            <TabsList className="w-full bg-slate-100/50">
              <TabsTrigger value="pdf" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <FileText className="h-3.5 w-3.5" /> PDF
              </TabsTrigger>
              <TabsTrigger value="docx" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <File className="h-3.5 w-3.5" /> DOCX
              </TabsTrigger>
              <TabsTrigger value="json" className="flex-1 gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Code className="h-3.5 w-3.5" /> JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pdf" className="mt-4">
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Upload a PDF resume. We&apos;ll extract the text, detect sections (Experience, Education, Skills, etc.), and preserve the layout format.
                </p>
                <div
                  className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition-all"
                  onClick={() => pdfInputRef.current?.click()}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Click to upload PDF</p>
                  <p className="text-xs text-slate-400 mt-1">or drag and drop</p>
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePdfImport(file);
                    }}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="docx" className="mt-4">
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Upload a Word document (.docx). We&apos;ll extract the content, detect sections, and check for embedded photos.
                </p>
                <div
                  className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition-all"
                  onClick={() => docxInputRef.current?.click()}
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                    <File className="h-5 w-5 text-indigo-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Click to upload DOCX</p>
                  <p className="text-xs text-slate-400 mt-1">.docx format only</p>
                  <input
                    ref={docxInputRef}
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleDocxImport(file);
                    }}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="json" className="mt-4">
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Paste a previously exported ResumeForge JSON profile.
                </p>
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder='Paste JSON here...'
                  className="w-full h-32 border border-slate-200 rounded-xl p-3 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-400"
                />
                <Button size="sm" className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0" onClick={handleJsonImport} disabled={!jsonText.trim()}>
                  Import JSON
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
