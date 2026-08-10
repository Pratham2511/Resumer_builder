// Debug: Check what color values we get from operator list
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
  
  // Walk through operators and track state
  let currentColor = [0, 0, 0];
  let currentFont = "";
  const fontColorPairs = {};
  
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    
    if (fn === pdfjs.OPS.setFillRGBColor) {
      currentColor = [args[0], args[1], args[2]];
      // Check if values look normalized (0-1) or raw
      const maxVal = Math.max(args[0], args[1], args[2]);
      console.log(`setFillRGBColor: raw=[${args[0]}, ${args[1]}, ${args[2]}] max=${maxVal} ${maxVal > 1 ? '(RAW/16-bit)' : '(normalized 0-1)'}`);
      
      // Try different normalizations
      const normalized01 = [args[0], args[1], args[2]];
      const normalized16 = [args[0]/65535, args[1]/65535, args[2]/65535];
      const normalized256 = [args[0]/255, args[1]/255, args[2]/255];
      
      const toHex = (vals) => '#' + vals.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
      console.log(`  As 0-1: ${toHex(normalized01)}`);
      console.log(`  As 16-bit (/65535): ${toHex(normalized16)}`);
      console.log(`  As 8-bit (/255): ${toHex(normalized256)}`);
    }
    
    if (fn === pdfjs.OPS.setFont) {
      currentFont = args[0];
      const toHex = (vals) => '#' + vals.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
      if (!fontColorPairs[currentFont]) {
        fontColorPairs[currentFont] = toHex(currentColor);
      }
    }
  }
  
  console.log('\nFont → Color mapping:');
  for (const [font, color] of Object.entries(fontColorPairs)) {
    console.log(`  ${font}: ${color}`);
  }
}

debugColors().catch(console.error);
