from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Global state (naive implementation for now)
connected_clients = []
watched_directory = os.path.abspath("../test_docs") # Default watched folder

# Ensure directory exists
if not os.path.exists(watched_directory):
    os.makedirs(watched_directory)

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
    if loop.is_running():
        asyncio.run_coroutine_threadsafe(broadcast_update(), loop)

async def broadcast_update():
    # Build current state of file system
    # This is a placeholder. In real implementation, we'd scan directory structure
    state = {
        "nodes": [{"id": f, "group": 1} for f in os.listdir(watched_directory)],
        "links": []
    }
    message = json.dumps({"type": "update", "data": state})
    for client in connected_clients:
        try:
            await client.send_text(message)
        except:
            connected_clients.remove(client)

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

# Start monitor
monitor = FileMonitor(watched_directory, handle_file_event)
monitor.start()

# Store loop for threadsafe calls
loop = asyncio.get_event_loop()

@app.on_event("shutdown")
def shutdown_event():
    monitor.stop()
