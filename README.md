# SEFS: Semantic Entropy File System

SEFS is an intelligent, AI-powered document organizer that transforms your messy workspace into a semantically structured knowledge base. It uses state-of-the-art NLP (BERT) to understand the content of your files and automatically organizes them into meaningful clusters on your disk.

![SEFS Dashboard](backend/static/screenshot_placeholder.png) *(Preview available in project walkthrough)*

## 🚀 Key Features

*   **Autonomous Organization**: Automatically extracts text from PDFs, Text, and Markdown files.
*   **Semantic Clustering**: Uses BERT embeddings and DBSCAN/K-Means algorithms to group files by meaning, not just extension.
*   **Dual-Sync Engine**: Bidirectional synchronization between the UI and your physical Windows filesystem.
*   **High-Fidelity Dashboard**:
    *   **Interactive Node Graph**: A 2D force-directed graph with glowing hubs and data particles.
    *   **Dynamic Background**: Canvas-drawn grid that pans and zooms in perfect sync with your data.
    *   **Floating File Inspector**: Detailed metadata, semantic keywords, and confidence scores in a glassmorphic overlay.
*   **Direct File Actions**: View, Download, and Delete files directly from the web interface.
*   **Auto-Cleanup**: Automatically removes empty semantic folders after file deletion or reorganization.

## 🛠️ Technology Stack

*   **Frontend**: React (Vite, TypeScript), Lucide-React, React-Force-Graph-2D.
*   **Backend**: Python (FastAPI, Uvicorn), WebSockets for real-time updates.
*   **AI/NLP**: Sentence-Transformers (all-MiniLM-L6-v2), Scikit-Learn (DBSCAN, K-Means, TF-IDF).
*   **Monitoring**: Watchdog (Real-time OS file events).

## 📥 Installation & Setup

### Prerequisites
*   Node.js (v18+)
*   Python 3.8+

### 1. Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install fastapi uvicorn watchdog sentence-transformers scikit-learn pypdf
python main.py
```
*The server will start on `http://localhost:8001`.*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*The UI will be available on `http://localhost:5173`.*

## 📂 Project Structure

*   `/backend`: Semantic engine, file monitoring, and API endpoints.
*   `/frontend`: React application and interactive visualization.
*   `/test_docs`: The "Root" directory monitored by SEFS for file organization.

## 📜 License
MIT License - Created with Antigravity AI.
