// Test script: Create a sample PDF resume and test the import API
const fs = require('fs');
const path = require('path');

// We'll use pdfkit to create a test PDF with specific formatting
async function createTestPdf() {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 72, bottom: 72, left: 56, right: 56 },
    info: { Title: 'Test Resume', Author: 'John Doe' }
  });
  
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  
  return new Promise((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    
    // Header - centered name with large font
    doc.font('Helvetica-Bold').fontSize(24).fillColor('#1a3c5e')
       .text('JOHN DOE', { align: 'center' });
    
    // Subtitle
    doc.font('Helvetica').fontSize(12).fillColor('#4a6b8a')
       .text('Senior Software Engineer', { align: 'center' });
    
    // Contact line
    doc.fontSize(9).fillColor('#666666')
       .text('john.doe@email.com | +1-555-123-4567 | San Francisco, CA | linkedin.com/in/johndoe', { align: 'center' });
    
    doc.moveDown(0.5);
    
    // Divider
    doc.strokeColor('#1a3c5e').lineWidth(1)
       .moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y).stroke();
    
    doc.moveDown(0.5);
    
    // Summary section
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a3c5e')
       .text('PROFESSIONAL SUMMARY', { align: 'left' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9.5).fillColor('#333333')
       .text('Experienced software engineer with 8+ years of expertise in full-stack development, cloud architecture, and agile methodologies. Proven track record of delivering scalable applications that serve millions of users.', { align: 'justify', lineGap: 2 });
    
    doc.moveDown(0.5);
    
    // Divider
    doc.strokeColor('#1a3c5e').lineWidth(1)
       .moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y).stroke();
    
    doc.moveDown(0.5);
    
    // Experience section
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a3c5e')
       .text('WORK EXPERIENCE', { align: 'left' });
    doc.moveDown(0.3);
    
    // Job 1
    doc.font('Helvetica').fontSize(9).fillColor('#666666')
       .text('Google | 2020 - Present', { align: 'left' });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a3c5e')
       .text('Senior Software Engineer', { align: 'left' });
    doc.font('Helvetica').fontSize(9).fillColor('#333333')
       .text('• Led a team of 5 engineers in redesigning the core API platform', { align: 'left' })
       .text('• Reduced API response times by 40% through caching optimization', { align: 'left' })
       .text('• Implemented CI/CD pipelines reducing deployment time by 60%', { align: 'left' });
    
    doc.moveDown(0.5);
    
    // Job 2
    doc.font('Helvetica').fontSize(9).fillColor('#666666')
       .text('Amazon | 2017 - 2020', { align: 'left' });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a3c5e')
       .text('Software Engineer II', { align: 'left' });
    doc.font('Helvetica').fontSize(9).fillColor('#333333')
       .text('• Developed microservices handling 10M+ daily transactions', { align: 'left' })
       .text('• Designed and implemented real-time monitoring dashboard', { align: 'left' });
    
    doc.moveDown(0.5);
    
    // Divider
    doc.strokeColor('#1a3c5e').lineWidth(1)
       .moveTo(56, doc.y).lineTo(doc.page.width - 56, doc.y).stroke();
    
    doc.moveDown(0.5);
    
    // Skills section
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a3c5e')
       .text('SKILLS', { align: 'left' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor('#333333')
       .text('Languages: JavaScript, TypeScript, Python, Go, Java', { align: 'left' })
       .text('Frameworks: React, Next.js, Node.js, Django, FastAPI', { align: 'left' })
       .text('Cloud: AWS, GCP, Docker, Kubernetes, Terraform', { align: 'left' });
    
    doc.end();
  });
}

async function testImport() {
  // Create test PDF
  const pdfBuffer = await createTestPdf();
  console.log(`Created test PDF: ${pdfBuffer.length} bytes`);
  
  // Test PDF import API
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('file', pdfBuffer, { filename: 'test-resume.pdf', contentType: 'application/pdf' });
  
  const response = await fetch('http://localhost:3000/api/import-pdf', {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });
  
  const result = await response.json();
  console.log('\n=== PDF Import Result ===');
  console.log('Success:', result.success);
  console.log('Pages:', result.pageCount);
  console.log('\n--- Detected Format ---');
  if (result.format) {
    console.log('Font Family:', result.format.fontFamily);
    console.log('Font Sizes:', JSON.stringify(result.format.fontSizes, null, 2));
    console.log('Colors:', JSON.stringify(result.format.colors, null, 2));
    console.log('Margins:', JSON.stringify(result.format.margins, null, 2));
    console.log('Header Align:', result.format.headerAlign);
    console.log('Line Height:', result.format.lineHeight);
    console.log('Name Letter Spacing:', result.format.nameLetterSpacing);
    console.log('Section Letter Spacing:', result.format.sectionLetterSpacing);
    console.log('Has Photo:', result.format.hasPhoto);
    console.log('Show Subtitle:', result.format.showSubtitle);
    console.log('Footer:', JSON.stringify(result.format.footer, null, 2));
  }
  console.log('\n--- Extracted Data ---');
  if (result.data) {
    console.log('Name:', result.data.personal.fullName);
    console.log('Email:', result.data.personal.email);
    console.log('Phone:', result.data.personal.phone);
    console.log('Summary:', result.data.summary?.substring(0, 80) + '...');
    console.log('Sections:', result.data.sections?.map(s => `${s.title} (${s.entries.length} entries)`).join(', '));
  }
}

testImport().catch(console.error);
