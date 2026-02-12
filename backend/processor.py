import os
import pypdf

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
                reader = pypdf.PdfReader(f)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                return text
        except Exception as e:
            print(f"Error reading pdf file {file_path}: {e}")
            return ""
            
    return ""

import hashlib

def get_file_hash(file_path):
    """Calculates SHA256 hash of a file."""
    sha256_hash = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            # Read and update hash string value in blocks of 4K
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    except Exception as e:
        print(f"Error hashing file {file_path}: {e}")
        return None
