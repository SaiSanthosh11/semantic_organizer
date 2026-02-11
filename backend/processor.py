import os
import PyPDF2

def extract_text(file_path):
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()

    if ext == '.txt':
        encodings = ['utf-8', 'utf-16', 'latin-1']
        for enc in encodings:
            try:
                with open(file_path, 'r', encoding=enc) as f:
                    return f.read()
            except Exception:
                continue
        print(f"Failed to read txt file {file_path} with supported encodings.")
        return ""
            
    elif ext == '.pdf':
        try:
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                return text
        except Exception as e:
            print(f"Error reading pdf file {file_path}: {e}")
            return ""
            
    return ""
