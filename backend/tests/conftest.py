import os
import sys

# Add backend directory to sys.path so 'app' can be imported cleanly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
