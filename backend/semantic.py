from sentence_transformers import SentenceTransformer
from sklearn.cluster import AgglomerativeClustering
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
import os
import pickle

# Constants
MODEL_NAME = 'all-MiniLM-L6-v2'
CLUSTER_FILE = 'clusters.pkl'
SIMILARITY_THRESHOLD = 1.5 # Distance threshold for Agglomerative (Ward linkage)

class SemanticAnalyzer:
    def __init__(self):
        print(f"Loading model {MODEL_NAME}...")
        self.model = SentenceTransformer(MODEL_NAME)
        self.file_embeddings = {} # path -> embedding
        self.file_contents = {} # path -> text content (stored for keywords)
        self.clustering_model = None
        self.labels = {}
        self.cluster_names = {}
        self.load_state()

    def get_embedding(self, text):
        if not text.strip():
            return np.zeros(384)
        return self.model.encode(text)

    def update_file(self, file_path, text):
        embedding = self.get_embedding(text)
        self.file_embeddings[file_path] = embedding
        self.file_contents[file_path] = text
        self.recluster()

    def remove_file(self, file_path):
        self.file_embeddings.pop(file_path, None)
        self.file_contents.pop(file_path, None)
        self.recluster()
            
    def recluster(self):
        if not self.file_embeddings:
             self.clustering_model = None
             self.labels = {}
             self.cluster_names = {}
             return

        embeddings = list(self.file_embeddings.values())
        files = list(self.file_embeddings.keys())
        
        if len(files) == 1:
            self.labels = {files[0]: 0}
            self.generate_names()
            return

        # Agglomerative Clustering with distance threshold
        # n_clusters=None means it determines number of clusters based on threshold
        self.clustering_model = AgglomerativeClustering(
            n_clusters=None, 
            distance_threshold=SIMILARITY_THRESHOLD,
            compute_full_tree=True
        )
        self.clustering_model.fit(embeddings)
        
        self.labels = {files[i]: self.clustering_model.labels_[i] for i in range(len(files))}
        self.generate_names()
        self.save_state()

    def generate_names(self):
        """Generates names for each cluster using TF-IDF keywords."""
        cluster_docs = {}
        unique_labels = set(self.labels.values())
        
        for file_path, label in self.labels.items():
            if label not in cluster_docs:
                cluster_docs[label] = []
            if file_path in self.file_contents:
                cluster_docs[label].append(self.file_contents[file_path])
        
        self.cluster_names = {}
        for label, docs in cluster_docs.items():
            combined_text = " ".join(docs)
            if not combined_text.strip():
                self.cluster_names[label] = f"Misc_{label}"
                continue
                
            try:
                # Simple TF-IDF for top keyword
                vectorizer = TfidfVectorizer(stop_words='english', max_features=1)
                vectorizer.fit([combined_text])
                keywords = vectorizer.get_feature_names_out()
                if keywords:
                    name = keywords[0].capitalize()
                    self.cluster_names[label] = name
                else:
                    self.cluster_names[label] = f"Topic_{label}"
            except:
                 self.cluster_names[label] = f"Topic_{label}"

    def get_cluster(self, file_path):
        return self.labels.get(file_path, -1)

    def get_cluster_name(self, cluster_id):
        if cluster_id == -1: return "Unsorted"
        return self.cluster_names.get(cluster_id, f"Topic_{cluster_id}")

    def save_state(self):
        with open(CLUSTER_FILE, 'wb') as f:
            pickle.dump({
                'embeddings': self.file_embeddings,
                'contents': self.file_contents # Persist content for naming
            }, f)

    def load_state(self):
        if os.path.exists(CLUSTER_FILE):
            try:
                with open(CLUSTER_FILE, 'rb') as f:
                    data = pickle.load(f)
                    self.file_embeddings = data.get('embeddings', {})
                    self.file_contents = data.get('contents', {})
                    # Re-run clustering to restore state
                    self.recluster() 
            except:
                print("Failed to load cluster state.")
