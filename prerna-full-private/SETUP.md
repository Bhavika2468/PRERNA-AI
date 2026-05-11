# PRERNA AI — Setup Guide

This project has **two parts** that run together:

1. **`prerna-web/`** — The frontend (HTML/JS/CSS, runs in browser)
2. **`prerna-speech/`** — The Python backend (AI speech & wellbeing analysis)

---

## Prerequisites

Install these first (one time only):

| Tool | Download | Why |
|---|---|---|
| **Node.js** (v18+) | https://nodejs.org | For the web frontend |
| **Python** (3.10+) | https://python.org | For the AI backend |

---

## Step 1 — Run the Frontend (prerna-web)

Open a terminal, go into `prerna-web/`, and run:

```bash
cd prerna-web
npm install
npm run dev
```

It will print a local URL like `http://localhost:5173` — open that in your browser.

---

## Step 2 — Run the Python Backend (prerna-speech)

Open a **second terminal**, go into `prerna-speech/`, and run:

```bash
cd prerna-speech
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The backend will start at `http://localhost:8000`.

---

## Notes

- Both terminals need to stay open while using the app.
- The frontend (`npm run dev`) and backend (`uvicorn`) must run **at the same time**.
- This project is **fully local** — no internet or API keys needed for core features.
- If `pip install` is slow, it's downloading AI models (MediaPipe, Whisper) — normal the first time.

---

## Quick Troubleshooting

| Problem | Fix |
|---|---|
| `npm: command not found` | Install Node.js from nodejs.org |
| `pip: command not found` | Install Python from python.org, check "Add to PATH" during install |
| Port already in use | Change port: `npm run dev -- --port 3000` or `uvicorn main:app --port 8001` |
| `uvicorn: command not found` | Try `python -m uvicorn main:app --reload` |
