import { useState, useRef, useEffect, useCallback } from 'react'
import { diagnose, searchHPO } from './api'
import FederationDashboard from './FederationDashboard'
import './App.css'

const DEMO_CASES = [
  {
    name: 'Duchenne Muscular Dystrophy',
    symptoms: 'progressive muscle weakness, difficulty climbing stairs, elevated creatine kinase',
    examFindings: '4-year-old male, calf pseudohypertrophy, Gowers sign positive',
    familyHistory: 'none',
  },
  {
    name: 'Gaucher Disease',
    symptoms: 'hepatosplenomegaly, bone pain, easy bruising, fatigue, anemia',
    examFindings: 'enlarged spleen on palpation, pallor, petechiae on lower extremities',
    familyHistory: 'Ashkenazi Jewish descent, cousin with similar symptoms',
  },
  {
    name: 'Marfan Syndrome',
    symptoms: 'tall stature, joint hypermobility, lens subluxation, chest pain',
    examFindings: 'arachnodactyly, pectus excavatum, arm span exceeds height, positive wrist and thumb signs',
    familyHistory: 'father had aortic dissection at age 42',
  },
  {
    name: 'Ehlers-Danlos Syndrome',
    symptoms: 'skin hyperelasticity, frequent joint dislocations, easy bruising, chronic pain',
    examFindings: 'velvety skin, Beighton score 7/9, atrophic scarring, joint hypermobility',
    familyHistory: 'mother has joint hypermobility and chronic pain',
  },
  {
    name: 'Pompe Disease',
    symptoms: 'progressive proximal muscle weakness, respiratory difficulty, exercise intolerance',
    examFindings: 'reduced respiratory capacity, elevated CK, tongue enlargement, difficulty rising from chair',
    familyHistory: 'no known family history, consanguineous parents',
  },
]

const LOADING_STAGES = [
  'Mapping symptoms to HPO ontology',
  'Cross-referencing 4,335 rare diseases',
  'Generating differential diagnosis via LLM',
  'Fetching live research & citations',
  'Synthesizing voice briefings',
]

