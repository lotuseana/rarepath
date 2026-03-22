"""
main.py — FastAPI backend for RarePath.

Routes:
  POST /api/diagnose       — full diagnostic pipeline
  GET  /api/hpo/search     — HPO fuzzy match (for frontend autocomplete)
  GET  /api/health         — health check
  POST /api/omi/memory     — Omi memory webhook (conversation ended)
  POST /api/omi/transcript — Omi real-time transcript webhook
  GET  /api/omi/latest     — poll latest Omi-captured symptoms
"""

import asyncio
import time
from fastapi import FastAPI, HTTPException, Request
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
    return {
        "status": "ok",
        "llm_provider": os.getenv("LLM_PROVIDER", "NOT SET"),
        "groq_key": "set" if os.getenv("GROQ_API_KEY") else "MISSING",
        "perplexity_key": "set" if os.getenv("PERPLEXITY_API_KEY") else "MISSING",
        "elevenlabs_key": "set" if os.getenv("ELEVENLABS_API_KEY") else "MISSING",
    }


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

    candidates = result.get("candidates", [])
    uncertainty_note = result.get("uncertainty_note", "")
    audio_en = audio_es = None

    # Fire research in parallel — non-blocking
    research = None
    top_disease = candidates[0].get("disease", "") if candidates else ""

    if top_disease and os.getenv("PERPLEXITY_API_KEY"):
        try:
            research = await fetch_research(top_disease) or None
        except Exception:
            pass

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


# ── Omi Integration ──────────────────────────────────────────────────────────
# Stores the latest Omi-captured transcript per user so the frontend can poll it.

_omi_store: dict[str, dict] = {}


# ── On-demand Voice ──────────────────────────────────────────────────────

class VoiceRequest(BaseModel):
    candidates: list[dict]
    uncertainty_note: str = ""
    language: str = "en"  # en, es, hi, fr, de, pt, zh, ja, ko, ar


LANGUAGE_NAMES = {
    "en": "English", "es": "Spanish", "hi": "Hindi",
    "fr": "French", "de": "German", "pt": "Portuguese",
    "zh": "Chinese", "ja": "Japanese", "ko": "Korean", "ar": "Arabic",
}


@app.post("/api/voice")
async def generate_voice(req: VoiceRequest):
    """Generate audio briefing on demand for a selected language."""
    if not os.getenv("ELEVENLABS_API_KEY"):
        raise HTTPException(status_code=503, detail="ElevenLabs API key not configured")
    if not req.candidates:
        raise HTTPException(status_code=400, detail="No candidates provided")

    summary_en = build_summary(req.candidates, req.uncertainty_note)

    if req.language == "en":
        text = summary_en
    else:
        lang_name = LANGUAGE_NAMES.get(req.language, req.language)
        text = await asyncio.get_event_loop().run_in_executor(
            None, translate_summary, summary_en, lang_name
        )

    try:
        audio = await asyncio.get_event_loop().run_in_executor(
            None, synthesize, text, req.language
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice synthesis failed: {str(e)}")

    return {
        "audio": audio,
        "language": req.language,
        "language_name": LANGUAGE_NAMES.get(req.language, req.language),
    }


@app.get("/api/voice/languages")
def voice_languages():
    """List available voice languages."""
    return {"languages": [
        {"code": k, "name": v} for k, v in LANGUAGE_NAMES.items()
    ]}


# ── Omi Integration ──────────────────────────────────────────────────────────

@app.post("/api/omi/memory")
async def omi_memory_webhook(request: Request, uid: str = "default"):
    """
    Omi Memory webhook — fires when a conversation ends.
    Extracts the full transcript and maps symptoms via HPO.
    """
    body = await request.json()
    segments = body.get("transcript_segments", [])
    if not segments:
        return {"message": "no transcript"}

    full_text = " ".join(seg.get("text", "") for seg in segments)
    hpo_terms = match_symptoms_to_hpo(full_text)

    entry = {
        "source": "omi_memory",
        "transcript": full_text,
        "symptoms": ", ".join(t["label"] for t in hpo_terms),
        "hpo_terms": hpo_terms,
        "timestamp": time.time(),
    }
    _omi_store[uid] = entry
    _omi_store["default"] = entry
    return {"message": f"Captured {len(hpo_terms)} symptoms from conversation"}


@app.post("/api/omi/transcript")
async def omi_realtime_webhook(request: Request, uid: str = "default", session_id: str = ""):
    """
    Omi Real-time Transcript webhook — fires as the user speaks.
    Accumulates segments and continuously maps symptoms.
    """
    body = await request.json()

    # Handle all formats: list of segments, dict with segments/transcript_segments
    if isinstance(body, dict):
        segments = body.get("segments", body.get("transcript_segments", []))
        if not segments and body.get("text"):
            segments = [{"text": body["text"]}]
        # session_id may be in the body
        if not session_id:
            session_id = body.get("session_id", "")
    elif isinstance(body, list):
        segments = body
    else:
        return {"message": "no segments"}

    if not segments:
        return {"message": "no segments"}

    new_text = " ".join(seg.get("text", "") for seg in segments)

    # Accumulate within the same session — append to existing transcript
    existing = _omi_store.get("default", {})
    if existing.get("session_id") == session_id and session_id:
        prev = existing.get("transcript", "")
        full_text = f"{prev} {new_text}".strip()
    else:
        full_text = new_text

    hpo_terms = match_symptoms_to_hpo(full_text)

    entry = {
        "source": "omi_realtime",
        "session_id": session_id,
        "transcript": full_text,
        "symptoms": ", ".join(t["label"] for t in hpo_terms),
        "hpo_terms": hpo_terms,
        "timestamp": time.time(),
    }
    _omi_store[uid] = entry
    _omi_store["default"] = entry
    return {"message": f"Processing — {len(hpo_terms)} symptoms detected so far"}



@app.post("/api/omi/reset")
def omi_reset(uid: str = "default"):
    """Clear stored Omi data for a fresh conversation."""
    _omi_store.pop(uid, None)
    _omi_store.pop("default", None)
    return {"message": "Omi data cleared"}


@app.get("/api/omi/latest")
def omi_latest(uid: str = "default"):
    """Poll the latest Omi-captured symptoms for the frontend."""
    data = _omi_store.get(uid)
    if not data:
        return {"available": False}
    return {"available": True, **data}
