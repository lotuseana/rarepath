import { useEffect, useState, useRef, useCallback } from 'react'
import axios from 'axios'
import './Federation.css'

const BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8003' : '')
const PHASE_MS = 280

// ── Network Topology SVG ───────────────────────────────────────────────

function NetworkSVG({ phase, hospitals, round, latest }) {
  const W = 500, H = 420
  const cx = W / 2, cy = H / 2 - 10
  const R = 145

  const nodes = hospitals.map((_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / hospitals.length
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }
  })

  const curve = (from, to) => {
    const dx = to.x - from.x, dy = to.y - from.y
    const len = Math.sqrt(dx * dx + dy * dy)
    const mx = (from.x + to.x) / 2 + (-dy / len) * 22
    const my = (from.y + to.y) / 2 + (dx / len) * 22
    return `M${from.x},${from.y} Q${mx},${my} ${to.x},${to.y}`
  }

  const isBroadcast = phase === 'broadcast'
  const isAggregate = phase === 'aggregate'
  const isTraining = phase === 'training'
  const isActive = phase !== 'idle'
  const connClass = isBroadcast ? 'broadcast' : isAggregate ? 'aggregate' : isTraining ? 'train' : ''
  const hubColor = isAggregate ? '#60a5fa' : '#00d4a8'
  const flags = ['🇺🇸', '🇺🇸', '🇳🇬', '🇺🇸', '🇬🇧', '🇩🇪', '🇮🇳']

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fed-topo-svg">
      <defs>
        <radialGradient id="g-teal">
          <stop offset="0%" stopColor="#00d4a8" stopOpacity="1" />
          <stop offset="100%" stopColor="#00d4a8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="g-blue">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-lg" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Orbital ring */}
      <circle cx={cx} cy={cy} r={R} fill="none"
        stroke={isActive ? 'rgba(0,212,168,0.05)' : 'rgba(255,255,255,0.025)'}
        strokeWidth="1" strokeDasharray="3 8" />

      {/* Connections */}
      {nodes.map((nd, i) => (
        <path key={i} d={curve({ x: cx, y: cy }, nd)}
          className={`fed-conn ${connClass}`}
          style={{ animationDelay: `${i * 0.07}s` }} />
      ))}

      {/* Broadcast packets */}
      {isBroadcast && nodes.map((nd, i) => {
        const p = curve({ x: cx, y: cy }, nd)
        return (
          <g key={`b-${round}-${i}`}>
            <circle r="9" fill="url(#g-teal)" opacity="0.5">
              <animateMotion dur={`${PHASE_MS * 0.7}ms`} fill="freeze" path={p}
                calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"
                begin={`${i * 20}ms`} />
            </circle>
            <circle r="3" fill="#00d4a8" filter="url(#glow)">
              <animateMotion dur={`${PHASE_MS * 0.7}ms`} fill="freeze" path={p}
                calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"
                begin={`${i * 20}ms`} />
            </circle>
          </g>
        )
      })}

      {/* Aggregate packets */}
      {isAggregate && nodes.map((nd, i) => {
        const p = curve(nd, { x: cx, y: cy })
        return (
          <g key={`a-${round}-${i}`}>
            <circle r="9" fill="url(#g-blue)" opacity="0.5">
              <animateMotion dur={`${PHASE_MS * 0.7}ms`} fill="freeze" path={p}
                calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"
                begin={`${i * 20}ms`} />
            </circle>
            <circle r="3" fill="#60a5fa" filter="url(#glow)">
              <animateMotion dur={`${PHASE_MS * 0.7}ms`} fill="freeze" path={p}
                calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1"
                begin={`${i * 20}ms`} />
            </circle>
          </g>
        )
      })}

      {/* Central aggregator */}
      <g>
        {(isBroadcast || isAggregate) && (
          <circle cx={cx} cy={cy} className="fed-hub-pulse" stroke={hubColor} />
        )}
        <circle cx={cx} cy={cy} r="34" fill="none"
          stroke={`${hubColor}33`} strokeWidth="1.5"
          strokeDasharray="12 4 4 4"
          className={`fed-hub-ring ${isActive ? 'fed-hub-spin' : ''}`} />
        <circle cx={cx} cy={cy} r="32"
          fill={`${hubColor}0a`} stroke={`${hubColor}44`}
          strokeWidth="1.5" filter={isActive ? 'url(#glow-lg)' : undefined} />

        {/* Server rack icon */}
        <g transform={`translate(${cx},${cy})`}>
          {[-11, -2, 7].map(y => (
            <g key={y}>
              <rect x="-10" y={y} width="20" height="7" rx="2" fill="none"
                stroke={hubColor} strokeWidth="0.8" opacity="0.7" />
              <circle cx="7" cy={y + 3.5} r="1.3" fill={hubColor} opacity="0.8" />
            </g>
          ))}
        </g>
        <text x={cx} y={cy + 28} textAnchor="middle"
          fontSize="7.5" fontWeight="800" fill="#64748b"
          letterSpacing="0.12em" fontFamily="var(--font-mono)">AGGREGATOR</text>
      </g>

      {/* Hospital nodes */}
      {nodes.map((pos, i) => {
        const h = hospitals[i]
        const nd = latest?.nodes.find(n => n.node_id === h?.id)
        const acc = nd ? `${(nd.accuracy * 100).toFixed(0)}%` : ''
        const active = !!nd
        const training = isTraining

        return (
          <g key={i}>
            {/* Training pulse ring */}
            <circle cx={pos.x} cy={pos.y} r="24"
              className={`fed-train-pulse ${training ? 'on' : ''}`}
              style={{ animationDelay: `${i * 0.15}s` }} />

            {/* Node circle */}
            <circle cx={pos.x} cy={pos.y} r="24"
              className="fed-node-bg"
              fill={training ? 'rgba(0,212,168,0.08)' : active ? 'rgba(0,212,168,0.03)' : 'rgba(255,255,255,0.02)'} />
            <circle cx={pos.x} cy={pos.y} r="24"
              className="fed-node-ring"
              fill="none"
              stroke={training ? 'rgba(0,212,168,0.45)' : active ? 'rgba(0,212,168,0.15)' : 'rgba(255,255,255,0.06)'}
              strokeWidth={training ? '1.5' : '1'} />

            {/* Hospital cross */}
            <g transform={`translate(${pos.x},${pos.y})`} opacity={active ? 0.85 : 0.3}>
              <rect x="-3" y="-9" width="6" height="18" rx="1.5"
                fill={training || active ? '#00d4a8' : '#64748b'} />
              <rect x="-9" y="-3" width="18" height="6" rx="1.5"
                fill={training || active ? '#00d4a8' : '#64748b'} />
            </g>

            {/* Accuracy */}
            {acc && (
              <text x={pos.x} y={pos.y + 19} textAnchor="middle"
                fontSize="8.5" fontWeight="800" fill="#00d4a8"
                fontFamily="var(--font-mono)" filter="url(#glow)">{acc}</text>
            )}
            {/* Name */}
            <text x={pos.x} y={pos.y + 31} textAnchor="middle"
              fontSize="8" fill="#94a3b8" fontWeight="600">{h?.name?.split(' ')[0]}</text>
            {/* Flag */}
            <text x={pos.x} y={pos.y + 43} textAnchor="middle" fontSize="10">{flags[i]}</text>
          </g>
        )
      })}

      {/* Status */}
      <text x={cx} y={H - 8} textAnchor="middle"
        fontSize="9" fontWeight="700" letterSpacing="0.08em"
        fill={isBroadcast ? '#00d4a8' : isAggregate ? '#60a5fa' : isTraining ? '#f59e0b' : '#475569'}>
        {isBroadcast ? 'DISTRIBUTING GLOBAL WEIGHTS'
          : isAggregate ? 'AGGREGATING UPDATES · FedAvg'
          : isTraining ? 'LOCAL TRAINING ON PRIVATE DATA'
          : latest ? `ROUND ${latest.round} · ${(latest.global_accuracy * 100).toFixed(1)}% GLOBAL ACCURACY` : 'READY'}
      </text>
    </svg>
  )
}

