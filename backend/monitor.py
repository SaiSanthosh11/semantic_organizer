import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os

class FileMonitorHandler(FileSystemEventHandler):
    def __init__(self, callback):
        self.callback = callback

    def on_created(self, event):
        if event.is_directory:
            return
            
        # IGNORE events in subdirectories. We only want to organize files dropped in the ROOT
        # processed files are moved to subfolders, so we shouldn't touch them again
        # We need to pass root_dir to the handler to check this
        if hasattr(self, 'root_dir') and os.path.dirname(event.src_path) != os.path.abspath(self.root_dir):
            return

        print(f"New file detected: {event.src_path}")
        # Add small delay to ensure file write is complete
        time.sleep(1.0)
        self.callback(event.src_path, "created")

    def on_modified(self, event):
        if event.is_directory:
            return

        if hasattr(self, 'root_dir') and os.path.dirname(event.src_path) != os.path.abspath(self.root_dir):
            return

        print(f"File modified: {event.src_path}")
        self.callback(event.src_path, "modified")

    def on_moved(self, event):
        if not event.is_directory:
             if hasattr(self, 'root_dir') and os.path.dirname(event.dest_path) == os.path.abspath(self.root_dir):
                 print(f"File moved to root: {event.dest_path}")
                 self.callback(event.dest_path, "moved")

class FileMonitor:
    def __init__(self, path, callback):
        self.path = path
        self.callback = callback
        self.observer = Observer()

    def start(self):
        event_handler = FileMonitorHandler(self.callback)
        event_handler.root_dir = self.path # Inject root dir for filtering
        self.observer.schedule(event_handler, self.path, recursive=True)
        self.observer.start()

    def stop(self):
        self.observer.stop()
        self.observer.join()
