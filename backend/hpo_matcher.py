"""
hpo_matcher.py — Fuzzy match free-text symptoms to HPO terms using rapidfuzz.
"""

from rapidfuzz import process, fuzz
from .index import HPO_SEARCH_CORPUS, HPO_TERMS

MATCH_THRESHOLD = 75  # 0-100 score; 75 = reasonably confident match
MAX_RESULTS = 5

# Pre-extract labels list once for faster searching
_CORPUS_LABELS = [label for label, _ in HPO_SEARCH_CORPUS]


def match_symptoms_to_hpo(symptom_text: str) -> list[dict]:
    """
    Given a free-text symptom string, return top HPO term matches.
    Used by the /api/diagnose pipeline for full symptom phrases.
    """
    phrases = [p.strip() for p in symptom_text.replace("\n", ",").split(",") if p.strip()]
    if not phrases:
        phrases = [symptom_text.strip()]

    seen_codes = set()
    results = []

    for phrase in phrases:
        matches = process.extract(
            phrase.lower(),
            _CORPUS_LABELS,
            scorer=fuzz.token_sort_ratio,
            limit=MAX_RESULTS,
        )
        for match_label, score, idx in matches:
            if score < MATCH_THRESHOLD:
                continue
            code = HPO_SEARCH_CORPUS[idx][1]
            if code in seen_codes:
                continue
            seen_codes.add(code)
            results.append({
                "code": code,
                "label": match_label,
                "confidence": round(score / 100, 2),
            })

    results.sort(key=lambda x: x["confidence"], reverse=True)
    return results[:10]


def autocomplete_hpo(query: str, limit: int = 8) -> list[dict]:
    """
    Autocomplete search for the HPO search bar.

    Strategy (in priority order):
      1. Word-prefix match — any word in the label starts with the query
         (e.g. "aut" → "autism spectrum", "autosomal dominant")
      2. Substring match — query appears anywhere in the label
         (e.g. "cardio" → "hypertrophic cardiomyopathy")
      3. Fuzzy fallback — for typos (e.g. "seizre" → "seizure")

    Shorter labels are ranked higher within each tier (more specific = better).
    """
    q = query.strip().lower()
    if len(q) < 2:
        return []

    prefix_hits = []   # tier 1: a word starts with the query
    substr_hits = []   # tier 2: query is a substring but not word-prefix
    seen_codes = set()

    for label, code in HPO_SEARCH_CORPUS:
        if code in seen_codes:
            continue

        # Check if any word in the label starts with the query
        words = label.split()
        is_prefix = any(w.startswith(q) for w in words)

        if is_prefix:
            seen_codes.add(code)
            # Boost: label itself starts with query (exact prefix) gets priority
            boost = 0 if label.startswith(q) else 1
            prefix_hits.append((label, code, boost, len(label)))
        elif q in label:
            seen_codes.add(code)
            substr_hits.append((label, code, len(label)))

    # Sort: prefix matches first (exact prefix > word prefix > shorter labels)
    prefix_hits.sort(key=lambda x: (x[2], x[3]))
    substr_hits.sort(key=lambda x: x[2])

    results = []
    for label, code, *_ in prefix_hits:
        results.append({"code": code, "label": label, "confidence": 0.95})
        if len(results) >= limit:
            return results

    for label, code, *_ in substr_hits:
        results.append({"code": code, "label": label, "confidence": 0.85})
        if len(results) >= limit:
            return results

    # Tier 3: fuzzy fallback for typos — only if we don't have enough results
    if len(results) < limit:
        fuzzy_matches = process.extract(
            q, _CORPUS_LABELS, scorer=fuzz.WRatio, limit=limit * 3,
        )
        for match_label, score, idx in fuzzy_matches:
            if score < 60:
                continue
            code = HPO_SEARCH_CORPUS[idx][1]
            if code in seen_codes:
                continue
            seen_codes.add(code)
            results.append({
                "code": code,
                "label": match_label,
                "confidence": round(score / 100, 2),
            })
            if len(results) >= limit:
                break

    return results
