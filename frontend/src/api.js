import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8003' : '')

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
