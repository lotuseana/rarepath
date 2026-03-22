import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8005' : '')

export async function diagnose({ symptoms, labs, examFindings, familyHistory }) {
  const res = await axios.post(`${BASE}/api/diagnose`, {
    symptoms,
    labs: labs || null,
    exam_findings: examFindings || '',
    family_history: familyHistory || '',
  })
  return res.data
}

export async function searchHPO(query) {
  const res = await axios.get(`${BASE}/api/hpo/search`, { params: { q: query } })
  return res.data.results
}

export async function fetchOmiLatest(uid = 'default') {
  const res = await axios.get(`${BASE}/api/omi/latest`, { params: { uid } })
  return res.data
}

export async function resetOmi() {
  await axios.post(`${BASE}/api/omi/reset`)
}

export async function generateVoice({ candidates, uncertainty_note, language }) {
  const res = await axios.post(`${BASE}/api/voice`, {
    candidates,
    uncertainty_note: uncertainty_note || '',
    language,
  })
  return res.data
}
