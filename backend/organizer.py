import os
import shutil
from processor import extract_text
# from semantic import SemanticAnalyzer

# We will instantiate SemanticAnalyzer here or inject it
# analyzer = SemanticAnalyzer()

def organize_file(file_path, root_dir, analyzer):
    """
    Analyzes the file at file_path and moves it to a semantic folder within root_dir.
    """
    if os.path.isdir(file_path):
        return

    filename = os.path.basename(file_path)
    
    # optimization: check if file is already in a semantic folder
    # For now, let's assume root_dir has mixed files and we want to organize them
    # But we want to avoid loops (moving file -> triggers modify -> moves again)
    
    try:
        text = extract_text(file_path)
        if not text:
            print(f"No text extracted for {filename}. Skipping.")
            return

        # Get embedding and update cluster
        analyzer.update_file(file_path, text)
        cluster_id = analyzer.get_cluster(file_path)
        folder_name = analyzer.get_cluster_name(cluster_id)
        
        target_dir = os.path.join(root_dir, folder_name)
        if not os.path.exists(target_dir):
            os.makedirs(target_dir)
            
        target_path = os.path.join(target_dir, filename)
        
        # Don't move if already there
        # Check for duplicates (filename collision OR content collision)
        from processor import get_file_hash
        src_hash = get_file_hash(file_path)
        
        # Check against ALL files in the target folder to find content duplicates
        # even if filenames are different
        if os.path.exists(target_dir):
            for existing_file in os.listdir(target_dir):
                existing_path = os.path.join(target_dir, existing_file)
                if os.path.isfile(existing_path):
                     dest_hash = get_file_hash(existing_path)
                     if src_hash and dest_hash and src_hash == dest_hash:
                         print(f"Duplicate content found (matches {existing_file}). Removing {filename}.")
                         try:
                            os.remove(file_path)
                         except:
                            pass
                         return

        if os.path.exists(target_path):
             # Filename collision but DIFFERENT content (checked above)
             # Rename source
             base, ext = os.path.splitext(filename)
             import time
             new_filename = f"{base}_{int(time.time())}{ext}"
             target_path = os.path.join(target_dir, new_filename)
             print(f"Filename collision, renaming to {new_filename}")

        print(f"Moving {filename} to {folder_name}")
        shutil.move(file_path, target_path)
        
    except Exception as e:
        print(f"Error organizing {filename}: {e}")
