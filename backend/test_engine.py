from semantic import SemanticAnalyzer
import os

print("Starting standalone test...")
try:
    analyzer = SemanticAnalyzer()
    print("Analyzer initialized successfully.")
    
    # Check if we can generate an embedding
    test_text = "This is a test document about artificial intelligence and neural networks."
    embedding = analyzer.model.encode([test_text])
    print(f"Embedding generated: {embedding.shape}")
    
except Exception as e:
    print(f"FAILED: {e}")
