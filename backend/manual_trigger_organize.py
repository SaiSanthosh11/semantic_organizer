import sys
import os
import asyncio
from main import handle_file_event

file_path = r"C:\Users\vijay\.gemini\antigravity\scratch\semantic_organizer\test_docs\UNIT IV CSE AI R22 2025-2026.pdf"

if os.path.exists(file_path):
    print(f"Manually triggering 'created' event for: {file_path}")
    handle_file_event(file_path, "created")
    print("Event handler finished. Check logs and the 'test_docs' directory.")
else:
    print(f"File not found: {file_path}")
