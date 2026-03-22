"""
federation.py — Real federated learning with FedAvg.

Trains a rare disease classifier across 7 simulated hospital nodes
using actual HPO/Orphanet data. Each hospital gets a non-IID subset
of diseases (geographic bias). Model weights are averaged (FedAvg)
each round — no patient data is shared.

Run to regenerate: python3 -m backend.federation
"""

import json
import random
import numpy as np
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
OUTPUT_FILE = DATA_DIR / "convergence.json"

HOSPITALS = [
    {"id": "node_a", "name": "UCSF Medical Center",          "location": "San Francisco, CA",  "patients": 0},
    {"id": "node_b", "name": "Hayward Community Clinic",      "location": "Hayward, CA",         "patients": 0},
    {"id": "node_c", "name": "Lagos University Hospital",     "location": "Lagos, Nigeria",      "patients": 0},
    {"id": "node_d", "name": "Johns Hopkins Hospital",        "location": "Baltimore, MD",       "patients": 0},
    {"id": "node_e", "name": "Great Ormond Street Hospital",  "location": "London, UK",          "patients": 0},
    {"id": "node_f", "name": "Charité – Universitätsmedizin","location": "Berlin, Germany",     "patients": 0},
    {"id": "node_g", "name": "Apollo Hospitals",             "location": "Chennai, India",      "patients": 0},
]

NUM_ROUNDS = 20
SAMPLES_PER_DISEASE = 8       # synthetic patients per disease per hospital that has it
LOCAL_EPOCHS = 2              # training epochs per round per node
LEARNING_RATE = 0.01
HIDDEN_DIM = 128
TOP_K_DISEASES = 200          # classify top-K most common diseases (keeps model small)


def load_data():
    """Load diseases and build feature matrix."""
    diseases = json.loads((DATA_DIR / "diseases.json").read_text())

    # Collect all HPO codes used across diseases
    all_hpo = set()
    for d in diseases.values():
        for t in d.get("hpo_terms", []):
            all_hpo.add(t["code"])
    hpo_list = sorted(all_hpo)
    hpo_to_idx = {code: i for i, code in enumerate(hpo_list)}

    # Pick top-K diseases by number of HPO terms (most well-characterized)
    disease_list = sorted(
        diseases.values(),
        key=lambda d: len(d.get("hpo_terms", [])),
        reverse=True,
    )[:TOP_K_DISEASES]
    disease_codes = [d["orpha_code"] for d in disease_list]
    disease_to_idx = {code: i for i, code in enumerate(disease_codes)}

    return disease_list, hpo_list, hpo_to_idx, disease_to_idx


def generate_synthetic_patients(disease, hpo_to_idx, num_features, n_samples=SAMPLES_PER_DISEASE):
    """
    Generate synthetic patients for a disease by randomly sampling
    subsets of its HPO terms (simulating incomplete presentations).
    """
    hpo_terms = disease.get("hpo_terms", [])
    if not hpo_terms:
        return []

    patients = []
    for _ in range(n_samples):
        # Each patient presents with 40-80% of the disease's symptoms
        frac = random.uniform(0.4, 0.8)
        n_present = max(1, int(len(hpo_terms) * frac))
        present = random.sample(hpo_terms, n_present)

        features = np.zeros(num_features, dtype=np.float32)
        for t in present:
            idx = hpo_to_idx.get(t["code"])
            if idx is not None:
                features[idx] = 1.0
        patients.append(features)

    return patients


def split_diseases_to_hospitals(disease_list):
    """
    Non-IID split: each hospital gets a biased subset of diseases.
    Simulates geographic/specialty differences.
    """
    random.shuffle(disease_list)
    n = len(disease_list)
    num_hospitals = len(HOSPITALS)

    # Each hospital gets ~60% of diseases, with overlap
    splits = []
    for i in range(num_hospitals):
        # Rotate through diseases with overlap
        start = int(i * n / num_hospitals * 0.4)
        count = int(n * 0.6)
        indices = [(start + j) % n for j in range(count)]
        splits.append([disease_list[idx] for idx in indices])

    return splits


