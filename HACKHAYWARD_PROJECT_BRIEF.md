# HackHayward 2026 — Rare Disease Diagnostic Platform: Complete Project Brief

> **Purpose of this document**: This is a comprehensive planning document to be loaded into Claude Code (paste into terminal or save as a file in your project). It contains all context from a planning session including the problem, technical architecture, hackathon-specific strategy, and build plan.

---

## Hackathon Context

- **Event**: HackHayward 2026, California State University East Bay
- **Theme**: "Build With AI & an Entrepreneurial Eye"
- **Duration**: 24 hours (overnight hackathon, March 21-22, 2026)
- **Builder plans to invest 48 hours of effort** (pre-work + event)
- **Deadline**: Mar 22, 2026 @ 8:00am PDT
- **Submission platform**: Devpost

### Required Submissions
1. GitHub Repository (public, with README)
2. Project Photos
3. Pitch Deck (PDF) — minimum: Problem, Solution, Market/Opportunity, Team
4. Video Demo (optional, max 2 min, recommended)
5. System Diagram & Flowchart (optional)
6. Hosting Link (optional, recommended)

### Judging Criteria
1. **Problem & Value** — Is the problem meaningful and clearly defined? Does the solution create clear value?
2. **Technical Execution** — Do core features work reliably? Is the build technically sound and thoughtfully engineered?
3. **AI Depth & Integration** — Is AI central and meaningfully integrated? Is it more than a basic API call? Does it enhance the solution?
4. **Entrepreneurial Strength** — Is the problem clearly defined & meaningful? Is the customer well identified? Does the solution show clear value and differentiation? Does the pitch deck communicate a compelling and credible venture concept?
5. **Presentation** — Was the demo clear, organized, and confident? Did the team explain their thinking effectively?
6. **UX/UI Design** — Intuitive UI, visual clarity, innovation, and measurable impact.

### Prize Tracks (target all applicable)
- AI Track (1st/2nd/3rd)
- AI-Driven Entrepreneurship Track (1st/2nd/3rd)
- Best UI/UX
- Best AI Depth & Integration
- **[Perplexity] Best project built with the Agent API** — Perplexity merch worth $400
- **[ElevenLabs] Best project built with ElevenLabs** — 6 months Scale Tier ($330 value) per team member

### Sponsors
Google, Amazon, IBM, CAHSI, Cursor, Perplexity, OMI, ElevenLabs, DoorDash, Warp, Red Bull, CSUEB College of Science & Engineering

### Judges (notable)
- Engineers/managers from Google, Amazon, IBM, Visa, PayPal, LinkedIn, Cisco, Meta, Navan, Crusoe
- Senior UX/Product Designer @ Google
- Senior AI Project Manager Lead @ IBM
- Business Intelligence Engineer III @ Amazon

---

## The Problem

- 300 million people worldwide live with a rare disease (defined as affecting <1 in 2,000 people)
- Average time to correct diagnosis: **5-7 years**, often involving 7-8 misdiagnoses
- ~72% of rare diseases are genetic — early detection changes outcomes dramatically
- 95% of rare diseases have no approved treatment — but diagnosis still matters for management, family planning, and clinical trial eligibility
- Rare diseases are collectively **not rare** — they affect more people than cancer

### Why Developing Countries Are Worse Off
- Most diagnostic tools are built for US/EU patients with genomic sequencing, specialist referrals, and comprehensive EHR systems
- In low/middle-income countries, a child with a rare metabolic disorder will almost certainly be misdiagnosed as malnourished or developmentally delayed — indefinitely
- Hospitals in these regions have tiny per-disease datasets — too small for any single hospital to train a useful model alone

### Local Relevance (for demo)
- Cal State East Bay serves a highly diverse student population; many from historically underrepresented backgrounds lacking access to specialist networks
- Frame the demo with a Bay Area scenario: "A family in Hayward brings their child to a community clinic. The pediatrician suspects something unusual but doesn't have access to a rare disease specialist at Stanford or UCSF. Our tool gives that community clinic Stanford-level diagnostic reasoning."

---

## Core Innovation: Federated Learning Across Sparse Data

