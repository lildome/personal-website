import { useState, useEffect } from 'react'
import './ArchitectureDiagramV2.css'

// ── Theme-aware 6-colour palette ────────────────────────────────
// Intentionally not CSS variables — categories must stay distinct
// regardless of the site theme.

const PALETTE = {
  light: {
    core:     { fill: '#DDE9D6', stroke: '#4A9959', name: '#2D5A36', sub: '#5A7860' },
    screen:   { fill: '#EDE0C4', stroke: '#B08D3E', name: '#6E5621', sub: '#8A6E32' },
    dash:     { fill: '#D2E4E0', stroke: '#4E8C84', name: '#2E5751', sub: '#3E6B64' },
    proc:     { fill: '#E1D7E2', stroke: '#8A6B92', name: '#553F5C', sub: '#6E5476' },
    ondemand: { fill: '#EDDAD0', stroke: '#B57A5C', name: '#724732', sub: '#9A6647' },
    store:    { fill: '#E4E2DA', stroke: '#9A9788', name: '#5E5C52', sub: '#73726C' },
    line:     '#73726C',
    lineLabel:'#5A6B5E',
    tierRule: '#9A9788',
  },
  dark: {
    core:     { fill: '#2E4636', stroke: '#72BB80', name: '#A9D9B2', sub: '#7FA888' },
    screen:   { fill: '#473D26', stroke: '#C9A65A', name: '#E2C684', sub: '#C4A865' },
    dash:     { fill: '#26403D', stroke: '#5FA59B', name: '#86C5BC', sub: '#6FB0A6' },
    proc:     { fill: '#3D3145', stroke: '#9E7BA8', name: '#C3A6CB', sub: '#A98DB2' },
    ondemand: { fill: '#473227', stroke: '#C28A66', name: '#DBA984', sub: '#C0906E' },
    store:    { fill: '#383832', stroke: '#8C897C', name: '#B0AD9E', sub: '#9C9A92' },
    line:     '#9C9A92',
    lineLabel:'#9BB8A0',
    tierRule: '#8C897C',
  },
}

