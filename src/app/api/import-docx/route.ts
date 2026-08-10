import { NextRequest, NextResponse } from "next/server";
import { parseResumeText, detectFormatFromPdfMetadata, DetectedFormat } from "@/lib/parsers/resume-parser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Dynamic import of mammoth (server-only)
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;

    // Parse resume structure
    const resumeData = parseResumeText(text);

    // DOCX format detection
    // Check for common DOCX resume patterns
    const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
    let headerAlign: "center" | "left" = "left"; // DOCX resumes tend to be left-aligned

    // Try to detect if header is centered by checking line patterns
    if (lines.length > 0 && lines[0].length < 40) {
      headerAlign = "center";
    }

    // Check for images in the DOCX
    let hasPhoto = false;
    try {
      const htmlResult = await mammoth.convertToHtml({ buffer });
      if (htmlResult.value.includes("<img") || htmlResult.value.includes("<image")) {
        hasPhoto = true;
      }
    } catch {
      // Ignore
    }

    const detectedFormat: DetectedFormat = detectFormatFromPdfMetadata({
      headerAlign,
      hasPhoto,
    });

    return NextResponse.json({
      success: true,
      data: resumeData,
      format: detectedFormat,
      rawText: text,
    });
  } catch (error: unknown) {
    console.error("DOCX import error:", error);
    const message = error instanceof Error ? error.message : "Failed to parse DOCX";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
