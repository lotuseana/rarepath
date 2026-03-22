# RarePath

**AI-powered rare disease diagnostic assistant** — built at HackHayward 2026.

Rare diseases affect 400 million people worldwide, yet the average diagnostic journey takes 5-7 years. RarePath bridges this gap by combining medical ontology matching, LLM-powered differential diagnosis, live research retrieval, multilingual voice synthesis, and federated learning — all in a single clinical tool.

## What It Does

1. **Symptom-to-HPO Mapping** — Type symptoms in plain English. RarePath fuzzy-matches them against 19,944 terms from the Human Phenotype Ontology (HPO) with real-time autocomplete.

2. **Differential Diagnosis** — Cross-references matched HPO codes against 4,335 rare diseases from the Orphanet database, then uses an LLM to rank the top 5 candidates with probabilities, explanations, and confirmatory tests.

3. **Live Research** — Fetches the latest clinical trials, treatment guidelines, and research for the top diagnosis via Perplexity's Sonar API with cited sources.

4. **Multilingual Voice Briefing** — Generates spoken clinical summaries in English and Spanish using ElevenLabs multilingual v2, with LLM-powered translation for accurate Spanish output.

5. **Federated Learning Dashboard** — Visualizes how hospitals can collaboratively train diagnostic models without sharing patient data. Animated network topology shows the FedAvg protocol across 7 global hospital nodes with real-time convergence tracking.

6. **Clinical Report Export** — One-click PDF export of the full differential diagnosis, HPO mappings, research citations, and clinical recommendations.

## Architecture

```
frontend/ (Vite + React :5173)
├── App.jsx              Clinician view with HPO autocomplete, comparison mode, PDF export
├── FederationDashboard  Animated SVG network topology + convergence charts
├── api.js               Axios client for backend
└── App.css              Dark technical UI design system

backend/ (FastAPI :8003)
├── main.py              API routes: /diagnose, /hpo/search, /federation
├── hpo_matcher.py       rapidfuzz symptom → HPO term matching
├── diagnosis.py         Reverse index lookup + LLM differential diagnosis
├── llm.py               Groq (dev) / Claude (demo) provider switch
├── research.py          Perplexity Sonar live research + citations
├── voice.py             ElevenLabs EN + ES synthesis with LLM translation
├── federation.py        FedAvg simulation (7 nodes, 20 rounds)
└── index.py             HPO + Orphanet data loading

data/
├── hpo_terms.json       19,944 HPO ontology terms
├── disease_index.json   HPO code → disease reverse index
├── diseases.json        4,335 Orphanet rare diseases
└── convergence.json     Pre-computed federation convergence data
```

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd rarepath
pip install -r requirements.txt
cd frontend && npm install && cd ..

# 2. Configure environment
cp .env.example .env
# Fill in: GROQ_API_KEY, PERPLEXITY_API_KEY, ELEVENLABS_API_KEY

# 3. Run backend
python3 -m uvicorn backend.main:app --port 8003 --reload

# 4. Run frontend (separate terminal)
cd frontend && npm run dev
```

Open http://localhost:5173 in your browser.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Axios |
| Backend | Python, FastAPI, Pydantic |
| NLP | rapidfuzz (fuzzy string matching) |
| LLM | Groq (Llama 3.3 70B) / Anthropic Claude |
| Research | Perplexity Sonar API |
| Voice | ElevenLabs Multilingual v2 |
| Data | HPO (Human Phenotype Ontology), Orphanet |
| Design | Custom CSS, dark mode, teal accent system |

## Key Features

- **HPO Autocomplete** — Real-time search against 19,944 medical ontology terms as you type
- **5 Preset Cases** — DMD, Gaucher, Marfan, Ehlers-Danlos, Pompe disease demos
- **Progressive Loading** — Watch each pipeline stage execute in real time
- **Side-by-Side Comparison** — Compare up to 3 disease candidates with checkboxes
- **PDF Clinical Report** — Export a formatted report with disclaimer for clinical use
- **Multilingual Voice** — LLM-translated Spanish clinical summaries, not just English with a Spanish accent
- **Federated Learning Viz** — Animated broadcast/train/aggregate cycle across 7 global hospitals
- **Privacy-First** — Federation dashboard shows "0 patient records shared" — only model weights traverse the network

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_PROVIDER` | Yes | `groq` (default) or `claude` |
| `GROQ_API_KEY` | If groq | Groq API key |
| `ANTHROPIC_API_KEY` | If claude | Anthropic API key |
| `PERPLEXITY_API_KEY` | No | Enables live research citations |
| `ELEVENLABS_API_KEY` | No | Enables voice synthesis |

## Team

Built in 24 hours at HackHayward 2026.

## License

MIT
