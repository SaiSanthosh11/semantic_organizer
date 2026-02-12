from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil
from watchdog.observers import Observer
from monitor import FileMonitor
from processor import extract_text
from semantic import SemanticAnalyzer
from organizer import organize_file
import asyncio
import os
import json

analyzer = SemanticAnalyzer()
app = FastAPI()

# Global Config
watched_directory = os.path.abspath("../test_docs")
connected_clients = []

# Ensure directory exists
if not os.path.exists(watched_directory):
    os.makedirs(watched_directory)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from pydantic import BaseModel

class AnalysisRequest(BaseModel):
    algorithm: str

def cleanup_empty_folders(root):
    """Recursively removes empty folders under the specified root."""
    for dirpath, dirnames, filenames in os.walk(root, topdown=False):
        if dirpath == root:
            continue
        if not dirnames and not filenames:
            try:
                os.rmdir(dirpath)
                print(f"Removed empty folder: {dirpath}")
            except Exception as e:
                print(f"Error removing {dirpath}: {e}")

@app.post("/analyze")
async def run_analysis(req: AnalysisRequest):
    print(f"Triggering manual analysis with {req.algorithm}")
    # Update pipeline status for broadcast
    status = {
        "Load Documents": "done",
        "Preprocessing": "active",
        "BERT Embeddings": "pending",
        "Cosine Similarity": "pending",
        "Clustering": "pending"
    }
    await broadcast_update(status)
    
    # Run organization on all files
    print("Re-clustering...")
    analyzer.recluster(algorithm=req.algorithm)
    
    # 2. Physically move files based on new labels
    print("Applying physical reorganization...")
    from organizer import organize_file
    for file_path, label in list(analyzer.labels.items()):
        if os.path.exists(file_path):
            organize_file(file_path, watched_directory, analyzer)
    
    # 3. Final sync to ensure labels reflect the NEW paths
    analyzer.sync_from_disk(watched_directory)
    
    # 4. Cleanup empty folders
    cleanup_empty_folders(watched_directory)
    
    status["Preprocessing"] = "done"
    status["BERT Embeddings"] = "done"
    status["Cosine Similarity"] = "done"
    status["Clustering"] = "done"
    await broadcast_update(status)
    
    return {"status": "Analysis complete and filesystem reorganized"}

@app.get("/download")
async def download_file(path: str):
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=os.path.basename(path))

