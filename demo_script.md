# RarePath Demo Script (~90 seconds)

---

**[Open the app — Clinician tab is showing]**

"This is RarePath — an AI-powered rare disease diagnostic assistant. 300 million people worldwide have a rare disease, and the average patient waits 5 to 7 years to get diagnosed. RarePath brings that down to seconds."

---

**[Click the "Duchenne Muscular Dystrophy" demo case button]**

"Let's walk through a case. A 4-year-old boy comes in with progressive muscle weakness, difficulty climbing stairs, and elevated creatine kinase. I'll load this demo case — you can see the symptoms, exam findings, and family history auto-populate."

---

**[Click "Analyze Symptoms"]**

"When I hit analyze, a few things happen in sequence. First, the symptoms get mapped to standardized HPO codes — that's the Human Phenotype Ontology, a database of nearly 20,000 medical terms. Then those codes are cross-referenced against 4,335 rare diseases from Orphanet. Finally, an LLM generates a ranked differential diagnosis. The whole pipeline takes under 15 seconds."

---

**[Results appear — scroll through them]**

"Here are the results. The top candidate is Duchenne Muscular Dystrophy at 42% probability, with a full explanation of why it matches. Each candidate comes with a recommended confirmatory test and a cost estimate — we prioritize low-cost tests for resource-limited settings. You'll also see red flags and an uncertainty note suggesting what additional information would increase confidence."

---

**[Scroll down to Live Research section]**

"Below the diagnosis, we have live research pulled in real time from Perplexity Sonar — active clinical trials, recent publications, treatment advances, and specialist centers, all with cited sources. This isn't a static database — it's pulling the latest literature right now."

---

**[Scroll to voice section, click the Spanish flag button]**

"For multilingual accessibility, we can generate an audio briefing on demand in 10 languages. If I click Spanish, it translates the clinical summary and synthesizes it through ElevenLabs. This is useful for explaining a diagnosis to a patient's family in their native language."

---

**[Click "Export PDF" button]**

"We can also export a full clinical report as a PDF — professional layout with the HPO mapping table, probability bars, confirmatory tests, research citations, and a clinical disclaimer."

---

**[Click the "Federation" tab]**

"Now the Federation tab. This demonstrates how hospitals could collaborate on rare disease diagnosis without sharing any patient data. We implemented real Federated Averaging — FedAvg — across 7 simulated hospital nodes around the world."

---

**[Click "Start" to play the animation]**

"Each round has three phases. First, the global model weights are distributed to all hospitals. Then each hospital trains locally on its own private patient data. Finally, the updated weights are sent back and averaged. No patient records ever leave the hospital — only model gradients traverse the network."

**[Point to the convergence chart as it draws]**

"You can watch the model converge in real time — accuracy climbs from around 50% to nearly 79% over 20 rounds across 200 rare disease classes. The 'Data Shared' counter stays at zero the entire time."

---

**[Wrap up]**

"RarePath — from symptoms to diagnosis in under 15 seconds. Because no one should wait 7 years for a diagnosis."
