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

    def clear(self):
        self.file_embeddings = {}
        self.file_contents = {}
        self.labels = {}
        self.cluster_names = {}
        if os.path.exists(CLUSTER_FILE):
            os.remove(CLUSTER_FILE)
        print("Semantic state cleared.")

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
            
    def recluster(self, algorithm='DBSCAN'):
        if not self.file_embeddings:
             self.clustering_model = None
             self.labels = {}
             self.cluster_names = {}
             return

        embeddings = list(self.file_embeddings.values())
        files = list(self.file_embeddings.keys())
        
        if len(files) < 2:
            self.labels = {f: 0 for f in files}
            self.generate_names()
            return

        if algorithm == 'KMEANS':
            from sklearn.cluster import KMeans
            # Better heuristic: sqrt of files, capped between 2 and 8
            n_clusters = max(2, min(int(np.sqrt(len(files))), 8))
            if len(files) < n_clusters:
                n_clusters = len(files)
            self.clustering_model = KMeans(n_clusters=n_clusters, n_init='auto')
        else:
            # Agglomerative Clustering (DBSCAN alternative in this context)
            self.clustering_model = AgglomerativeClustering(
                n_clusters=None, 
                distance_threshold=SIMILARITY_THRESHOLD,
                compute_full_tree=True
            )
        
        self.clustering_model.fit(embeddings)
        self.labels = {files[i]: int(self.clustering_model.labels_[i]) for i in range(len(files))}
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
                # TF-IDF for top keywords (unigrams and bigrams)
                vectorizer = TfidfVectorizer(stop_words='english', max_features=3, ngram_range=(1,2))
                vectorizer.fit([combined_text])
                # Get feature names and their scores to pick best
                feature_names = vectorizer.get_feature_names_out()
                
                # Simple heuristic: join top 2 keywords if available
                if len(feature_names) > 0:
                    # Capitalize each word
                    name = "_".join([w.title() for w in feature_names[:2]])
                    self.cluster_names[label] = name
                else:
                    self.cluster_names[label] = f"Topic_{label}"
            except Exception as e:
                 print(f"Naming error: {e}")
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

    def sync_from_disk(self, root_dir):
        """
        Scans the disk and updates labels/names based on physical folder structure.
        Ensures the UI reflects ACTUAL disk state.
        """
        new_labels = {}
        new_cluster_names = {}
        folder_to_id = {}
        next_id = 0

        if not os.path.exists(root_dir):
            return

        for item in os.listdir(root_dir):
            item_path = os.path.abspath(os.path.join(root_dir, item))
            if os.path.isdir(item_path):
                cluster_id = next_id
                folder_to_id[item] = cluster_id
                new_cluster_names[cluster_id] = item
                next_id += 1
                
                # Scan subfiles
                for sub_item in os.listdir(item_path):
                    sub_path = os.path.abspath(os.path.join(item_path, sub_item))
                    if os.path.isfile(sub_path):
                        new_labels[sub_path] = cluster_id
            elif os.path.isfile(item_path):
                # File in root
                new_labels[item_path] = -1

        self.labels = new_labels
        self.cluster_names = new_cluster_names
        print(f"Engine synced with disk: {len(new_labels)} files, {len(new_cluster_names)} folders.")
