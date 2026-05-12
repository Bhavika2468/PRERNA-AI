@echo off
cd /d "C:\Users\bhavi\OneDrive\Dokumente\prerna-project\prerna-ai-private\prerna-speech"
python -m uvicorn main:app --port 8000 --reload
