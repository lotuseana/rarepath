"""
main.py — FastAPI backend for RarePath.

Routes:
  POST /api/diagnose       — full diagnostic pipeline
  GET  /api/hpo/search     — HPO fuzzy match (for frontend autocomplete)
  GET  /api/health         — health check
"""

import asyncio
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

import os
from .hpo_matcher import match_symptoms_to_hpo, autocomplete_hpo
from .diagnosis import run_diagnosis
from .voice import build_summary, synthesize, translate_summary
from .federation import get_or_generate
from .research import fetch_research

app = FastAPI(title="RarePath API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────

class DiagnoseRequest(BaseModel):
    symptoms: str
    labs: dict | None = None
    exam_findings: str = ""
    family_history: str = ""


class HPOTerm(BaseModel):
    code: str
    label: str
    confidence: float


class DiagnoseResponse(BaseModel):
    hpo_terms: list[HPOTerm]
    candidates: list[dict]
    uncertainty_note: str
    red_flags: str | None
    audio_en: str | None   # base64 MP3
    audio_es: str | None   # base64 MP3
    research: dict | None  # Perplexity live research
    latency_ms: int
    provider: str


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/federation")
def federation():
    """Return pre-computed federated learning convergence data."""
    return get_or_generate()


@app.get("/api/hpo/search")
def hpo_search(q: str):
    """Fuzzy search HPO terms — used for frontend symptom autocomplete."""
    if not q or len(q) < 2:
        return {"results": []}
    matches = autocomplete_hpo(q)
    return {"results": matches}


@app.post("/api/diagnose", response_model=DiagnoseResponse)
async def diagnose(req: DiagnoseRequest):
    if not req.symptoms.strip():
        raise HTTPException(status_code=400, detail="Symptoms are required")

    start = time.time()

    # Step 1: map symptoms → HPO terms
    hpo_terms = match_symptoms_to_hpo(req.symptoms)
    if not hpo_terms:
        raise HTTPException(
            status_code=422,
            detail="Could not map symptoms to HPO terms. Try describing symptoms more specifically."
        )

    # Step 2: run LLM diagnosis (with timeout — never hang the demo)
    try:
        result = await asyncio.wait_for(
            run_diagnosis(
                symptoms=req.symptoms,
                hpo_terms=hpo_terms,
                labs=req.labs,
                exam_findings=req.exam_findings,
                family_history=req.family_history,
            ),
            timeout=20.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Diagnosis timed out after 20 seconds. Please try again."
        )

    # Step 3: generate voice summaries in parallel (EN + ES)
    # Failures are non-blocking — diagnosis still returns without audio
    candidates = result.get("candidates", [])
    uncertainty_note = result.get("uncertainty_note", "")
    audio_en = audio_es = None

    # Step 4: fire voice + research in parallel — both non-blocking
    research = None
    top_disease = candidates[0].get("disease", "") if candidates else ""

    async def get_voice():
        nonlocal audio_en, audio_es
        if not candidates or not os.getenv("ELEVENLABS_API_KEY"):
            return
        summary_en_text = build_summary(candidates, uncertainty_note)
        summary_es_text = await asyncio.get_event_loop().run_in_executor(
            None, translate_summary, summary_en_text
        )
        try:
            a_en, a_es = await asyncio.gather(
                asyncio.get_event_loop().run_in_executor(None, synthesize, summary_en_text, "en"),
                asyncio.get_event_loop().run_in_executor(None, synthesize, summary_es_text, "es"),
            )
            audio_en, audio_es = a_en, a_es
        except Exception:
            pass

    async def get_research():
        nonlocal research
        if not top_disease or not os.getenv("PERPLEXITY_API_KEY"):
            return
        try:
            research = await fetch_research(top_disease) or None
        except Exception:
            pass

    await asyncio.gather(get_voice(), get_research())

    return DiagnoseResponse(
        hpo_terms=[HPOTerm(**t) for t in hpo_terms],
        candidates=candidates,
        uncertainty_note=uncertainty_note,
        red_flags=result.get("red_flags"),
        audio_en=audio_en,
        audio_es=audio_es,
        research=research,
        latency_ms=int((time.time() - start) * 1000),
        provider=os.getenv("LLM_PROVIDER", "groq"),
    )