function useTheme() {
  const getTheme = () => document.documentElement.getAttribute('data-theme') ?? 'light'
  const [theme, setTheme] = useState(getTheme)
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(getTheme()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

// ── Desktop SVG nodes ───────────────────────────────────────────
// sw = optional strokeWidth override

const D_NODES = [
  // Tier 1 — Ingest & screen
  { x: 40,  y: 48,  w: 120, h: 52, cat: 'core',     name: 'job-scraper',                         sub: 'Lambda + Apify'                        },
  { x: 210, y: 52,  w: 110, h: 44, cat: 'store',    name: 'jobs (DDB)',                           sub: null                                    },
  { x: 370, y: 48,  w: 130, h: 52, cat: 'store',    name: 'EventBridge',                          sub: 'Pipe → SQS'                       },
  { x: 540, y: 48,  w: 120, h: 52, cat: 'screen',   name: 'job-screener',                         sub: 'Gemini Flash'                          },
  // Tier 2 — Dashboard (heavier border to read as the hub)
  { x: 195, y: 168, w: 290, h: 60, cat: 'dash',     name: 'Dashboard',                            sub: 'review scores · promote · trigger outputs', sw: 1.5 },
  // Tier 3 — Analyse
  { x: 245, y: 288, w: 190, h: 56, cat: 'proc',     name: 'job-processor',                        sub: 'Sequential, MaxConcurrency=2'          },
  { x: 40,  y: 388, w: 180, h: 52, cat: 'core',     name: 'job-summariser',                       sub: 'Lambda + Claude'                       },
  { x: 250, y: 388, w: 180, h: 52, cat: 'core',     name: 'company-researcher',                   sub: 'Lambda + Claude'                       },
  { x: 460, y: 388, w: 180, h: 52, cat: 'core',     name: 'cv-matcher',                           sub: 'Lambda + Claude'                       },
  // Tier 4 — On-demand outputs
  { x: 150, y: 508, w: 170, h: 52, cat: 'ondemand', name: 'resume-tailor',                        sub: 'Lambda + Claude'                       },
  { x: 370, y: 508, w: 190, h: 52, cat: 'ondemand', name: 'cover-letter-generator',               sub: 'Lambda + Claude'                       },
  // Storage
  { x: 40,  y: 630, w: 600, h: 40, cat: 'store',    name: 'DynamoDB: jobs · companies · profiles', sub: null                       },
]

// ── Desktop connectors (palette-dependent, built in render) ─────
// dashedColor: override stroke + arrowhead with that colour instead of palette.line

function buildConns(p) {
  return [
    // Tier 1 horizontal
    { d: 'M 160,74 L 210,74',             label: 'insert',              lx: 185, ly: 67,  anchor: 'middle' },
    { d: 'M 320,74 L 370,74',             label: 'stream',              lx: 345, ly: 67,  anchor: 'middle' },
    { d: 'M 500,74 L 540,74' },
    // Scores: job-screener bottom → dashboard right side (one turn)
    { d: 'M 600,100 L 600,198 L 485,198', label: 'scores',              lx: 612, ly: 150, anchor: 'start'  },
    // Promote: dashboard bottom-centre → job-processor top
    { d: 'M 340,228 L 340,288',           label: 'promote',             lx: 346, ly: 262, anchor: 'start'  },
    // Fan: job-processor bottom → three core lambdas
    { d: 'M 340,344 L 130,388',           label: 'invokes in sequence', lx: 205, ly: 372, anchor: 'middle' },
    { d: 'M 340,344 L 340,388' },
    { d: 'M 340,344 L 550,388' },
    // Write-backs → DynamoDB (no labels)
    { d: 'M 130,440 L 130,630' },
    { d: 'M 340,440 L 340,630' },
    { d: 'M 550,440 L 550,630' },
    { d: 'M 235,560 L 235,630' },
    { d: 'M 465,560 L 465,630' },
    // Trigger: dashed, ondemand.stroke colour, routes outside job-summariser via x=24 channel
    {
      d: 'M 195,200 L 24,200 L 24,534 L 150,534',
      label: 'trigger',
      lx: 30, ly: 372, anchor: 'start',
      dashed: true,
      dashedColor: p.ondemand.stroke,
      opacity: 0.75,
    },
  ]
}

// ── Mobile data ─────────────────────────────────────────────────

const M_TIERS = [
  {
    label: 'Ingest & screen — automatic, every job',
    nodes: [
      { name: 'job-scraper',    sub: 'Lambda + Apify',    cat: 'core',     arrow: 'insert'  },
      { name: 'jobs (DDB)',     sub: null,                cat: 'store',    arrow: 'stream'  },
      { name: 'EventBridge',   sub: 'Pipe → SQS',  cat: 'store',    arrow: null      },
      { name: 'job-screener',  sub: 'Gemini Flash',      cat: 'screen',   arrow: 'scores'  },
    ],
  },
  {
    label: 'Dashboard — control surface',
    nodes: [
      { name: 'Dashboard', sub: 'review scores · promote · trigger outputs', cat: 'dash', arrow: 'promote / trigger' },
    ],
  },
  {
    label: 'Analyse — only promoted jobs',
    nodes: [
      { name: 'job-processor',      sub: 'Sequential, MaxConcurrency=2', cat: 'proc', arrow: 'invokes in sequence' },
      { name: 'job-summariser',     sub: 'Lambda + Claude',              cat: 'core', arrow: 'write-back'         },
      { name: 'company-researcher', sub: 'Lambda + Claude',              cat: 'core', arrow: 'write-back'         },
      { name: 'cv-matcher',         sub: 'Lambda + Claude',              cat: 'core', arrow: null                 },
    ],
  },
  {
    label: 'On-demand outputs — from the dashboard',
    nodes: [
      { name: 'resume-tailor',          sub: 'Lambda + Claude', cat: 'ondemand', arrow: 'write-back' },
      { name: 'cover-letter-generator', sub: 'Lambda + Claude', cat: 'ondemand', arrow: null         },
    ],
  },
]

// ── Component ───────────────────────────────────────────────────

export default function ArchitectureDiagramV2() {
  const theme = useTheme()
  const p = PALETTE[theme]
  const conns = buildConns(p)

  return (
    <div className="arch-v2-diagram">

      {/* ── Desktop SVG ──────────────────────────────────────── */}
      <svg
        className="arch-svg"
        width="100%"
        viewBox="0 0 680 700"
        aria-label="Job tracker architecture diagram"
      >
        <defs>
          <marker id="arch-v2-arr" markerWidth="6" markerHeight="5"
            refX="6" refY="2.5" orient="auto">
            <polygon points="0 0, 6 2.5, 0 5" fill={p.line} />
          </marker>
          <marker id="arch-v2-arr-od" markerWidth="6" markerHeight="5"
            refX="6" refY="2.5" orient="auto">
            <polygon points="0 0, 6 2.5, 0 5" fill={p.ondemand.stroke} />
          </marker>
        </defs>

        {/* Tier band labels and rules */}
        {[
          { label: 'Ingest & screen — automatic, every job',          ly: 26, ry: 34 },
          { label: 'Dashboard — the control surface, you decide what happens', ly: 146, ry: 154 },
          { label: 'Analyse — only promoted jobs',                    ly: 266, ry: 274 },
          { label: 'On-demand outputs — triggered from the dashboard', ly: 484, ry: 492 },
        ].map(({ label, ly, ry }) => (
          <g key={ly}>
            <text x={40} y={ly}
              style={{ fontSize: 11, fill: p.lineLabel, fontWeight: 500, letterSpacing: '0.02em' }}>
              {label}
            </text>
            <line x1={40} y1={ry} x2={640} y2={ry}
              stroke={p.tierRule} strokeWidth={0.5} opacity={0.4} />
          </g>
        ))}

        {/* Connections drawn before nodes so arrowheads sit under node edges */}
        {conns.map((c, i) => {
          const color = c.dashedColor ?? p.line
          const markerId = c.dashedColor ? 'arch-v2-arr-od' : 'arch-v2-arr'
          return (
            <g key={i} opacity={c.opacity ?? 1}>
              <path
                d={c.d}
                markerEnd={`url(#${markerId})`}
                style={{
                  fill: 'none',
                  stroke: color,
                  strokeWidth: 1.5,
                  ...(c.dashed ? { strokeDasharray: '5 3' } : {}),
                }}
              />
              {c.label && (
                <text x={c.lx} y={c.ly} textAnchor={c.anchor ?? 'middle'}
                  style={{ fontSize: 12, fill: p.lineLabel }}>
                  {c.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Nodes */}
        {D_NODES.map((n, i) => {
          const cat = p[n.cat]
          const cx = n.x + n.w / 2
          const cy = n.y + n.h / 2
          const nameY = n.sub ? cy - 8 : cy
          return (
            <g key={i}>
              <rect
                x={n.x} y={n.y} width={n.w} height={n.h} rx={8}
                fill={cat.fill}
                stroke={cat.stroke}
                strokeWidth={n.sw ?? 1}
              />
              <text x={cx} y={nameY} textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: 14, fontWeight: 500, fill: cat.name }}>
                {n.name}
              </text>
              {n.sub && (
                <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="central"
                  style={{ fontSize: 12, fill: cat.sub }}>
                  {n.sub}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* ── Mobile HTML layout ───────────────────────────────── */}
      <div className="arch-v2-mobile">

        {M_TIERS.map((tier, ti) => (
          <div key={ti} className="arch-v2-m-tier">
            <p className="arch-v2-m-tier-label">{tier.label}</p>
            {tier.nodes.map((item, ni) => {
              const cat = p[item.cat]
              return (
                <div key={ni} className="arch-v2-m-item">
                  <div className="arch-v2-m-node" style={{ borderLeftColor: cat.stroke, background: cat.fill }}>
                    <span className="arch-v2-m-name" style={{ color: cat.name }}>{item.name}</span>
                    {item.sub && <span className="arch-v2-m-sub" style={{ color: cat.sub }}>{item.sub}</span>}
                  </div>
                  {item.arrow && (
                    <div className="arch-v2-m-arrow" style={{ '--arch-v2-line': p.line }}>
                      <span className="arch-v2-m-arrow-track" />
                      <span className="arch-v2-m-arrow-label" style={{ color: p.lineLabel }}>{item.arrow}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Storage at the bottom */}
        <div className="arch-v2-m-item">
          <div className="arch-v2-m-node" style={{ borderLeftColor: p.store.stroke, background: p.store.fill }}>
            <span className="arch-v2-m-name" style={{ color: p.store.name }}>
              DynamoDB: jobs &middot; companies &middot; profiles
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
