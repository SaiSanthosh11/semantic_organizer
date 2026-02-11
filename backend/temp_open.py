@app.get("/open")
def open_file_api(path: str):
    """
    Opens the file at the given path in the default OS application.
    IMPORTANT: validate path to prevent arbitrary file access.
    """
    # Security check: ensure path is within watched directory
    abs_path = os.path.abspath(path)
    if not abs_path.startswith(watched_directory):
        return {"error": "Access denied"}

    if os.path.exists(abs_path):
        os.startfile(abs_path) # Windows specific
        return {"status": "opened"}
    return {"error": "File not found"}
