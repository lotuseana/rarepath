"""
research.py — Perplexity Agent API integration.
Fetches live clinical trials, recent literature, and specialist directories
for the top diagnosed condition.
"""

import os
import httpx
from dotenv import load_dotenv

load_dotenv()

PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"


async def fetch_research(disease_name: str) -> dict:
    """
    Query Perplexity for live clinical research on a rare disease.
    Returns structured research data or empty dict on failure.
    """
    api_key = os.getenv("PERPLEXITY_API_KEY")
    if not api_key:
        return {}

    prompt = f"""Search for current clinical information about {disease_name}:

1. Active clinical trials (ClinicalTrials.gov) — list up to 3 with title, phase, and location
2. Recent treatment advances or case reports (2023-2025)
3. Key patient advocacy organizations or specialist centers

Format your response as concise bullet points under these three headings.
Be specific — include trial IDs, institution names, and dates where available."""

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                PERPLEXITY_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "sonar",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a clinical research assistant. Provide accurate, current medical information with specific details. Be concise."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "max_tokens": 600,
                    "temperature": 0.1,
                    "return_citations": True,
                }
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            citations = data.get("citations", [])

            return {
                "summary": content,
                "citations": citations[:5],  # top 5 sources
                "disease": disease_name,
            }

    except Exception:
        return {}