class SimpleNet:
    """Minimal neural network: input → hidden → output (numpy only, no torch needed at runtime)."""

    def __init__(self, input_dim, hidden_dim, output_dim):
        # Xavier initialization
        self.w1 = np.random.randn(input_dim, hidden_dim).astype(np.float32) * np.sqrt(2.0 / input_dim)
        self.b1 = np.zeros(hidden_dim, dtype=np.float32)
        self.w2 = np.random.randn(hidden_dim, output_dim).astype(np.float32) * np.sqrt(2.0 / hidden_dim)
        self.b2 = np.zeros(output_dim, dtype=np.float32)

    def forward(self, x):
        """Forward pass: ReLU hidden, softmax output."""
        h = np.maximum(0, x @ self.w1 + self.b1)  # ReLU
        logits = h @ self.w2 + self.b2
        # Stable softmax
        logits -= logits.max(axis=-1, keepdims=True)
        exp = np.exp(logits)
        return exp / exp.sum(axis=-1, keepdims=True)

    def get_weights(self):
        return [self.w1.copy(), self.b1.copy(), self.w2.copy(), self.b2.copy()]

    def set_weights(self, weights):
        self.w1, self.b1, self.w2, self.b2 = [w.copy() for w in weights]

    def train_step(self, X, y_onehot, lr=LEARNING_RATE):
        """Single training step with backpropagation."""
        batch_size = X.shape[0]

        # Forward
        h = np.maximum(0, X @ self.w1 + self.b1)
        logits = h @ self.w2 + self.b2
        logits -= logits.max(axis=-1, keepdims=True)
        exp = np.exp(logits)
        probs = exp / exp.sum(axis=-1, keepdims=True)

        # Loss (cross-entropy)
        loss = -np.mean(np.sum(y_onehot * np.log(probs + 1e-8), axis=-1))

        # Backward
        d_logits = (probs - y_onehot) / batch_size
        d_w2 = h.T @ d_logits
        d_b2 = d_logits.sum(axis=0)
        d_h = d_logits @ self.w2.T
        d_h[h <= 0] = 0  # ReLU grad
        d_w1 = X.T @ d_h
        d_b1 = d_h.sum(axis=0)

        # Update
        self.w1 -= lr * d_w1
        self.b1 -= lr * d_b1
        self.w2 -= lr * d_w2
        self.b2 -= lr * d_b2

        return loss


def fedavg(weight_list, sample_counts):
    """Federated averaging: weighted mean of model weights by sample count."""
    total = sum(sample_counts)
    avg = []
    for layer_idx in range(len(weight_list[0])):
        weighted_sum = sum(
            w[layer_idx] * (n / total)
            for w, n in zip(weight_list, sample_counts)
        )
        avg.append(weighted_sum)
    return avg


def evaluate(model, X, y):
    """Compute accuracy and loss on a dataset."""
    if len(X) == 0:
        return 0.0, 1.0
    probs = model.forward(X)
    preds = np.argmax(probs, axis=-1)
    acc = np.mean(preds == y)
    # Cross-entropy loss
    y_onehot = np.zeros_like(probs)
    y_onehot[np.arange(len(y)), y] = 1.0
    loss = -np.mean(np.sum(y_onehot * np.log(probs + 1e-8), axis=-1))
    return float(acc), float(loss)


