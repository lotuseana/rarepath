"""
diagnosis.py — Build Claude/Groq context from HPO terms + disease index,
call LLM, parse structured response.
"""

import json
from collections import defaultdict
from .index import DISEASE_INDEX, DISEASES
from .llm import get_diagnosis

MAX_DISEASE_CONTEXT = 20  # max diseases to pass as context to LLM


def get_candidates_from_index(hpo_codes: list[str]) -> list[dict]:
    """
    Reverse-index lookup: given HPO codes, return top matching diseases
    ranked by number of HPO term overlaps.
    """
    candidate_counts = defaultdict(int)
    candidate_names = {}

    for code in hpo_codes:
        for disease in DISEASE_INDEX.get(code, []):
            orpha = disease["orpha_code"]
            candidate_counts[orpha] += 1
            candidate_names[orpha] = disease["name"]

    ranked = sorted(candidate_counts.items(), key=lambda x: x[1], reverse=True)
    results = []
    for orpha_code, overlap_count in ranked[:MAX_DISEASE_CONTEXT]:
        disease = DISEASES.get(orpha_code, {})
        results.append({
            "orpha_code": orpha_code,
            "name": candidate_names[orpha_code],
            "hpo_overlap": overlap_count,
            "total_hpo": len(disease.get("hpo_terms", [])),
            "hpo_terms": [t["label"] for t in disease.get("hpo_terms", [])[:10]],
        })
    return results


def build_prompt(
    symptoms: str,
    hpo_terms: list[dict],
    candidate_diseases: list[dict],
    labs: dict = None,
    exam_findings: str = "",
    family_history: str = "",
) -> str:
    hpo_summary = "\n".join(
        f"  - {t['label']} ({t['code']}, confidence: {t['confidence']})"
        for t in hpo_terms
    )
    disease_context = "\n".join(
        f"  - {d['name']} (Orphanet {d['orpha_code']}): "
        f"{d['hpo_overlap']}/{len(hpo_terms)} symptom matches. "
        f"Known symptoms: {', '.join(d['hpo_terms'][:5])}"
        for d in candidate_diseases
    )
    labs_str = json.dumps(labs, indent=2) if labs else "Not provided"

    return f"""You are a rare disease diagnostic assistant helping a clinician in a resource-limited setting.

PATIENT PRESENTATION:
- Symptoms: {symptoms}
- Lab values: {labs_str}
- Exam findings: {exam_findings or 'Not provided'}
- Family history: {family_history or 'Not provided'}

MAPPED HPO TERMS (standardized symptom codes):
{hpo_summary}

CANDIDATE DISEASES (from rare disease database, ranked by symptom overlap):
{disease_context}

Based on the patient presentation and candidate diseases above, provide:

1. TOP 5 DIFFERENTIAL DIAGNOSES — for each:
   - Disease name
   - Probability estimate (0-100%)
   - Plain-language explanation (1-2 sentences, suitable for a non-specialist)
   - Most important confirmatory test with estimated cost (USD)

2. UNCERTAINTY NOTE — in one sentence, name the single test that would most change your confidence

3. RED FLAGS — any findings that require urgent action

Respond in this exact JSON format:
{{
  "candidates": [
    {{
      "disease": "Disease Name",
      "probability": 68,
      "explanation": "Plain language explanation...",
      "confirmatory_test": {{"name": "Test name", "cost_range": "$40-80"}}
    }}
  ],
  "uncertainty_note": "A dystrophin gene panel would most change confidence.",
  "red_flags": "Immediate cardiology referral if cardiomyopathy confirmed."
}}"""


async def run_diagnosis(
    symptoms: str,
    hpo_terms: list[dict],
    labs: dict = None,
    exam_findings: str = "",
    family_history: str = "",
) -> dict:
    """Full diagnosis pipeline: index lookup → prompt → LLM → parse."""
    hpo_codes = [t["code"] for t in hpo_terms]
    candidates = get_candidates_from_index(hpo_codes)

    if not candidates:
        return {
            "candidates": [],
            "uncertainty_note": "No matching diseases found. Try more specific symptom descriptions.",
            "red_flags": None,
        }

    prompt = build_prompt(symptoms, hpo_terms, candidates, labs, exam_findings, family_history)

    raw = get_diagnosis(prompt)

    # Parse JSON response — LLMs sometimes wrap in markdown code blocks
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: return raw text wrapped in structure
        return {
            "candidates": [],
            "uncertainty_note": raw[:500],
            "red_flags": None,
            "parse_error": True,
        }
