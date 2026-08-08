"""
Generate a perfect 2-page resume PDF.
Renders each .page div separately to ensure exact page boundaries,
then merges them. Also adds PDF metadata.
"""
import asyncio
import os
import sys

async def generate_pdf():
    from playwright.async_api import async_playwright
    
    html_path = os.path.abspath("/home/z/my-project/scripts/resume_pdf.html")
    output_dir = "/home/z/my-project/download"
    final_path = os.path.join(output_dir, "Pratham_P_Pansare_Resume.pdf")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        
        page_pdfs = []
        for i in range(2):  # 2 pages
            pw_page = await browser.new_page()
            await pw_page.goto(f"file://{html_path}", wait_until="networkidle", timeout=30000)
            await pw_page.wait_for_timeout(2500)  # Wait for fonts to fully load
            
            # Hide all pages except the current one
            await pw_page.evaluate(f"""
                const pages = document.querySelectorAll('.page');
                pages.forEach((p, idx) => {{
                    if (idx !== {i}) {{
                        p.style.display = 'none';
                    }} else {{
                        p.style.display = 'block';
                        p.style.pageBreakAfter = 'auto';
                    }}
                }});
            """)
            
            temp_pdf = os.path.join(output_dir, f"_resume_page_{i}.pdf")
            await pw_page.pdf(
                path=temp_pdf,
                width="210mm",
                height="297mm",
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                print_background=True,
            )
            page_pdfs.append(temp_pdf)
            await pw_page.close()
        
        await browser.close()
    
    # Merge the individual page PDFs using pymupdf
    import fitz
    merged = fitz.open()
    
    for pdf_path in page_pdfs:
        single = fitz.open(pdf_path)
        # Find the page with the most content (skip blank overflow pages)
        best_page = 0
        best_len = 0
        for pg_idx in range(len(single)):
            text = single[pg_idx].get_text().strip()
            if len(text) > best_len:
                best_len = len(text)
                best_page = pg_idx
        if best_len > 20:  # Has meaningful content
            merged.insert_pdf(single, from_page=best_page, to_page=best_page)
        single.close()
    
    # Set metadata
    merged.set_metadata({
        "title": "Resume - Pratham P Pansare",
        "author": "Pratham P Pansare",
        "creator": "Z.ai",
        "subject": "Software Developer Resume",
    })
    
    merged.save(final_path)
    merged.close()
    
    # Clean up temp files
    for f in page_pdfs:
        try:
            os.remove(f)
        except:
            pass
    
    # Final verification
    doc = fitz.open(final_path)
    print(f"PDF generated: {final_path}")
    print(f"Pages: {len(doc)}")
    print(f"Size: {os.path.getsize(final_path) / 1024:.1f} KB")
    for i, page in enumerate(doc):
        text = page.get_text()
        word_count = len(text.split())
        # Check fill ratio
        rect = page.rect
        blocks = page.get_text("blocks")
        if blocks:
            min_y = min(b[1] for b in blocks)
            max_y = max(b[3] for b in blocks)
            fill_pct = (max_y - min_y) / rect.height * 100
        else:
            fill_pct = 0
        print(f"  Page {i+1}: ~{word_count} words, fill: {fill_pct:.0f}%")
    doc.close()

if __name__ == "__main__":
    asyncio.run(generate_pdf())
