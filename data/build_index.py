"""
build_index.py — Build HPO term list and HPO→disease reverse index from raw data files.

Outputs:
  hpo_terms.json       — list of {code, label, synonyms} for fuzzy matching
  disease_index.json   — map of HPO code → list of diseases with that symptom
  diseases.json        — map of orphacode → full disease record (name, hpo_terms, frequency)

Run: python3 build_index.py
"""

import json
import xml.etree.ElementTree as ET
from collections import defaultdict

# ── 1. Parse HPO terms ────────────────────────────────────────────────────────

print("Parsing HPO terms...")
with open("hpo.json") as f:
    hpo_raw = json.load(f)

hpo_terms = {}  # code → {label, synonyms, definition}
for node in hpo_raw["graphs"][0]["nodes"]:
    if node.get("type") != "CLASS":
        continue
    raw_id = node["id"]  # e.g. "http://purl.obolibrary.org/obo/HP_0003560"
    if "HP_" not in raw_id:
        continue
    code = "HP:" + raw_id.split("HP_")[1]  # → "HP:0003560"
    label = node.get("lbl", "")
    if not label:
        continue

    meta = node.get("meta", {})
    synonyms = [s["val"] for s in meta.get("synonyms", [])]
    definition = meta.get("definition", {}).get("val", "")

    hpo_terms[code] = {
        "code": code,
        "label": label,
        "synonyms": synonyms,
        "definition": definition,
    }

print(f"  Loaded {len(hpo_terms)} HPO terms")

# Save flat list for fuzzy matching at runtime
hpo_list = list(hpo_terms.values())
with open("hpo_terms.json", "w") as f:
    json.dump(hpo_list, f)
print(f"  Wrote hpo_terms.json ({len(hpo_list)} terms)")

# ── 2. Parse Orphanet disease→HPO mappings ───────────────────────────────────

print("Parsing Orphanet phenotypes...")
tree = ET.parse("orphanet_phenotypes.xml")
root = tree.getroot()

diseases = {}       # orphacode → disease record
hpo_to_diseases = defaultdict(list)  # HPO code → list of disease refs

for disorder in root.iter("Disorder"):
    orpha_code = disorder.findtext("OrphaCode")
    name_el = disorder.find("Name")
    name = name_el.text if name_el is not None else ""
    if not orpha_code or not name:
        continue

    assoc_list = disorder.find("HPODisorderAssociationList")
    if assoc_list is None:
        continue

    hpo_associations = []
    for assoc in assoc_list.findall("HPODisorderAssociation"):
        hpo_id_el = assoc.find(".//HPOId")
        hpo_term_el = assoc.find(".//HPOTerm")
        freq_el = assoc.find(".//HPOFrequency/Name")

        if hpo_id_el is None or hpo_term_el is None:
            continue

        hpo_code = hpo_id_el.text  # e.g. "HP:0003560"
        hpo_label = hpo_term_el.text
        frequency = freq_el.text if freq_el is not None else "Unknown"

        hpo_associations.append({
            "code": hpo_code,
            "label": hpo_label,
            "frequency": frequency,
        })

    if not hpo_associations:
        continue

    disease_record = {
        "orpha_code": orpha_code,
        "name": name,
        "hpo_terms": hpo_associations,
    }
    diseases[orpha_code] = disease_record

    # Build reverse index: HPO code → diseases
    for assoc in hpo_associations:
        hpo_to_diseases[assoc["code"]].append({
            "orpha_code": orpha_code,
            "name": name,
            "frequency": assoc["frequency"],
        })

print(f"  Loaded {len(diseases)} diseases")
print(f"  Reverse index covers {len(hpo_to_diseases)} HPO codes")

# Save diseases
with open("diseases.json", "w") as f:
    json.dump(diseases, f)
print(f"  Wrote diseases.json")

# Save reverse index
with open("disease_index.json", "w") as f:
    json.dump(hpo_to_diseases, f)
print(f"  Wrote disease_index.json")

# ── 3. Quick validation ───────────────────────────────────────────────────────

print("\nValidation — Duchenne test case:")
# HP:0003560 = muscular dystrophy, HP:0003236 = elevated CK
test_hpo = ["HP:0003560", "HP:0003236"]
candidate_counts = defaultdict(int)

for code in test_hpo:
    for disease in hpo_to_diseases.get(code, []):
        candidate_counts[disease["name"]] += 1

# Sort by number of matching HPO terms
ranked = sorted(candidate_counts.items(), key=lambda x: x[1], reverse=True)
print(f"  Top 10 candidates for {test_hpo}:")
for name, count in ranked[:10]:
    print(f"    {count}/{len(test_hpo)} HPO matches — {name}")

print("\nDone. Files written to data/")
