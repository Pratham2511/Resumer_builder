"use client";

import React, { useState, useRef } from "react";
import { useResumeStore } from "@/lib/resume-store";
import { ResumeData, ResumeFormat, DEFAULT_FORMAT, DetectedFormat } from "@/lib/resume-types";
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
    // Option 1: Create a new profile with the imported data
    // We'll import into the current profile, replacing its data
    const data = imported.data;

    // Update personal info
    updatePersonal(data.personal);
    updateSummary(data.summary);

    // Clear existing sections and add imported ones
    // (We can't easily clear sections from the store, so we'll create a new profile)
    // Actually, let's create a new profile with this data
    const newProfileId = createProfile(data.personal.fullName || "Imported Resume");

    // Now we need to populate the new profile with the imported data
    // Since the store only has addSection/addEntry methods, we use them
    // But first, the new profile has default sections — we need to work with those
    // Better approach: use importProfile with a constructed JSON

    // Construct a full profile JSON
    const profileJson = JSON.stringify({
      id: crypto.randomUUID(),
      name: data.personal.fullName || "Imported Resume",
      data: data,
      format: imported.format ? {
        ...DEFAULT_FORMAT,
        colors: imported.format.colors,
        margins: imported.format.margins,
        fonts: {
          ...DEFAULT_FORMAT.fonts,
          nameSize: imported.format.fontSizes.name,
          sectionSize: imported.format.fontSizes.section,
          bodySize: imported.format.fontSizes.body,
        },
        header: {
          ...DEFAULT_FORMAT.header,
          align: imported.format.headerAlign,
          showSubtitle: !!data.personal.title,
        },
      } : DEFAULT_FORMAT,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Delete the profile we just created and import properly
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
        <Button variant="ghost" size="icon" className="h-6 w-6" title="Import Resume">
          <Upload className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Resume</DialogTitle>
        </DialogHeader>

        {status === "success" ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium">Resume imported successfully!</p>
            {result && (
              <div className="text-xs text-muted-foreground text-center">
                <p>{result.data.personal.fullName}</p>
                <p>{result.data.sections.length} sections · {result.data.sections.reduce((a, s) => a + s.entries.length, 0)} entries</p>
                {result.pageCount && <p>{result.pageCount} pages detected</p>}
                {result.format?.hasPhoto && <p className="text-amber-600 font-medium">Photo detected — enable it in Content tab</p>}
              </div>
            )}
            <Button size="sm" onClick={() => setOpen(false)}>Close</Button>
          </div>
        ) : status === "error" ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm font-medium">Import failed</p>
            <p className="text-xs text-muted-foreground">{errorMsg}</p>
            <Button size="sm" variant="outline" onClick={resetState}>Try Again</Button>
          </div>
        ) : status === "loading" ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Parsing resume...</p>
          </div>
        ) : (
          <Tabs defaultValue="pdf" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="pdf" className="flex-1 gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" /> PDF
              </TabsTrigger>
              <TabsTrigger value="docx" className="flex-1 gap-1.5 text-xs">
                <File className="h-3.5 w-3.5" /> DOCX
              </TabsTrigger>
              <TabsTrigger value="json" className="flex-1 gap-1.5 text-xs">
                <Code className="h-3.5 w-3.5" /> JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pdf" className="mt-4">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Upload a PDF resume. We&apos;ll extract the text, detect sections (Experience, Education, Skills, etc.), and preserve the layout format.
                </p>
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                  onClick={() => pdfInputRef.current?.click()}
                >
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm font-medium">Click to upload PDF</p>
                  <p className="text-xs text-muted-foreground">or drag and drop</p>
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
                <p className="text-xs text-muted-foreground">
                  Upload a Word document (.docx). We&apos;ll extract the content, detect sections, and check for embedded photos.
                </p>
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                  onClick={() => docxInputRef.current?.click()}
                >
                  <File className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm font-medium">Click to upload DOCX</p>
                  <p className="text-xs text-muted-foreground">.docx format only</p>
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
                <p className="text-xs text-muted-foreground">
                  Paste a previously exported ResumeForge JSON profile.
                </p>
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder='Paste JSON here...'
                  className="w-full h-32 border rounded-md p-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button size="sm" className="w-full" onClick={handleJsonImport} disabled={!jsonText.trim()}>
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
