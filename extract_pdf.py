import pypdf
import sys

if len(sys.argv) < 2:
    print("Usage: python extract_pdf.py <lesson_number>")
    sys.exit(1)

lesson_num = sys.argv[1]
pdf_path = rf"c:\Users\Admin\Desktop\Long\repos\Tiengtrungduongdai\SachPdf\Đương đại 1 ({lesson_num}).pdf"
output_path = f"extracted_lesson_{lesson_num}_utf8.txt"

try:
    with open(pdf_path, "rb") as f, open(output_path, "w", encoding="utf-8") as out_f:
        reader = pypdf.PdfReader(f)
        for i, page in enumerate(reader.pages):
            out_f.write(f"\n{'='*20} Page {i+1} {'='*20}\n")
            out_f.write(page.extract_text())
            out_f.write("\n")
except Exception as e:
    print(f"Error reading PDF: {e}")