// ── Convergence Chart ──────────────────────────────────────────────────

function ConvergenceChart({ rounds, currentRound }) {
  const W = 440, H = 260
  const pad = { t: 22, r: 16, b: 28, l: 36 }
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b
  const total = rounds.length
  const visible = rounds.slice(0, currentRound)

  const toX = r => pad.l + (r - 1) / Math.max(total - 1, 1) * cW
  const accY = a => pad.t + (1 - a) * cH

  const allLoss = rounds.map(r => r.nodes.reduce((s, n) => s + n.loss, 0) / r.nodes.length)
  const maxL = Math.max(...allLoss), minL = Math.min(...allLoss)
  const lR = maxL - minL || 1
  const lossY = l => pad.t + (1 - (l - minL) / lR) * cH

  const accPts = visible.map(r => `${toX(r.round)},${accY(r.global_accuracy)}`).join(' ')
  const lossPts = visible.map(r => {
    const l = r.nodes.reduce((s, n) => s + n.loss, 0) / r.nodes.length
    return `${toX(r.round)},${lossY(l)}`
  }).join(' ')

  const last = visible[visible.length - 1]
  const xTicks = [1, 5, 10, 15, 20].filter(r => r <= total)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="fed-chart-svg">
      <defs>
        <linearGradient id="acc-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00d4a8" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#00d4a8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {[0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(v => (
        <g key={v}>
          <line x1={pad.l} y1={accY(v)} x2={W - pad.r} y2={accY(v)} stroke="rgba(255,255,255,0.04)" />
          <text x={pad.l - 5} y={accY(v) + 3} textAnchor="end"
            fontSize="8" fill="#475569" fontFamily="var(--font-mono)">{(v * 100).toFixed(0)}%</text>
        </g>
      ))}
      {xTicks.map(r => (
        <text key={r} x={toX(r)} y={H - 4} textAnchor="middle"
          fontSize="8" fill="#475569" fontFamily="var(--font-mono)">R{r}</text>
      ))}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="rgba(255,255,255,0.04)" />
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="rgba(255,255,255,0.04)" />

      {/* Area fill + lines */}
      {visible.length > 1 && <>
        <polygon points={`${toX(1)},${H - pad.b} ${accPts} ${toX(last.round)},${H - pad.b}`}
          fill="url(#acc-area)" />
        <polyline points={lossPts} fill="none"
          stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.4"
          strokeLinecap="round" strokeDasharray="5 3" />
        <polyline points={accPts} fill="none"
          stroke="#00d4a8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 3px rgba(0,212,168,0.5))' }} />
      </>}

      {/* Current point */}
      {last && (() => {
        const px = toX(last.round), py = accY(last.global_accuracy)
        return <g>
          <circle cx={px} cy={py} r="12" fill="none" stroke="#00d4a8" opacity="0">
            <animate attributeName="r" values="5;14" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <circle cx={px} cy={py} r="4" fill="#00d4a8"
            style={{ filter: 'drop-shadow(0 0 6px rgba(0,212,168,0.8))' }} />
          <text x={px + 8} y={py - 5} fontSize="11" fill="#00d4a8" fontWeight="800"
            fontFamily="var(--font-mono)">{(last.global_accuracy * 100).toFixed(1)}%</text>
        </g>
      })()}

      {/* Legend */}
      <g transform={`translate(${pad.l + 4},${pad.t - 8})`}>
        <circle cx="4" cy="0" r="3" fill="#00d4a8" />
        <text x="11" y="3" fontSize="8.5" fill="#64748b" fontWeight="600">Global Accuracy</text>
        <line x1="110" y1="0" x2="122" y2="0" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x="126" y="3" fontSize="8.5" fill="#64748b" fontWeight="600">Avg Loss</text>
      </g>
    </svg>
  )
}

