"""
voice.py — ElevenLabs multilingual voice synthesis.
Generates a spoken clinical summary for the top diagnosis.

Supported languages: English (en), Spanish (es), Hindi (hi)
"""

import os
import base64
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()

# Multilingual v2 model supports EN, ES, HI and 28 other languages
MODEL_ID = "eleven_multilingual_v2"

# Voice: "Rachel" — clear, professional, neutral accent
VOICE_ID = "21m00Tcm4TlvDq8ikWAM"

LANGUAGE_CODES = {
    "en": "English",
    "es": "Spanish",
    "hi": "Hindi",
}


def build_summary(candidates: list[dict], uncertainty_note: str = "") -> str:
    """Build the spoken clinical summary text from diagnosis results."""
    if not candidates:
        return "No diagnosis candidates found. Please provide more specific symptoms."

    top = candidates[0]
    name = top.get("disease", "Unknown condition")
    prob = top.get("probability", 0)
    explanation = top.get("explanation", "")
    test = top.get("confirmatory_test", {})
    test_name = test.get("name", "")
    test_cost = test.get("cost_range", "")

    lines = [
        f"Clinical summary for the top diagnosis.",
        f"Most likely diagnosis: {name}, with {prob} percent probability.",
        f"{explanation}",
    ]

    if test_name:
        lines.append(f"Recommended confirmatory test: {test_name}.")
        if test_cost:
            lines.append(f"Estimated cost: {test_cost}.")

    if uncertainty_note:
        lines.append(f"To increase confidence: {uncertainty_note}")

    if len(candidates) > 1:
        others = ", ".join(c["disease"] for c in candidates[1:3])
        lines.append(f"Other conditions to consider: {others}.")

    return " ".join(lines)


def translate_summary(english_text: str) -> str:
    """Translate the English clinical summary to Spanish using the configured LLM."""
    from .llm import get_diagnosis
    prompt = (
        "Translate the following clinical summary to Spanish. "
        "Return ONLY the translated text, no explanations or notes.\n\n"
        f"{english_text}"
    )
    try:
        return get_diagnosis(prompt)
    except Exception:
        # Fallback: basic Spanish template
        return english_text


def synthesize(text: str, language: str = "en") -> str:
    """
    Synthesize text to speech using ElevenLabs.
    Returns base64-encoded MP3 audio string.
    """
    client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

    # The multilingual v2 model matches pronunciation to the language of the input text.
    # Translation is handled upstream by translate_summary() before calling synthesize().

    audio_generator = client.text_to_speech.convert(
        voice_id=VOICE_ID,
        model_id=MODEL_ID,
        text=text,
        output_format="mp3_44100_128",
    )

    # Collect all chunks from the generator
    audio_bytes = b"".join(audio_generator)
    return base64.b64encode(audio_bytes).decode("utf-8")
