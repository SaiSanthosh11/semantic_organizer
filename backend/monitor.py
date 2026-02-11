import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os

class FileMonitorHandler(FileSystemEventHandler):
    def __init__(self, callback):
        self.callback = callback

    def on_created(self, event):
        if not event.is_directory:
            self.callback(event.src_path, "created")

    def on_modified(self, event):
        if not event.is_directory:
            self.callback(event.src_path, "modified")

    def on_moved(self, event):
        if not event.is_directory:
            self.callback(event.dest_path, "moved")

class FileMonitor:
    def __init__(self, path, callback):
        self.path = path
        self.callback = callback
        self.observer = Observer()

    def start(self):
        event_handler = FileMonitorHandler(self.callback)
        self.observer.schedule(event_handler, self.path, recursive=True)
        self.observer.start()

    def stop(self):
        self.observer.stop()
        self.observer.join()
