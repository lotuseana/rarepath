"""
llm.py — Provider-agnostic LLM client.
Switch between Groq (free, fast) and Claude (demo) via LLM_PROVIDER in .env.
"""

import os
from dotenv import load_dotenv

load_dotenv()

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq")


def get_diagnosis(prompt: str) -> str:
    """Call the configured LLM and return the response text."""
    if LLM_PROVIDER == "claude":
        return _call_claude(prompt)
    elif LLM_PROVIDER == "groq":
        return _call_groq(prompt)
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {LLM_PROVIDER}")


def _call_claude(prompt: str) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    msg = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    return msg.content[0].text


def _call_groq(prompt: str) -> str:
    from groq import Groq
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    msg = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
    )
    return msg.choices[0].message.content