@app.delete("/delete")
async def delete_file(path: str):
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    try:
        os.remove(path)
        # Clear from analyzer
        analyzer.labels.pop(path, None)
        analyzer.file_contents.pop(path, None)
        # Re-sync and broadcast
        analyzer.sync_from_disk(watched_directory)
        
        # Cleanup parent folder if empty
        cleanup_empty_folders(watched_directory)
        
        await broadcast_update()
        return {"status": "File deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    target_path = os.path.join(watched_directory, file.filename)
    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Trigger organization explicitly instead of relying on background monitor
    print(f"Organizing uploaded file: {target_path}")
    organize_file(target_path, watched_directory, analyzer)
    
    # Broadcast update to frontend
    await broadcast_update()
    
    return {"filename": file.filename, "status": "uploaded and organized"}

@app.get("/declutter")
async def declutter_files():
    """Moves all files from subfolders back to root and resets semantic state."""
    print("Decluttering...")
    
    # 1. Clear analyzer state
    analyzer.clear()
    
    # 2. Move files back to root
    for root, dirs, files in os.walk(watched_directory, topdown=False):
        if root == watched_directory:
            continue
            
        for name in files:
            source = os.path.join(root, name)
            dest = os.path.join(watched_directory, name)
            
            # Handle name collision
            if os.path.exists(dest):
                base, ext = os.path.splitext(name)
                dest = os.path.join(watched_directory, f"{base}_reset{ext}")
                
            try:
                shutil.move(source, dest)
            except Exception as e:
                print(f"Error moving {name}: {e}")
                
        # 3. Remove empty directories
        for name in dirs:
            dir_path = os.path.join(root, name)
            try:
                if not os.listdir(dir_path):
                    os.rmdir(dir_path)
            except:
                pass

    await broadcast_update()
    return {"status": "decluttered"}

@app.get("/open")
def open_file_api(path: str):
    # Security check: ensure path is within watched directory
    # For demo simplicity, we relax this check slightly but should be careful
    abs_path = os.path.abspath(os.path.join(watched_directory, path))
    
    if os.path.exists(abs_path):
        try:
            os.startfile(abs_path)
            return {"status": "opened"}
        except Exception as e:
            return {"error": str(e)}
    return {"error": "File not found"}

# Global state (Already defined at top)

def handle_file_event(file_path, event_type):
    print(f"Event: {event_type} on {file_path}")
    
    # Ignore if directory
    if os.path.isdir(file_path):
        return

    # Process and organize
    if event_type in ["created", "modified", "moved"]:
         print(f"Organizing file: {file_path}")
         organize_file(file_path, watched_directory, analyzer)

    # Notify frontend
    if loop and loop.is_running():
        asyncio.run_coroutine_threadsafe(broadcast_update(), loop)

async def broadcast_update(pipeline_status=None):
    # Build current state of the semantic engine
    try:
        # Sync with physical disk structure first
        analyzer.sync_from_disk(watched_directory)
        
        # Default pipeline status if not provided
        if not pipeline_status:
            pipeline_status = {
                "Load Documents": "done",
                "Preprocessing": "done",
                "BERT Embeddings": "done",
                "Cosine Similarity": "done",
                "Clustering": "done"
            }

        # Convert files to list of objects for frontend consistency
        files_list = []
        for path, label in analyzer.labels.items():
            try:
                stat = os.stat(path)
                size = stat.st_size
                modified_at = stat.st_mtime
                ext_str = str(os.path.splitext(str(path))[1])
                ext = ext_str.upper().replace('.', '') if ext_str else 'FILE'
            except:
                size = 0
                modified_at = 0
                ext = "UNKNOWN"

            # Extract simple keywords from content as heuristic
            content = analyzer.file_contents.get(path, "")
            words = [w.lower() for w in content.split() if len(w) > 4][:3]
            if not words: words = ["document", "file", "data"]

            files_list.append({
                "path": path,
                "name": os.path.basename(path),
                "cluster": int(label),
                "content": content[:200] + "...",
                "size": f"{size / 1024 / 1024:.1f} MB" if size > 1024*1024 else f"{size / 1024:.1f} KB",
                "modified": modified_at,
                "type": ext,
                "keywords": words,
                "confidence": 0.85 # Mock confidence score
            })

        data = {
            "clusters": {str(k): str(v) for k, v in analyzer.cluster_names.items()},
            "files": files_list,
            "pipeline": pipeline_status,
            "algorithm": "DBSCAN" # Placeholder for now
        }
        
        message = json.dumps({"type": "state", "data": data})
        
        for client in list(connected_clients):
            try:
                await client.send_text(message)
            except:
                if client in connected_clients:
                    connected_clients.remove(client)
    except Exception as e:
        print(f"Broadcast error: {e}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    print("WebSocket connection attempting...")
    await websocket.accept()
    print("WebSocket connection accepted")
    connected_clients.append(websocket)
    # Send initial state
    await broadcast_update()
    try:
        while True:
            data = await websocket.receive_text()
            print(f"Received: {data}")
    except WebSocketDisconnect:
        print("WebSocket disconnected")
        connected_clients.remove(websocket)

# Global state
loop = None
monitor = None

@app.on_event("startup")
async def startup_event():
    # Capture the running loop for threadsafe broadcasts
    global loop, monitor
    loop = asyncio.get_running_loop()
    
    def handle_file_event(path, event_type):
        print(f"Background monitor: {event_type} event for {path}")
        # 1. Organize the file physically
        organize_file(path, watched_directory, analyzer)
        # 2. Trigger UI update (thread-safe)
        if loop:
            asyncio.run_coroutine_threadsafe(broadcast_update(), loop)

    # Start file monitoring
    print(f"Starting background monitor on {watched_directory}...")
    monitor = FileMonitor(watched_directory, handle_file_event)
    monitor.start()
    
    print("SEFS Engine Online & Monitoring OS.")

@app.on_event("shutdown")
def shutdown_event():
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
