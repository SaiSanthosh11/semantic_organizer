import os
import sys
from processor import get_file_hash

def clean_duplicates_aggressive(root_dir):
    print(f"Aggressively scanning {root_dir} for ANY duplicate content...")
    hashes = {} # hash -> first_file_path
    duplicates_count = 0
    files_checked = 0
    
    # Walk top-down
    for dirpath, _, filenames in os.walk(root_dir):
        for filename in filenames:
            file_path = os.path.join(dirpath, filename)
            files_checked += 1
            
            # Skip checking the clusters.pkl or system files
            if filename.endswith('.pkl') or filename.startswith('.'):
                continue
                
            file_hash = get_file_hash(file_path)
            
            if not file_hash:
                continue
                
            if file_hash in hashes:
                # Duplicate content found!
                original = hashes[file_hash]
                print(f"[DUPLICATE] {filename}")
                print(f"   Matches: {original}")
                print(f"   Action: Removing {filename}")
                try:
                    os.remove(file_path)
                    duplicates_count += 1
                except Exception as e:
                    print(f"   Error removing: {e}")
            else:
                # Store this as the "original"
                hashes[file_hash] = file_path
                
    print(f"Scan complete. Checked {files_checked} files.")
    print(f"Removed {duplicates_count} duplicates.")

if __name__ == "__main__":
    target_dir = os.path.abspath("../test_docs")
    if len(sys.argv) > 1:
        target_dir = sys.argv[1]
    
    if os.path.exists(target_dir):
        clean_duplicates_aggressive(target_dir)
    else:
        print(f"Directory not found: {target_dir}")