Instead of centralizing patient data (impossible due to privacy laws and hospital distrust), the model trains locally at each hospital and only shares encrypted model weights.

```
Hospital A (50 patients)    Hospital B (30 patients)    Hospital C (80 patients)
      |                           |                           |
  Local Model                Local Model                Local Model
      |                           |                           |
      └───────────────────────────┴───────────────────────────┘
                                  |
                          Aggregated Global Model
                          (no raw patient data ever leaves)
                                  |
                     Push updated weights back to hospitals
```

Each hospital improves the global model without exposing patient records. A hospital with only 12 cases of a specific enzyme deficiency contributes meaningfully when pooled with 15 others globally.

---

## What the System Does

### Input (what a clinician enters)
- Patient symptoms (free text or structured checklist)
- Basic lab values (CBC, metabolic panel — available even in low-resource settings)
- Physical exam findings (dysmorphic features, organ size, neurological signs)
- Family history
- Optionally: photos (for dysmorphology recognition via Claude's vision capability)

### Processing Pipeline
1. **Symptom encoder** — maps clinical narrative to standardized HPO (Human Phenotype Ontology) terms using NLP (lightweight fuzzy matching layer against HPO term list)
2. **Claude API diagnostic reasoning** — Claude receives structured HPO codes + OMIM/Orphanet disease-symptom mappings as context, reasons through the differential, returns ranked candidates with plain-language explanations
3. **Confidence scoring** — flags when more data (specific labs, genetics) would significantly change the ranking. System explicitly surfaces uncertainty: "I need more information — here are the three tests that would most change my confidence, ranked by cost"
4. **Perplexity Agent API live research** — fetches real-time clinical trials, recent case reports, treatment guidelines, specialist directories for top candidates
5. **ElevenLabs voice synthesis** — generates multilingual spoken clinical summary

### Output
- Top 5-10 candidate diagnoses with probability scores
- Plain-language explanation of why each was flagged
- Suggested confirmatory tests, ordered by cost and local availability
- Live clinical trial matches and recent literature (via Perplexity)
- Multilingual audio briefing (via ElevenLabs)
- Links to clinical management guidelines
- Option to connect to specialist network for teleconsultation

---

## Tech Stack

### Frontend: React
Three distinct views for three demo moments:
1. **Clinician View** — symptom input form, differential diagnosis results, next-step recommendations, voice briefing player
2. **Federation Dashboard** — real-time visualization of distributed learning network: active nodes, weight exchanges, model convergence metrics, per-node contribution scores, global accuracy over training rounds
3. **Research Console** — Perplexity-powered clinical trials, recent literature, specialist networks for diagnosed condition

### Backend: Python + FastAPI
- API routes: receive clinician input, call Claude, call Perplexity, call ElevenLabs, coordinate federation dashboard data
- Async by default, auto-generates API docs
- Quick to build for hackathon timeline

### AI Reasoning Engine: Claude API
- Structured prompting with HPO/OMIM/Orphanet knowledge base as context
- Much stronger reasoning and explainability than fine-tuned BioBERT in hackathon timeline
- Richer plain-language explanations for each candidate diagnosis
- Vision capability for clinical photo analysis (dysmorphic features)

### Live Research: Perplexity Agent API
- Real-time clinical trial search for top candidate diagnoses
- Recent case reports and literature
- Treatment guideline updates
- Specialist directories near patient location
- **Qualifies for Perplexity sponsor prize**

### Voice Output: ElevenLabs API
- Multilingual clinical summary narration
- Demo in English → Spanish → Hindi for maximum impact
- Accessibility play: doctors in busy clinics listen rather than read
- **Qualifies for ElevenLabs sponsor prize**

### Federated Learning: Flower (flwr)
- Python federated learning framework
- 3-4 virtual hospital nodes, each with subset of public rare disease data
- Local training → encrypted weight sharing → global model aggregation
- Live dashboard showing convergence in real time
- Simulated on one machine with separate processes; architecture identical to production deployment

### Knowledge Base (pre-processed JSON, all publicly accessible)
| Source | What it provides |
|--------|-----------------|
| OMIM | 7,000+ rare diseases with genetic and clinical descriptions |
| Orphanet | European rare disease database, symptom-to-disease mappings |
| HPO (Human Phenotype Ontology) | Standardized symptom vocabulary |
| ClinVar | Genetic variant-to-disease associations |
| NORD | Patient registry data (some public) |
| PhenomeCentral | De-identified patient phenotype matching dataset |

### Database
- SQLite for hackathon (or just JSON files for demo)
- PostgreSQL for production path

### IDE
- Claude Code with gstack for structured development workflow
- Cursor for rapid iteration

---

## Demo Flow (3 minutes)

1. **Open on the problem** (30 sec): "300 million people. 7-year average to diagnosis. We're fixing this."
2. **Live input** (30 sec): Type in a real symptom profile — "6-year-old, progressive muscle weakness, difficulty climbing stairs, elevated CK, calf pseudohypertrophy"
3. **Watch the system work** (45 sec): Show symptom-to-HPO mapping in real time, candidate diagnoses populating with probability scores, Perplexity pulling latest DMD clinical trials
4. **Audio briefing** (30 sec): ElevenLabs reads clinical summary aloud, then switch to Spanish — the room will react
5. **Show the federation** (15 sec): Quick flash of federated learning dashboard — "In production, this model improves across every hospital that uses it without sharing a single patient record"
6. **The business** (30 sec): Three-phase model, pharma pipeline revenue, TAM

### Killer Demo Case
- Clinician types: "4-year-old, progressive muscle weakness, difficulty climbing stairs, elevated CK levels, no family history"
- System maps to HPO terms: HP:0003560 (muscular dystrophy), HP:0003236 (elevated CK), etc.
- Returns: Duchenne Muscular Dystrophy (68%), Becker MD (14%), Pompe Disease (9%)...
- Says: "Confirmatory test: dystrophin gene panel ($40-80). If unavailable, muscle biopsy."
- Show federated dashboard: 3 simulated hospital nodes, each with partial data, converging on a better model than any single node alone

---

## Business Model (Three-Phase Venture Pitch)

### Phase 1: Wedge Market
- Free/low-cost diagnostic tool for community health networks
- 1,400+ Federally Qualified Health Centers in the US serve 30M patients lacking specialist access
- International: WHO/government partnerships in India, Brazil, Nigeria
- Funding: Grants from WHO, Gates Foundation, Wellcome Trust

### Phase 2: Pharma Intelligence Platform
- Anonymized diagnostic pattern data → pharma companies need to find rare disease patients for clinical trials
- A single rare disease drug generates $500M+ annually
- Drug companies desperately need patient identification pipelines (rare disease trials struggle to recruit)
- Revenue: Six-figure contracts per pharma company

### Phase 3: Clinical Trial Matching Engine
- Tool doesn't just diagnose — connects patients to active trials
- CROs (contract research organizations) pay per qualified referral
- Network effect: every hospital that joins makes the model better → attracts more hospitals → more data → better model

### Defensibility
- Network effect from federated learning — competitors can't replicate without the same hospital network
- Data flywheel: more hospitals → better model → more hospitals
- First-mover in federated rare disease diagnostics

### Competitive Landscape
| Existing Tool | What it does | What it misses |
|--------------|-------------|----------------|
| Isabel DDx | Symptom-to-diagnosis for generalists | Not rare-disease specialized, no federated learning |
| FDNA (Face2Gene) | Facial dysmorphology recognition | Only photos, no clinical data integration |
| Phenomizer | HPO-based rare disease matching | Research tool, not clinical workflow, no federated approach |
| Mendelian.co | UK-based rare disease AI | Requires full EHR integration, not low-resource compatible |

**Our niche**: Low-resource settings + federated privacy + multi-modal input (symptoms + labs + photos) + actionable next steps + live research

---

## 48-Hour Build Plan

### Hours 0-6: Data Pipeline & Core Engine
- Download and preprocess HPO, OMIM, Orphanet mappings into structured JSON
- Build symptom-to-HPO mapping layer (fuzzy matching)
- Get Claude API diagnostic prompt working with test cases
- Validate with the Duchenne demo case

### Hours 6-14: Frontend & Voice
- Build React frontend: clinician input form, results display, federation dashboard skeleton
- Get ElevenLabs voice output working end-to-end for English
- Basic styling and clinical UI patterns

### Hours 14-22: Federation & Research
- Implement Flower federated learning simulation with 3-4 virtual hospital nodes
- Build live training visualization for the dashboard
- Integrate Perplexity Agent API for research console
- Connect all data flows

### Hours 22-30: Multi-Modal & Polish
- Add vision pipeline for clinical photos (Claude vision API)
- Add multilingual voice output (Spanish, Hindi)
- Connect all three frontend views
- Integration testing across full pipeline

### Hours 30-38: Testing & Pitch
- End-to-end testing with diverse symptom profiles
- Edge case handling and confidence scoring
- UI polish and responsive design
- Build pitch deck (PDF)

### Hours 38-48: Demo Prep
- Rehearse demo relentlessly
- Record optional 2-min video
- Write README with setup instructions
- System diagram and flowchart
- Final bug fixes
- Screenshots for submission

---

## Pitch Narrative (30-second version)

> "A child in rural Nigeria shows signs of a metabolic disorder. The local doctor has seen one case like this in their career. Without help, this child gets diagnosed as 'failure to thrive' and sent home. Our system pools knowledge from 200 hospitals across 40 countries — without any hospital sharing a single patient record — so that doctor gets a ranked differential diagnosis, a $30 confirmatory test recommendation, and a telemedicine link to a specialist. We turn a 7-year diagnostic odyssey into a 7-day one."

---

## Key Strategic Notes

### For Maximum Sponsor Prize Eligibility
- Use Perplexity Agent API meaningfully (live research, not bolted on) → eligible for Perplexity prize
- Use ElevenLabs meaningfully (multilingual clinical voice, not a gimmick) → eligible for ElevenLabs prize
- Build with Cursor as IDE → show sponsor love

### For the Judges in the Room
- Judges from Google, Amazon, IBM, Visa, PayPal think in platforms — show the three-phase model
- The Google UX designer judge will scrutinize the clinical interface — make it clean, high-trust, information-dense
- The IBM AI Project Manager judge will evaluate AI depth — show multi-model orchestration, not a single API call
- The Amazon BI engineer judge will care about the data flywheel narrative

### For AI Depth Scoring
- Multi-model orchestration: Claude reasoning + Perplexity live data + ElevenLabs voice
- Multi-modal input: text symptoms + structured labs + clinical photos (vision)
- Federated learning architecture (even simulated, this is impressive and real)
- Confidence-aware system that explicitly surfaces uncertainty
- Not a wrapper around one API — it's an AI system

### For Entrepreneurial Scoring
- Three-phase revenue model with clear progression
- Identified customer segments: community clinics → pharma companies → CROs
- TAM is massive: 300M patients, $130B+ rare disease drug market
- Network effect creates defensibility
- The pharma angle is the strongest: a rare disease drug costs $100k+/year, so companies desperately need to find the 1-in-50,000 patients who qualify. Your system is their patient funnel.

---

## gstack Workflow

After installing gstack, use this sprint order:
1. `/office-hours` — paste this brief, refine the product vision
2. `/plan-ceo-review` — stress-test the entrepreneurial angle
3. `/plan-eng-review` — lock architecture, data flow diagrams, API contracts, test matrix
4. `/design-consultation` — clinical UI design system
5. Build in parallel sprints on separate branches:
   - Sprint 1: Symptom-to-HPO mapping + Claude API diagnostic engine
   - Sprint 2: Flower federated learning simulation + dashboard
   - Sprint 3: Perplexity Agent API integration
   - Sprint 4: ElevenLabs multilingual voice output
   - Sprint 5: React frontend three-view layout
6. `/review` → `/qa` → `/ship` cycle for each feature
7. `/document-release` before final submission

---

## Production Roadmap (for pitch deck "future" slide)
- FHIR integration (healthcare data standard) for hospital system plug-in
- Replace simulated federation with PySyft or TensorFlow Federated
- Genomic input when sequencing available (VCF file parsing)
- Mobile-first design for tablet use in clinics without desktops
- Offline mode with cached guidelines for low-connectivity settings