export default function App() {
  const [tab, setTab] = useState('clinician')
  const [form, setForm] = useState({ symptoms: '', examFindings: '', familyHistory: '' })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(0)
  const [error, setError] = useState(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareSelection, setCompareSelection] = useState([])

  // HPO autocomplete state
  const [hpoQuery, setHpoQuery] = useState('')
  const [hpoResults, setHpoResults] = useState([])
  const [hpoOpen, setHpoOpen] = useState(false)
  const [selectedHPO, setSelectedHPO] = useState([])
  const hpoRef = useRef(null)
  const hpoTimerRef = useRef(null)

  // Debounced HPO search
  const searchHPODebounced = useCallback((query) => {
    if (hpoTimerRef.current) clearTimeout(hpoTimerRef.current)
    if (query.length < 2) {
      setHpoResults([])
      setHpoOpen(false)
      return
    }
    hpoTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchHPO(query)
        setHpoResults(results.slice(0, 8))
        setHpoOpen(results.length > 0)
      } catch {
        setHpoResults([])
      }
    }, 250)
  }, [])

  // Close HPO dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (hpoRef.current && !hpoRef.current.contains(e.target)) setHpoOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addHPOTerm = (term) => {
    if (!selectedHPO.find((t) => t.code === term.code)) {
      setSelectedHPO((prev) => [...prev, term])
      // Append to symptoms
      setForm((f) => ({
        ...f,
        symptoms: f.symptoms ? `${f.symptoms}, ${term.label}` : term.label,
      }))
    }
    setHpoQuery('')
    setHpoOpen(false)
  }

  const removeHPOTerm = (code) => {
    const term = selectedHPO.find((t) => t.code === code)
    setSelectedHPO((prev) => prev.filter((t) => t.code !== code))
    if (term) {
      setForm((f) => ({
        ...f,
        symptoms: f.symptoms
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.toLowerCase() !== term.label.toLowerCase())
          .join(', '),
      }))
    }
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setLoadingStage(0)
    setError(null)
    setResult(null)
    setCompareMode(false)
    setCompareSelection([])

    // Stage 0 (HPO mapping) completes quickly — advance after 400ms
    // Stage 1 (cross-referencing) advances after another 600ms
    // Stage 2 (LLM) stays active until the API responds
    // Stages 3-4 flash through on completion (voice/research are parallel on backend)
    const t1 = setTimeout(() => setLoadingStage(1), 400)
    const t2 = setTimeout(() => setLoadingStage(2), 1000)

    try {
      const data = await diagnose(form)
      // API returned — flash through remaining stages for visual closure
      setLoadingStage(3)
      await new Promise((r) => setTimeout(r, 300))
      setLoadingStage(4)
      await new Promise((r) => setTimeout(r, 200))
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      clearTimeout(t1)
      clearTimeout(t2)
      setLoading(false)
    }
  }

  const loadDemo = (caseData) => {
    setForm({
      symptoms: caseData.symptoms,
      examFindings: caseData.examFindings,
      familyHistory: caseData.familyHistory,
    })
    setSelectedHPO([])
  }

  const resetForm = () => {
    setForm({ symptoms: '', examFindings: '', familyHistory: '' })
    setResult(null)
    setError(null)
    setSelectedHPO([])
    setCompareMode(false)
    setCompareSelection([])
  }

  const toggleCompare = (idx) => {
    setCompareSelection((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : prev.length < 3 ? [...prev, idx] : prev
    )
  }

  const generatePDF = () => {
    if (!result) return
    const w = window.open('', '_blank')
    const candidates = result.candidates || []
    const hpo = result.hpo_terms || []
    const now = new Date()
    const reportId = `RP-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`
    const topCandidate = candidates[0]

    w.document.write(`<!DOCTYPE html><html><head><title>RarePath Diagnostic Report — ${reportId}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:A4;margin:18mm 16mm}
  body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#1e293b;line-height:1.55;font-size:13px;background:#fff}
  .page{max-width:780px;margin:0 auto;padding:32px 40px}

  /* Header */
  .report-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:2.5px solid #0d9488;margin-bottom:20px}
  .report-brand{display:flex;align-items:center;gap:10px}
  .report-logo{width:36px;height:36px;background:linear-gradient(135deg,#0d9488,#14b8a6);border-radius:8px;display:flex;align-items:center;justify-content:center}
  .report-logo svg{width:20px;height:20px}
  .report-brand h1{font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.5px}
  .report-brand .tagline{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600}
  .report-meta{text-align:right;font-size:11px;color:#64748b;line-height:1.6}
  .report-meta strong{color:#334155;font-weight:700}

  /* Section */
  .section{margin-bottom:20px}
  .section-title{font-size:12px;font-weight:800;color:#0d9488;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:6px;border-bottom:1px solid #e2e8f0;margin-bottom:10px;display:flex;align-items:center;gap:6px}
  .section-title::before{content:'';display:inline-block;width:3px;height:14px;background:#0d9488;border-radius:2px}

  /* Clinical input */
  .input-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .input-field label{display:block;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px}
  .input-field .value{font-size:12px;color:#1e293b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:6px 10px;min-height:24px}
  .input-field.full{grid-column:1/-1}

  /* HPO table */
  .hpo-table{width:100%;border-collapse:collapse;font-size:12px}
  .hpo-table th{text-align:left;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;padding:5px 8px;border-bottom:2px solid #e2e8f0;background:#f8fafc}
  .hpo-table td{padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  .hpo-table tr:last-child td{border-bottom:none}
  .hpo-code{font-family:'SF Mono','Fira Code',monospace;font-size:11px;color:#0d9488;font-weight:600}
  .hpo-conf{font-weight:700;font-family:'SF Mono',monospace;font-size:11px}

  /* Diagnosis cards */
  .dx-card{border:1px solid #e2e8f0;border-radius:6px;padding:14px 16px;margin-bottom:8px;page-break-inside:avoid}
  .dx-card.primary{border-color:#0d9488;border-width:2px;background:#f0fdfa}
  .dx-rank{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-size:11px;font-weight:800;margin-right:8px;flex-shrink:0}
  .dx-rank.r1{background:#0d9488;color:#fff}
  .dx-rank.rn{background:#e2e8f0;color:#475569}
  .dx-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
  .dx-name{font-size:14px;font-weight:700;color:#0f172a;display:flex;align-items:center}
  .dx-prob-wrap{text-align:right}
  .dx-prob{font-size:20px;font-weight:800;color:#0d9488;font-family:'SF Mono',monospace;line-height:1}
  .dx-prob-label{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em}
  .dx-bar{height:4px;background:#e2e8f0;border-radius:2px;margin:6px 0 8px;overflow:hidden}
  .dx-bar-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,#0d9488,#14b8a6)}
  .dx-explanation{font-size:12px;color:#475569;line-height:1.5}
  .dx-test{display:flex;align-items:flex-start;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:8px 12px;margin-top:8px;font-size:12px}
  .dx-test-icon{flex-shrink:0;width:18px;height:18px;background:#ecfdf5;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;margin-top:1px}
  .dx-test-name{font-weight:600;color:#1e293b}
  .dx-test-cost{color:#64748b;font-size:11px}

  /* Alerts */
  .alert-box{border-radius:6px;padding:10px 14px;margin-bottom:10px;font-size:12px;display:flex;gap:8px;align-items:flex-start;page-break-inside:avoid}
  .alert-box.amber{background:#fffbeb;border:1px solid #fbbf24;color:#92400e}
  .alert-box.red{background:#fef2f2;border:1px solid #fca5a5;color:#991b1b}
  .alert-icon{flex-shrink:0;font-size:14px;margin-top:1px}
  .alert-label{font-weight:700;display:block;margin-bottom:2px}

  /* Research */
  .research-content{font-size:12px;color:#475569;line-height:1.6;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px 16px}
  .citations{margin-top:10px;display:flex;flex-wrap:wrap;gap:4px}
  .cite{display:inline-flex;align-items:center;gap:3px;font-size:11px;color:#0d9488;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:3px;padding:2px 8px;text-decoration:none;font-weight:600}
  .cite:hover{background:#ccfbf1}

  /* Summary box */
  .summary-box{background:linear-gradient(135deg,#f0fdfa,#ecfdf5);border:2px solid #99f6e4;border-radius:8px;padding:16px 20px;margin-bottom:20px;page-break-inside:avoid}
  .summary-title{font-size:11px;font-weight:800;color:#0d9488;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px}
  .summary-disease{font-size:18px;font-weight:800;color:#0f172a;margin-bottom:2px}
  .summary-detail{font-size:12px;color:#475569}
  .summary-stats{display:flex;gap:20px;margin-top:10px}
  .summary-stat{text-align:center}
  .summary-stat-val{font-size:22px;font-weight:800;color:#0d9488;font-family:'SF Mono',monospace;line-height:1}
  .summary-stat-lbl{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600}

  /* Footer */
  .report-footer{margin-top:24px;padding-top:14px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
  .disclaimer{flex:1;font-size:10px;color:#94a3b8;line-height:1.5}
  .disclaimer strong{color:#64748b}
  .footer-brand{font-size:10px;color:#94a3b8;text-align:right;white-space:nowrap}
  .footer-brand strong{color:#0d9488}

  @media print{
    .page{padding:0}
    .dx-card{break-inside:avoid}
    .alert-box{break-inside:avoid}
    .summary-box{break-inside:avoid}
  }
</style></head><body>
<div class="page">

<!-- Header -->
<div class="report-header">
  <div class="report-brand">
    <div class="report-logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
        <path d="M2 15c6.667-6 13.333 0 20-6"/>
        <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/>
        <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/>
      </svg>
    </div>
    <div>
      <h1>RarePath</h1>
      <div class="tagline">AI-Assisted Rare Disease Diagnostic Report</div>
    </div>
  </div>
  <div class="report-meta">
    <strong>Report ID:</strong> ${reportId}<br>
    <strong>Generated:</strong> ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}<br>
    <strong>Analysis Engine:</strong> ${result.provider === 'groq' ? 'Llama 3.3 70B' : result.provider === 'claude' ? 'Claude Opus' : result.provider} (${result.latency_ms}ms)
  </div>
</div>

<!-- Summary -->
${topCandidate ? `<div class="summary-box">
  <div class="summary-title">Primary Assessment</div>
  <div class="summary-disease">${topCandidate.disease}</div>
  <div class="summary-detail">${topCandidate.explanation}</div>
  <div class="summary-stats">
    <div class="summary-stat">
      <div class="summary-stat-val">${topCandidate.probability}%</div>
      <div class="summary-stat-lbl">Probability</div>
    </div>
    <div class="summary-stat">
      <div class="summary-stat-val">${candidates.length}</div>
      <div class="summary-stat-lbl">Differentials</div>
    </div>
    <div class="summary-stat">
      <div class="summary-stat-val">${hpo.length}</div>
      <div class="summary-stat-lbl">HPO Terms</div>
    </div>
    ${topCandidate.confirmatory_test ? `<div class="summary-stat">
      <div class="summary-stat-val" style="font-size:13px">${topCandidate.confirmatory_test.cost_range}</div>
      <div class="summary-stat-lbl">Test Cost</div>
    </div>` : ''}
  </div>
</div>` : ''}

<!-- Clinical Input -->
<div class="section">
  <div class="section-title">Clinical Presentation</div>
  <div class="input-grid">
    <div class="input-field full">
      <label>Presenting Symptoms</label>
      <div class="value">${form.symptoms || '—'}</div>
    </div>
    ${form.examFindings ? `<div class="input-field">
      <label>Examination Findings</label>
      <div class="value">${form.examFindings}</div>
    </div>` : ''}
    ${form.familyHistory ? `<div class="input-field">
      <label>Family History</label>
      <div class="value">${form.familyHistory}</div>
    </div>` : ''}
  </div>
</div>

<!-- HPO Mapping -->
<div class="section">
  <div class="section-title">Phenotype Ontology Mapping</div>
  <table class="hpo-table">
    <thead><tr><th>HPO Term</th><th>Code</th><th style="text-align:right">Match Confidence</th></tr></thead>
    <tbody>
    ${hpo.map(t => `<tr>
      <td>${t.label}</td>
      <td><span class="hpo-code">${t.code}</span></td>
      <td style="text-align:right"><span class="hpo-conf">${Math.round(t.confidence * 100)}%</span></td>
    </tr>`).join('')}
    </tbody>
  </table>
</div>

<!-- Alerts -->
${result.red_flags ? `<div class="alert-box red">
  <span class="alert-icon">&#9888;</span>
  <div><span class="alert-label">Clinical Red Flags</span>${result.red_flags}</div>
</div>` : ''}
${result.uncertainty_note ? `<div class="alert-box amber">
  <span class="alert-icon">&#9432;</span>
  <div><span class="alert-label">Recommendation to Increase Diagnostic Confidence</span>${result.uncertainty_note}</div>
</div>` : ''}

<!-- Differential Diagnosis -->
<div class="section">
  <div class="section-title">Differential Diagnosis</div>
  ${candidates.map((c, i) => `<div class="dx-card ${i === 0 ? 'primary' : ''}">
    <div class="dx-header">
      <div class="dx-name"><span class="dx-rank ${i === 0 ? 'r1' : 'rn'}">${i + 1}</span>${c.disease}</div>
      <div class="dx-prob-wrap">
        <div class="dx-prob">${c.probability}%</div>
        <div class="dx-prob-label">probability</div>
      </div>
    </div>
    <div class="dx-bar"><div class="dx-bar-fill" style="width:${c.probability}%"></div></div>
    <div class="dx-explanation">${c.explanation}</div>
    ${c.confirmatory_test ? `<div class="dx-test">
      <div class="dx-test-icon">&#128300;</div>
      <div>
        <div class="dx-test-name">${c.confirmatory_test.name}</div>
        <div class="dx-test-cost">Estimated cost: ${c.confirmatory_test.cost_range}</div>
      </div>
    </div>` : ''}
  </div>`).join('')}
</div>

<!-- Research -->
${result.research?.summary ? `<div class="section">
  <div class="section-title">Literature Review — ${result.research.disease}</div>
  <div class="research-content">
    ${result.research.summary.replace(/\n/g, '<br>')}
    ${result.research.citations?.length ? `<div class="citations">
      ${result.research.citations.map((u, i) => `<a class="cite" href="${u}" target="_blank">[${i + 1}] ${(() => { try { return new URL(u).hostname.replace('www.','') } catch { return 'source' } })()}</a>`).join('')}
    </div>` : ''}
  </div>
</div>` : ''}

<!-- Footer -->
<div class="report-footer">
  <div class="disclaimer">
    <strong>Clinical Disclaimer:</strong> This report is generated by an AI diagnostic assistant using computational phenotype analysis and large language models.
    It is intended to support — not replace — clinical decision-making. All findings should be validated by a qualified healthcare professional
    before initiating any diagnostic workup or treatment plan. This report does not establish a physician-patient relationship.
  </div>
  <div class="footer-brand">
    <strong>RarePath</strong><br>
    Rare Disease Diagnostic Assistant<br>
    HackHayward 2026
  </div>
</div>

</div>
</body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="header-inner">
            <div className="logo">
              <div className="logo-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 15c6.667-6 13.333 0 20-6" />
                  <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
                  <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
                  <path d="M17 6l-2.5 2.5" /><path d="M14 8l-1 1" />
                  <path d="M7 18l2.5-2.5" /><path d="M3.5 14.5l.5-.5" />
                  <path d="M20 9l.5-.5" />
                  <path d="M2 9c6.667 6 13.333 0 20 6" />
                </svg>
              </div>
              <div className="logo-text">Rare<span>Path</span></div>
            </div>
            <div className="tagline">Rare Disease Diagnostic Assistant</div>
          </div>
          <nav className="nav">
            <button
              className={`nav-tab ${tab === 'clinician' ? 'nav-tab-active' : ''}`}
              onClick={() => setTab('clinician')}
            >
              <svg className="nav-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              Clinician
            </button>
            <button
              className={`nav-tab ${tab === 'federation' ? 'nav-tab-active' : ''}`}
              onClick={() => setTab('federation')}
            >
              <svg className="nav-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="2" /><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" />
                <line x1="8" y1="8" x2="10" y2="10" /><line x1="14" y1="10" x2="16" y2="8" /><line x1="8" y1="16" x2="10" y2="14" /><line x1="14" y1="14" x2="16" y2="16" />
              </svg>
              Federation
            </button>
          </nav>
        </div>
        <div className="header-right">
          <div className="header-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 7h-4V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v4H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h4v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6h4a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z" />
            </svg>
            HPO + Orphanet
          </div>
          <div className="header-status">
            <div className="status-dot" />
            Online
          </div>
        </div>
      </header>

      <main className="main">
        {tab === 'federation' && <FederationDashboard />}

        <div className="layout" style={{ display: tab === 'clinician' ? 'grid' : 'none' }}>

          {/* Input Panel */}
          <section className="panel input-panel">
            <div className="panel-header">
              <h2>Patient Presentation</h2>
              <div className="case-library">
                <select
                  className="case-select"
                  value=""
                  onChange={(e) => {
                    const idx = parseInt(e.target.value, 10)
                    if (!isNaN(idx)) loadDemo(DEMO_CASES[idx])
                  }}
                >
                  <option value="" disabled>Load Case…</option>
                  {DEMO_CASES.map((c, i) => (
                    <option key={i} value={i}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="panel-body">
              <form onSubmit={submit}>
                <div className="field symptom-field" ref={hpoRef}>
                  <label>Symptoms <span className="required">*</span></label>
                  <div className="hpo-autocomplete">
                    <div className="hpo-search-input">
                      <svg className="hpo-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search HPO ontology to add standardized terms…"
                        value={hpoQuery}
                        onChange={(e) => {
                          setHpoQuery(e.target.value)
                          searchHPODebounced(e.target.value)
                        }}
                        onFocus={() => hpoResults.length > 0 && setHpoOpen(true)}
                        className="hpo-input"
                      />
                    </div>
                    {hpoOpen && (
                      <div className="hpo-dropdown">
                        {hpoResults.map((r) => (
                          <button
                            key={r.code}
                            type="button"
                            className={`hpo-option ${selectedHPO.find(t => t.code === r.code) ? 'hpo-option-selected' : ''}`}
                            onClick={() => addHPOTerm(r)}
                          >
                            <span className="hpo-option-label">{r.label}</span>
                            <span className="hpo-option-code">{r.code}</span>
                            <span className="hpo-option-conf">{Math.round(r.confidence * 100)}%</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedHPO.length > 0 && (
                    <div className="hpo-selected-tags">
                      {selectedHPO.map((t) => (
                        <span key={t.code} className="hpo-selected-tag">
                          <span className="hpo-dot" />
                          {t.label}
                          <button type="button" className="hpo-remove" onClick={() => removeHPOTerm(t.code)}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <textarea
                    rows={3}
                    placeholder="Or type symptoms in plain text (e.g. progressive muscle weakness, difficulty climbing stairs)"
                    value={form.symptoms}
                    onChange={set('symptoms')}
                    required
                    className="symptoms-textarea"
                  />
                </div>

                <div className="field">
                  <label>Physical Exam Findings</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. calf pseudohypertrophy, Gowers sign positive"
                    value={form.examFindings}
                    onChange={set('examFindings')}
                  />
                </div>

                <div className="field">
                  <label>Family History</label>
                  <input
                    type="text"
                    placeholder="e.g. maternal uncle with similar symptoms"
                    value={form.familyHistory}
                    onChange={set('familyHistory')}
                  />
                </div>

                <div className="btn-row">
                  <button className="btn-submit" type="submit" disabled={loading || !form.symptoms.trim()}>
                    {loading ? (
                      <>
                        <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                        Analyzing…
                      </>
                    ) : (
                      'Generate Differential'
                    )}
                  </button>
                  {(result || form.symptoms) && !loading && (
                    <button className="btn-reset" type="button" onClick={resetForm}>
                      New Patient
                    </button>
                  )}
                </div>
              </form>

              {error && <div className="error-box">{error}</div>}
            </div>
          </section>

          {/* Results Panel */}
          <section className="panel results-panel">
            <div className="panel-header">
              <h2>Differential Diagnosis</h2>
              <div className="panel-header-actions">
                {result && (
                  <>
                    <button className="btn-pdf" onClick={generatePDF} type="button" title="Download clinical report as PDF">
                      📄 Export Report
                    </button>
                    <button
                      className={`btn-compare ${compareMode ? 'btn-compare-active' : ''}`}
                      onClick={() => { setCompareMode(!compareMode); setCompareSelection([]) }}
                      type="button"
                    >
                      ⚖️ Compare
                    </button>
                    <span className="latency">{result.latency_ms}ms · {result.provider}</span>
                  </>
                )}
              </div>
            </div>

            {!result && !loading && (
              <div className="empty-state">
                <div className="empty-icon">🔬</div>
                <p>Enter patient symptoms and click Generate Differential to begin analysis</p>
              </div>
            )}

            {loading && (
              <div className="loading-state">
                <div className="spinner" />
                <div className="loading-label">Analyzing</div>
                <div className="loading-stages">
                  {LOADING_STAGES.map((label, i) => (
                    <div key={i} className={`loading-stage ${i < loadingStage ? 'stage-done' : i === loadingStage ? 'stage-active' : 'stage-pending'}`}>
                      <div className="stage-indicator">
                        {i < loadingStage ? '✓' : i === loadingStage ? <div className="stage-spinner" /> : <div className="stage-dot" />}
                      </div>
                      <span className="stage-label">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result && (
              <div className="results-body">
                {/* HPO Terms */}
                <div className="hpo-section">
                  <div className="section-label">Mapped HPO Terms</div>
                  <div className="hpo-tags">
                    {result.hpo_terms.map((t) => (
                      <span key={t.code} className="hpo-tag" title={t.code}>
                        <span className="hpo-dot" />
                        {t.label}
                        <span className="hpo-conf">{Math.round(t.confidence * 100)}%</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="results-divider" />

                {/* Comparison Mode */}
                {compareMode && compareSelection.length >= 2 && (
                  <div className="compare-panel">
                    <div className="section-label">Side-by-Side Comparison</div>
                    <div className="compare-grid" style={{ gridTemplateColumns: `repeat(${compareSelection.length}, 1fr)` }}>
                      {compareSelection.map((idx) => {
                        const c = result.candidates[idx]
                        return (
                          <div key={idx} className="compare-card">
                            <div className="compare-card-header">
                              <span className="compare-rank">#{idx + 1}</span>
                              <span className="compare-prob">{c.probability}%</span>
                            </div>
                            <div className="compare-disease">{c.disease}</div>
                            <p className="compare-explanation">{c.explanation}</p>
                            {c.confirmatory_test && (
                              <div className="compare-test">
                                <div className="compare-test-label">Confirmatory Test</div>
                                <div className="compare-test-name">{c.confirmatory_test.name}</div>
                                <div className="compare-test-cost">{c.confirmatory_test.cost_range}</div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="results-divider" />
                  </div>
                )}
                {compareMode && compareSelection.length < 2 && (
                  <div className="compare-hint">
                    Select {2 - compareSelection.length} more candidate{compareSelection.length === 0 ? 's' : ''} to compare
                  </div>
                )}

                {/* Candidates */}
                <div className="candidates-header">
                  <div className="section-label" style={{ margin: 0 }}>Differential Candidates</div>
                  <span className="candidates-count">{result.candidates.length} conditions ranked</span>
                </div>

                <div className="candidates">
                  {result.candidates.map((c, i) => (
                    <div
                      key={i}
                      className={`candidate ${i === 0 ? 'candidate-top' : ''} ${compareMode ? 'candidate-selectable' : ''} ${compareSelection.includes(i) ? 'candidate-compared' : ''}`}
                      onClick={compareMode ? () => toggleCompare(i) : undefined}
                    >
                      <div className="candidate-accent" />
                      <div className="candidate-content">
                        <div className="candidate-header">
                          {compareMode && (
                            <div className={`compare-checkbox ${compareSelection.includes(i) ? 'compare-checkbox-checked' : ''}`}>
                              {compareSelection.includes(i) && '✓'}
                            </div>
                          )}
                          <div className="candidate-rank">#{i + 1}</div>
                          <div className="candidate-name">{c.disease}</div>
                          <div className="candidate-prob-wrap">
                            <div className="prob-label">{c.probability}%</div>
                            <div className="prob-bar-bg">
                              <div className="prob-bar" style={{ width: `${c.probability}%` }} />
                            </div>
                          </div>
                        </div>

                        <p className="candidate-explanation">{c.explanation}</p>

                        {c.confirmatory_test && (
                          <div className="confirmatory-test">
                            <span className="test-icon">🧪</span>
                            <span className="test-label">Confirmatory:</span>
                            <span className="test-name">{c.confirmatory_test.name}</span>
                            <span className="test-cost">{c.confirmatory_test.cost_range}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Uncertainty note */}
                {result.uncertainty_note && (
                  <div className="alert-box alert-uncertainty">
                    <span className="alert-icon">💡</span>
                    <div className="alert-body">
                      <div className="alert-label">To Increase Confidence</div>
                      {result.uncertainty_note}
                    </div>
                  </div>
                )}

                {/* Red flags */}
                {result.red_flags && (
                  <div className="alert-box alert-red-flags">
                    <span className="alert-icon">⚠️</span>
                    <div className="alert-body">
                      <div className="alert-label">Red Flags</div>
                      {result.red_flags}
                    </div>
                  </div>
                )}

                {/* Research */}
                {result.research?.summary && (
                  <div className="research-section">
                    <div className="section-label">Live Research — {result.research.disease}</div>
                    <div className="research-body">
                      {result.research.summary.split('\n').filter(Boolean).map((line, i) => (
                        <p key={i} className={line.startsWith('###') ? 'research-heading' : 'research-line'}>
                          {line.replace(/^###\s*/, '')}
                        </p>
                      ))}
                    </div>
                    {result.research.citations?.length > 0 && (
                      <div className="research-citations">
                        <span className="citations-label">Sources:</span>
                        {result.research.citations.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="citation-link">
                            [{i + 1}]
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Voice briefing */}
                {(result.audio_en || result.audio_es) && (
                  <div className="voice-section">
                    <div className="section-label">Audio Briefing</div>
                    <div className="voice-players">
                      {result.audio_en && (
                        <div className="voice-player">
                          <span className="voice-lang">🇺🇸 English</span>
                          <audio controls src={`data:audio/mp3;base64,${result.audio_en}`} />
                        </div>
                      )}
                      {result.audio_es && (
                        <div className="voice-player">
                          <span className="voice-lang">🇪🇸 Spanish</span>
                          <audio controls src={`data:audio/mp3;base64,${result.audio_es}`} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
