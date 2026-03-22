"""
federation.py — Simulated federated learning data.

Runs a fake FedAvg simulation across 3 virtual hospital nodes using
the Orphanet disease data split into 3 subsets. Saves convergence
metrics to data/convergence.json for the dashboard to replay.

Run once to regenerate: python3 -m backend.federation
"""

import json
import random
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
OUTPUT_FILE = DATA_DIR / "convergence.json"

HOSPITALS = [
    {"id": "node_a", "name": "UCSF Medical Center",          "location": "San Francisco, CA",  "patients": 2847},
    {"id": "node_b", "name": "Hayward Community Clinic",      "location": "Hayward, CA",         "patients":  892},
    {"id": "node_c", "name": "Lagos University Hospital",     "location": "Lagos, Nigeria",      "patients": 1634},
    {"id": "node_d", "name": "Johns Hopkins Hospital",        "location": "Baltimore, MD",       "patients": 3201},
    {"id": "node_e", "name": "Great Ormond Street Hospital",  "location": "London, UK",          "patients": 1978},
    {"id": "node_f", "name": "Charité – Universitätsmedizin","location": "Berlin, Germany",     "patients": 2456},
    {"id": "node_g", "name": "Apollo Hospitals",             "location": "Chennai, India",      "patients": 1103},
]

NUM_ROUNDS = 20


def simulate_convergence() -> dict:
    """
    Simulate FedAvg training across 7 nodes for NUM_ROUNDS rounds.
    Each node starts with lower accuracy and converges toward a global optimum.
    Returns structured convergence data for dashboard replay.
    """
    random.seed(42)

    # Starting accuracy per node (each has different data quality / disease prevalence)
    node_start  = {"node_a": 0.52, "node_b": 0.41, "node_c": 0.47,
                   "node_d": 0.55, "node_e": 0.50, "node_f": 0.48, "node_g": 0.43}
    node_target = {"node_a": 0.89, "node_b": 0.85, "node_c": 0.88,
                   "node_d": 0.91, "node_e": 0.90, "node_f": 0.89, "node_g": 0.86}
    global_acc = 0.48

    rounds = []
    for r in range(1, NUM_ROUNDS + 1):
        progress = r / NUM_ROUNDS
        # Sigmoid-like convergence curve
        curve = progress ** 0.6

        node_metrics = []
        for node in HOSPITALS:
            nid = node["id"]
            start = node_start[nid]
            target = node_target[nid]
            acc = start + (target - start) * curve + random.uniform(-0.008, 0.008)
            acc = round(min(max(acc, 0), 1), 4)
            loss = round(max(0.05, 1.2 * (1 - acc) + random.uniform(-0.02, 0.02)), 4)
            weights_kb = round(random.uniform(180, 240), 1)
            node_metrics.append({
                "node_id": nid,
                "accuracy": acc,
                "loss": loss,
                "weights_kb": weights_kb,
                "samples_used": node["patients"],
            })

        global_acc = round(
            sum(m["accuracy"] for m in node_metrics) / len(node_metrics) + random.uniform(-0.005, 0.005),
            4
        )

        rounds.append({
            "round": r,
            "global_accuracy": global_acc,
            "nodes": node_metrics,
            "total_weight_exchanges_kb": round(sum(m["weights_kb"] for m in node_metrics), 1),
        })

    return {
        "hospitals": HOSPITALS,
        "total_rounds": NUM_ROUNDS,
        "final_global_accuracy": rounds[-1]["global_accuracy"],
        "rounds": rounds,
    }


def get_or_generate() -> dict:
    """Load existing convergence data or generate fresh simulation."""
    if OUTPUT_FILE.exists():
        return json.loads(OUTPUT_FILE.read_text())
    data = simulate_convergence()
    OUTPUT_FILE.write_text(json.dumps(data, indent=2))
    return data


if __name__ == "__main__":
    data = simulate_convergence()
    OUTPUT_FILE.write_text(json.dumps(data, indent=2))
    print(f"Generated {NUM_ROUNDS} rounds of convergence data")
    print(f"Final global accuracy: {data['final_global_accuracy']:.1%}")
    print(f"Saved to {OUTPUT_FILE}")
