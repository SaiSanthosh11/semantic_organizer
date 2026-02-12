import sys
import os
from processor import extract_text

file_path = r"C:\Users\vijay\.gemini\antigravity\scratch\semantic_organizer\test_docs\UNIT IV CSE AI R22 2025-2026.pdf"

if os.path.exists(file_path):
    print(f"Testing extraction for: {file_path}")
    text = extract_text(file_path)
    if text:
        print(f"Extraction successful! Length: {len(text)}")
        print("First 100 characters:")
        print(text[:100])
    else:
        print("Extraction failed or returned empty text.")
else:
    print(f"File not found: {file_path}")
