// Debug script: Check what PDF.js actually gives us for text content
const fs = require('fs');

async function debugPdf() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
  const pdfjs = pdfjsLib.default || pdfjsLib;
  const workerSrc = await import('pdfjs-dist/legacy/build/pdf.worker.js');
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc.default || "";
  
  const data = new Uint8Array(fs.readFileSync('/home/z/my-project/scripts/test-resume.pdf'));
  const pdfDoc = await pdfjs.getDocument({ data }).promise;
  
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    
    console.log(`\n=== Page ${i} ===`);
    console.log(`Viewport: ${viewport.width} x ${viewport.height}`);
    
    console.log(`\nStyles keys:`, Object.keys(textContent.styles || {}));
    for (const [key, style] of Object.entries(textContent.styles || {})) {
      console.log(`Style "${key}":`, JSON.stringify(style, null, 2));
    }
    
    console.log(`\nItems (${textContent.items.length}):`);
    for (const item of textContent.items) {
      console.log(`  "${item.str}" | fontName=${item.fontName} | fontSize=${Math.abs(item.transform?.[3] || 0).toFixed(1)} | x=${item.transform?.[4]?.toFixed(1)} | y=${item.transform?.[5]?.toFixed(1)} | width=${item.width?.toFixed(1)}`);
    }
    
    // Check for operator list (images)
    try {
      const ops = await page.getOperatorList();
      console.log(`\nOperator list length: ${ops.fnArray.length}`);
      const opNames = ops.fnArray.slice(0, 20).map(op => {
        const names = Object.entries(pdfjs.OPS).find(([k,v]) => v === op);
        return names ? names[0] : op;
      });
      console.log('First operators:', opNames);
    } catch (e) {
      console.log('Operator list error:', e.message);
    }
  }
}

debugPdf().catch(console.error);
