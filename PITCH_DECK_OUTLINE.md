# RarePath — Pitch Deck Outline
## AI-Powered Rare Disease Diagnostic Assistant | HackHayward 2026

---

## Slide 1: Title
**RarePath**
AI-Powered Rare Disease Diagnostic Assistant
HackHayward 2026

---

## Slide 2: The Problem
- **300 million people** worldwide live with a rare disease
- Average time to diagnosis: **5–7 years**
- Patients see an average of **8 doctors** before getting a correct diagnosis
- **95% of rare diseases** have no FDA-approved treatment — early diagnosis is critical
- Clinicians in resource-limited settings lack access to specialist knowledge and rare disease databases

---

## Slide 3: The Solution
**RarePath** is an AI diagnostic assistant that maps patient symptoms to rare diseases in seconds.

**How it works:**
1. Clinician enters symptoms (typed or captured via Omi wearable)
2. Symptoms are standardized to HPO ontology (19,944 medical terms)
3. Cross-referenced against 4,335 Orphanet rare diseases
4. LLM generates ranked differential diagnosis with probabilities
5. Live research citations + multilingual voice briefings delivered instantly

**From symptoms to diagnosis in under 15 seconds.**

---

## Slide 4: Key Features

### Intelligent Symptom Mapping
- 3-tier HPO autocomplete: prefix → substring → fuzzy matching
- Handles typos and casual language ("headache" → HP:0002315)

### Differential Diagnosis Engine
- Top 5 ranked candidates with probability scores
- Confirmatory tests with cost estimates (optimized for resource-limited settings)
- Red flags and uncertainty notes for clinical decision support

### Omi Wearable Integration
- Voice-to-diagnosis pipeline via Omi AI hardware
- Real-time transcript streaming + conversation accumulation
- Speak symptoms naturally — auto-mapped to HPO terms

### Multilingual Voice Briefings
- On-demand audio summaries in 10 languages
- English, Spanish, Hindi, French, German, Portuguese, Chinese, Japanese, Korean, Arabic
- ElevenLabs Multilingual v2 + LLM translation

### Live Research & Citations
- Perplexity Sonar integration for real-time literature
- Active clinical trials, recent advances (2023–2025), specialist centers
- Up to 5 cited sources per diagnosis

### Federated Learning Dashboard
- Animated visualization of privacy-preserving model training
- 7 global hospital nodes (UCSF, Johns Hopkins, Charité, etc.)
- Demonstrates how hospitals can collaborate without sharing patient data

### Clinical Report Export
- Professional PDF with HPO mapping table, probability bars, confirmatory tests
- Report ID, clinical disclaimer, print-optimized layout

---

## Slide 5: Technology & Innovation

### Architecture
```
Patient → Omi Wearable → Webhook → FastAPI Backend → React Frontend
                                      ├── HPO Fuzzy Matching (rapidfuzz)
                                      ├── Disease Index (Orphanet 4,335 diseases)
                                      ├── LLM Diagnosis (Groq/Claude)
                                      ├── Live Research (Perplexity Sonar)
                                      ├── Voice Synthesis (ElevenLabs)
                                      └── Federation Simulation (FedAvg)
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Custom CSS |
| Backend | Python, FastAPI, asyncio |
| LLM | Groq (Llama 3.3 70B) / Claude Sonnet |
| Medical Data | HPO Ontology, Orphanet |
| Voice | ElevenLabs Multilingual v2 |
| Research | Perplexity Sonar API |
| Hardware | Omi AI Wearable |
| Deployment | Vercel (frontend + serverless) |

### Key Innovations
1. **Dual-mode symptom input** — typed text or voice via wearable hardware
2. **3-tier fuzzy HPO matching** — handles medical jargon and casual language
3. **Resource-optimized prompting** — LLM favors low-cost confirmatory tests for global health equity
4. **On-demand multilingual voice** — only generates when requested (10 languages)
5. **Privacy-preserving federated learning** — demonstrates hospital collaboration without data sharing
6. **Full diagnostic pipeline in <15 seconds** — HPO mapping → disease lookup → LLM reasoning → research → voice

---

## Slide 6: Market & Opportunity

### The Gap
- Rare disease diagnostics is a **$5.4B market** growing at 12% CAGR
- No widely adopted AI tool specifically targets rare disease differential diagnosis
- Existing tools (e.g., FindZebra, Ada Health) lack real-time research, voice output, and wearable integration

### Who Uses RarePath
- **Primary care physicians** encountering unfamiliar symptom clusters
- **Geneticists and specialists** seeking second opinions
- **Rural/underserved clinics** with limited specialist access
- **Medical students** learning rare disease recognition

### Impact Potential
- Reduce diagnostic odyssey from **years to minutes**
- Bridge the knowledge gap in resource-limited settings
- Multilingual support reaches non-English-speaking populations
- Federated learning enables cross-institutional research without privacy risk

---

## Slide 7: Demo Highlights
*(Screenshots or live demo)*

1. **Input** — Enter "progressive muscle weakness, difficulty climbing stairs, enlarged calves"
2. **HPO Mapping** — Auto-maps to Abnormality of muscle morphology, Proximal muscle weakness, etc.
3. **Diagnosis** — #1 Duchenne Muscular Dystrophy (42%), with confirmatory test: Dystrophin gene analysis ($200–$500)
4. **Research** — Live citations from PubMed, ClinicalTrials.gov
5. **Voice** — One-click audio briefing in Spanish for the patient's family
6. **Omi** — Speak symptoms into wearable → auto-populate diagnosis form

---

## Slide 8: Team

| Name | Role |
|------|------|
| [Team Member 1] | Full-Stack Development, AI Pipeline |
| [Team Member 2] | Frontend/UX, Data Visualization |
| [Team Member 3] | Backend, Medical Data Pipeline |
| [Team Member 4] | Research, Hardware Integration |

**Built in 24 hours at HackHayward 2026.**

---

## Slide 9: What's Next
- Clinical validation with real diagnostic cases
- Integration with EHR systems (FHIR)
- Expand disease database beyond Orphanet
- Real federated learning across partner institutions
- Mobile app for point-of-care use
- FDA pathway for clinical decision support

---

## Slide 10: Try It

**Live Demo:** rarepath.vercel.app
**GitHub:** github.com/lotuseana/rarepath

*RarePath — Because no one should wait 7 years for a diagnosis.*
