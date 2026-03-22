"""
index.py — Load HPO terms and disease index into memory at startup.
Used by the HPO fuzzy matcher and Claude context builder.
"""

import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

# Flat list of {code, label, synonyms} — used for fuzzy matching
HPO_TERMS: list[dict] = json.loads((DATA_DIR / "hpo_terms.json").read_text())

# HPO code → list of {orpha_code, name, frequency}
DISEASE_INDEX: dict[str, list] = json.loads((DATA_DIR / "disease_index.json").read_text())

# Orpha code → full disease record {name, hpo_terms}
DISEASES: dict[str, dict] = json.loads((DATA_DIR / "diseases.json").read_text())

# Build a flat list of (label, code) tuples + synonyms for rapidfuzz
HPO_SEARCH_CORPUS: list[tuple[str, str]] = []
for term in HPO_TERMS:
    HPO_SEARCH_CORPUS.append((term["label"].lower(), term["code"]))
    for syn in term.get("synonyms", []):
        HPO_SEARCH_CORPUS.append((syn.lower(), term["code"]))