// ── Node Card ──────────────────────────────────────────────────────────

function NodeCard({ hospital, nodeRound, active, training }) {
  const acc = nodeRound ? (nodeRound.accuracy * 100).toFixed(1) : '—'
  return (
    <div className={`fed-node ${training ? 'training' : active ? 'active' : ''}`}>
      <div className="fed-node-head">
        <div className={`fed-node-dot ${active ? 'on' : ''}`} />
        <div className="fed-node-name">{hospital.name.split(' ').slice(0, 2).join(' ')}</div>
        <span className={`fed-node-badge ${training ? 'on' : ''}`}>TRAIN</span>
      </div>
      <div className="fed-node-metrics">
        <span className="fed-node-acc">{acc}<span className="u">%</span></span>
        <span className="fed-node-pts">{hospital.patients.toLocaleString()}</span>
      </div>
      <div className="fed-node-bar">
        <div className="fed-node-fill" style={{ width: nodeRound ? `${nodeRound.accuracy * 100}%` : '0%' }} />
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────

export default function FederationDashboard() {
  const [data, setData] = useState(null)
  const [currentRound, setCurrentRound] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [phase, setPhase] = useState('idle')
  const timers = useRef([])

  useEffect(() => {
    axios.get(`${BASE}/api/federation`).then(r => {
      setData(r.data)
      setCurrentRound(r.data.total_rounds)
    })
    return () => timers.current.forEach(clearTimeout)
  }, [])

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  const play = useCallback(() => {
    if (!data) return
    clear()
    setCurrentRound(0)
    setPlaying(true)
    let r = 0
    const step = () => {
      r++
      if (r > data.total_rounds) { setPlaying(false); setPhase('idle'); return }
      setPhase('broadcast')
      timers.current.push(setTimeout(() => { setPhase('training'); setCurrentRound(r) }, PHASE_MS))
      timers.current.push(setTimeout(() => setPhase('aggregate'), PHASE_MS * 2))
      timers.current.push(setTimeout(step, PHASE_MS * 3))
    }
    step()
  }, [data, clear])

  const reset = useCallback(() => {
    clear(); setPlaying(false); setPhase('idle'); setCurrentRound(data?.total_rounds || 0)
  }, [data, clear])

  if (!data) return <div className="fed-loading">Loading federation data…</div>

  const rounds = data.rounds.slice(0, currentRound)
  const latest = rounds[rounds.length - 1]
    ?? (currentRound === data.total_rounds ? data.rounds[data.total_rounds - 1] : null)
  const globalAcc = latest ? (latest.global_accuracy * 100).toFixed(1) : '—'
  const avgLoss = latest
    ? (latest.nodes.reduce((s, n) => s + n.loss, 0) / latest.nodes.length).toFixed(3) : '—'
  const totalPts = data.hospitals.reduce((s, h) => s + h.patients, 0)

  const phaseIdx = { broadcast: 0, training: 1, aggregate: 2 }[phase] ?? -1
  const phases = ['Distribute', 'Train', 'Aggregate']

  return (
    <div className="fed-dashboard">
      {/* Header */}
      <div className="fed-header">
        <div className="fed-header-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="5" r="2.5" stroke="#00d4a8" strokeWidth="1.5" />
            <circle cx="5" cy="19" r="2.5" stroke="#60a5fa" strokeWidth="1.5" />
            <circle cx="19" cy="19" r="2.5" stroke="#60a5fa" strokeWidth="1.5" />
            <line x1="12" y1="7.5" x2="5" y2="16.5" stroke="#00d4a8" strokeWidth="1" opacity="0.5" />
            <line x1="12" y1="7.5" x2="19" y2="16.5" stroke="#00d4a8" strokeWidth="1" opacity="0.5" />
          </svg>
          <h1 className="fed-title">Federated Learning</h1>
          <span className="fed-subtitle">{data.hospitals.length} nodes · {totalPts.toLocaleString()} patient records</span>
        </div>

        <div className="fed-phase-ind">
          {(playing || phase !== 'idle') && (
            <span className="fed-round-tag">R{currentRound}/{data.total_rounds}</span>
          )}
          {phases.map((name, i) => (
            <div key={i} className="fed-phase-step">
              <span className={`fed-phase-dot ${i < phaseIdx ? 'done' : i === phaseIdx && phase !== 'idle' ? 'active' : ''}`} />
              <span className={`fed-phase-name ${i === phaseIdx && phase !== 'idle' ? 'active' : ''}`}>{name}</span>
            </div>
          ))}
        </div>

        <div className="fed-controls">
          <button className="fed-btn" onClick={play} disabled={playing}>
            {playing ? 'Training…' : 'Start'}
          </button>
          <button className="fed-btn fed-btn-ghost" onClick={reset} disabled={playing}>Reset</button>
        </div>
      </div>

      {/* Body — topology left, chart+stats right */}
      <div className="fed-body">
        <div className="fed-topo-panel">
          <NetworkSVG phase={phase} hospitals={data.hospitals} round={currentRound} latest={latest} />
        </div>

        <div className="fed-info-panel">
          <div className="fed-stats-row">
            <div className="fed-stat">
              <span className="fed-stat-val">{globalAcc}<span className="u">%</span></span>
              <span className="fed-stat-lbl">Global Accuracy</span>
            </div>
            <div className="fed-stat">
              <span className="fed-stat-val">{currentRound}<span className="sep">/</span>{data.total_rounds}</span>
              <span className="fed-stat-lbl">Round</span>
            </div>
            <div className="fed-stat">
              <span className="fed-stat-val">{avgLoss}</span>
              <span className="fed-stat-lbl">Avg Loss</span>
            </div>
            <div className="fed-stat green">
              <span className="fed-stat-val">0</span>
              <span className="fed-stat-lbl">Data Shared</span>
            </div>
          </div>

          <div className="fed-chart-panel">
            <div className="fed-chart-title">Model Convergence</div>
            <ConvergenceChart rounds={data.rounds} currentRound={currentRound} />
          </div>

          <div className="fed-privacy">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2.5" y="6" width="7" height="4.5" rx="1" stroke="#34d399" strokeWidth="1" />
              <path d="M4 6V4.5a2 2 0 014 0V6" fill="none" stroke="#34d399" strokeWidth="1" />
            </svg>
            <span>Zero patient data shared — only model gradients traverse the network</span>
          </div>
        </div>
      </div>

      {/* Bottom — hospital nodes */}
      <div className="fed-nodes">
        {data.hospitals.map(h => {
          const nr = latest?.nodes.find(n => n.node_id === h.id)
          return (
            <NodeCard key={h.id} hospital={h} nodeRound={nr}
              active={currentRound > 0}
              training={phase === 'training' && playing} />
          )
        })}
      </div>
    </div>
  )
}
