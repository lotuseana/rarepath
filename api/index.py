"""Vercel serverless entry point — exposes the FastAPI app."""
import sys
import os

# Ensure project root is on the path so `backend.*` imports resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app