def simulate_convergence() -> dict:
    """
    Run real FedAvg training across 7 hospital nodes.
    Returns convergence data in the same format as before.
    """
    random.seed(42)
    np.random.seed(42)

    print("Loading disease data...")
    disease_list, hpo_list, hpo_to_idx, disease_to_idx = load_data()
    num_features = len(hpo_list)
    num_classes = len(disease_to_idx)
    print(f"  {num_features} HPO features, {num_classes} disease classes")

    # Split diseases across hospitals (non-IID)
    hospital_diseases = split_diseases_to_hospitals(disease_list)

    # Generate synthetic patient data per hospital
    print("Generating synthetic patients...")
    hospital_data = []
    for i, diseases in enumerate(hospital_diseases):
        X_list, y_list = [], []
        for disease in diseases:
            if disease["orpha_code"] not in disease_to_idx:
                continue
            label = disease_to_idx[disease["orpha_code"]]
            patients = generate_synthetic_patients(disease, hpo_to_idx, num_features)
            for p in patients:
                X_list.append(p)
                y_list.append(label)

        X = np.array(X_list, dtype=np.float32) if X_list else np.zeros((0, num_features), dtype=np.float32)
        y = np.array(y_list, dtype=np.int64) if y_list else np.zeros(0, dtype=np.int64)

        # Shuffle
        if len(X) > 0:
            perm = np.random.permutation(len(X))
            X, y = X[perm], y[perm]

        hospital_data.append((X, y))
        HOSPITALS[i]["patients"] = len(X)
        print(f"  {HOSPITALS[i]['name']}: {len(X)} patients, {len(set(y_list))} diseases")

    # Global test set: sample from all hospitals
    X_test_parts, y_test_parts = [], []
    for X, y in hospital_data:
        n = max(1, len(X) // 5)  # 20% for testing
        X_test_parts.append(X[:n])
        y_test_parts.append(y[:n])
    X_test = np.concatenate(X_test_parts)
    y_test = np.concatenate(y_test_parts)
    print(f"  Global test set: {len(X_test)} samples")

    # Initialize global model
    global_model = SimpleNet(num_features, HIDDEN_DIM, num_classes)

    # Run federated learning
    print(f"\nRunning FedAvg for {NUM_ROUNDS} rounds...")
    rounds = []

    for r in range(1, NUM_ROUNDS + 1):
        local_weights = []
        sample_counts = []
        node_metrics = []

        for i, (X_train, y_train) in enumerate(hospital_data):
            if len(X_train) == 0:
                continue

            # Create local model from global weights
            local_model = SimpleNet(num_features, HIDDEN_DIM, num_classes)
            local_model.set_weights(global_model.get_weights())

            # Local training
            n_train = len(X_train)
            batch_size = min(64, n_train)
            for epoch in range(LOCAL_EPOCHS):
                perm = np.random.permutation(n_train)
                for start in range(0, n_train, batch_size):
                    end = min(start + batch_size, n_train)
                    idx = perm[start:end]
                    batch_X = X_train[idx]
                    batch_y_onehot = np.zeros((len(idx), num_classes), dtype=np.float32)
                    batch_y_onehot[np.arange(len(idx)), y_train[idx]] = 1.0
                    local_model.train_step(batch_X, batch_y_onehot)

            # Evaluate local model
            acc, loss = evaluate(local_model, X_train, y_train)

            # Compute weight size (KB)
            weights = local_model.get_weights()
            weight_bytes = sum(w.nbytes for w in weights)
            weights_kb = round(weight_bytes / 1024, 1)

            local_weights.append(weights)
            sample_counts.append(n_train)
            node_metrics.append({
                "node_id": HOSPITALS[i]["id"],
                "accuracy": round(acc, 4),
                "loss": round(loss, 4),
                "weights_kb": weights_kb,
                "samples_used": n_train,
            })

        # FedAvg: aggregate local weights
        if local_weights:
            avg_weights = fedavg(local_weights, sample_counts)
            global_model.set_weights(avg_weights)

        # Evaluate global model
        global_acc, global_loss = evaluate(global_model, X_test, y_test)

        rounds.append({
            "round": r,
            "global_accuracy": round(global_acc, 4),
            "nodes": node_metrics,
            "total_weight_exchanges_kb": round(sum(m["weights_kb"] for m in node_metrics), 1),
        })
        print(f"  Round {r:2d}: global_acc={global_acc:.4f}, loss={global_loss:.4f}")

    result = {
        "hospitals": HOSPITALS,
        "total_rounds": NUM_ROUNDS,
        "final_global_accuracy": rounds[-1]["global_accuracy"],
        "rounds": rounds,
    }
    print(f"\nFinal global accuracy: {result['final_global_accuracy']:.2%}")
    return result


def get_or_generate() -> dict:
    """Load existing convergence data or generate fresh."""
    if OUTPUT_FILE.exists():
        return json.loads(OUTPUT_FILE.read_text())
    data = simulate_convergence()
    OUTPUT_FILE.write_text(json.dumps(data, indent=2))
    return data


if __name__ == "__main__":
    data = simulate_convergence()
    OUTPUT_FILE.write_text(json.dumps(data, indent=2))
    print(f"\nSaved to {OUTPUT_FILE}")
