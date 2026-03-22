# RarePath — HackHayward 2026

Rare disease diagnostic assistant. 4-person team, 24-hour hackathon.

## How to run

```bash
# Backend (from project root)
python3 -m uvicorn backend.main:app --port 8005 --reload

# Frontend
cd frontend && npm run dev
```

**Important:** Ports 8000–8003 are occupied by dead processes from earlier in the hackathon. Always use port 8005. Frontend BASE is hardcoded to `http://localhost:8005` in `frontend/src/api.js` and `FederationDashboard.jsx`.

## Architecture

```
frontend (Vite/React :5173)
    └── POST /api/diagnose
    └── GET  /api/federation
    └── GET  /api/hpo/search
backend (FastAPI :8003)
    ├── hpo_matcher.py    rapidfuzz symptom → HPO terms
    ├── diagnosis.py      reverse index lookup + LLM prompt
    ├── llm.py            groq (dev) / claude (demo) switch
    ├── research.py       Perplexity sonar live citations
    ├── voice.py          ElevenLabs EN + ES audio
    └── federation.py     FedAvg simulation (pre-computed)
data/
    ├── hpo_terms.json        19,944 HPO terms
    ├── disease_index.json    HPO code → disease reverse index
    ├── diseases.json         4,335 Orphanet diseases
    └── convergence.json      pre-computed federation data (7 nodes, 20 rounds)
```

## LLM provider

Currently: `LLM_PROVIDER=groq` → llama-3.3-70b-versatile (fast, free)
For demo:  `LLM_PROVIDER=claude` → claude-opus-4-6

Switch by editing `.env`. No code changes needed.

## Key env vars (.env)

```
LLM_PROVIDER=groq
GROQ_API_KEY=...
ANTHROPIC_API_KEY=       ← fill in before switching to claude
PERPLEXITY_API_KEY=...
ELEVENLABS_API_KEY=...
```

## Federation dashboard

7 hospital nodes: UCSF, Hayward, Lagos, Johns Hopkins, Great Ormond Street, Charité, Apollo Chennai.
Pre-computed sigmoid convergence. Final global accuracy: 88.5%.
To regenerate: `python3 -m backend.federation` (deletes and rewrites `data/convergence.json`).

## Design system

Dark technical UI. Accent: `#00d4a8` (teal). Background: `#07090f`. Surface: `#0b1018`.
No component library — all custom CSS in `App.css` and `Federation.css`.

## What's done

- [x] HPO + Orphanet data pipeline
- [x] Fuzzy symptom → HPO matching
- [x] LLM differential diagnosis (5 candidates, probabilities, confirmatory tests)
- [x] Perplexity live research + citations
- [x] ElevenLabs voice EN + ES
- [x] Federated learning dashboard with animated SVG network topology
- [x] Dark mode technical UI

## Still TODO

- [ ] Fill in `ANTHROPIC_API_KEY` and switch to `LLM_PROVIDER=claude` for demo
- [ ] README.md for GitHub submission
- [ ] Devpost pitch deck
- [ ] (Stretch) Hindi voice
