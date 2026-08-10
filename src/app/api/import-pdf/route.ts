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
    const uint8Array = new Uint8Array(buffer);

    // Use pdfjs-dist to extract text
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.js");
    const pdfjs = pdfjsLib.default || pdfjsLib;
    // Set worker source (required for pdfjs-dist)
    const workerSrc = await import("pdfjs-dist/legacy/build/pdf.worker.js");
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc.default || "";
    const pdfDoc = await pdfjs.getDocument({ data: uint8Array }).promise;

    const numPages = pdfDoc.numPages;
    const textParts: string[] = [];
    let hasPhoto = false;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      
      // Properly join text spans by line position
      const items = textContent.items as any[];
      if (items.length > 0) {
        const pageLines: string[] = [];
        let currentLine = "";
        let lastY = items[0]?.transform?.[5] ?? 0;
        
        for (const item of items) {
          if (!item.str) continue;
          const y = item.transform?.[5] ?? lastY;
          if (Math.abs(y - lastY) > 2) {
            if (currentLine.trim()) pageLines.push(currentLine.trim());
            currentLine = item.str;
            lastY = y;
          } else {
            const gap = currentLine.endsWith(" ") || item.str.startsWith(" ") ? "" : " ";
            currentLine += gap + item.str;
          }
        }
        if (currentLine.trim()) pageLines.push(currentLine.trim());
        textParts.push(pageLines.join("\n"));
      }

      // Check for images (photo detection)
      try {
        const operators = await page.getOperatorList();
        if (operators.fnArray.includes(pdfjs.OPS.paintImageXObject)) {
          hasPhoto = true;
        }
      } catch {
        // Ignore
      }
    }

    const text = textParts.join("\n\n");

    // Parse resume structure
    const resumeData = parseResumeText(text);

    // Detect format
    const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
    let headerAlign: "center" | "left" = "center";

    const detectedFormat: DetectedFormat = detectFormatFromPdfMetadata({
      headerAlign,
      hasPhoto,
    });

    return NextResponse.json({
      success: true,
      data: resumeData,
      format: detectedFormat,
      rawText: text,
      pageCount: numPages,
    });
  } catch (error: unknown) {
    console.error("PDF import error:", error);
    const message = error instanceof Error ? error.message : "Failed to parse PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
