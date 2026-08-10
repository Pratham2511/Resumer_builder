// Debug script: Extract colors from PDF operator list
const fs = require('fs');

async function debugColors() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
  const pdfjs = pdfjsLib.default || pdfjsLib;
  const workerSrc = await import('pdfjs-dist/legacy/build/pdf.worker.js');
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc.default || "";
  
  const data = new Uint8Array(fs.readFileSync('/home/z/my-project/scripts/test-resume.pdf'));
  const pdfDoc = await pdfjs.getDocument({ data }).promise;
  
  const page = await pdfDoc.getPage(1);
  const ops = await page.getOperatorList();
  
  // Find all setFillRGBColor operations and the text that follows
  let currentColor = [0, 0, 0];
  const colorTextMap = {};
  
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    
    if (fn === pdfjs.OPS.setFillRGBColor) {
      currentColor = [args[0], args[1], args[2]];
    }
    
    if (fn === pdfjs.OPS.showText || fn === pdfjs.OPS.showSpacedText) {
      const colorKey = currentColor.map(c => Math.round(c * 255)).join(',');
      if (!colorTextMap[colorKey]) colorTextMap[colorKey] = [];
      
      if (fn === pdfjs.OPS.showSpacedText && Array.isArray(args[0])) {
        for (const item of args[0]) {
          if (typeof item === 'object' && item !== null) {
            // It's a Uint8Array or similar
            try {
              const text = Array.from(item).map(c => String.fromCharCode(c)).join('');
              if (text.trim()) colorTextMap[colorKey].push(text.trim());
            } catch {}
          }
        }
      }
    }
  }
  
  console.log('Color → Text mapping:');
  for (const [color, texts] of Object.entries(colorTextMap)) {
    const [r, g, b] = color.split(',').map(Number);
    const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
    console.log(`  ${hex} (${color}): ${texts.join(', ')}`);
  }
  
  // Also try to get font info from the operator list
  console.log('\nFont operations:');
  let fontIdx = 0;
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === pdfjs.OPS.setFont) {
      const args = ops.argsArray[i];
      console.log(`  setFont: objId=${args[0]}, size=${args[1]}`);
      fontIdx++;
      if (fontIdx > 5) break;
    }
  }

  // Check metadata
  const metadata = await pdfDoc.getMetadata();
  console.log('\nMetadata:', JSON.stringify(metadata, null, 2));
}

debugColors().catch(console.error);
