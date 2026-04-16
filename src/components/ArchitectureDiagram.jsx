import './ArchitectureDiagram.css'

// ── Desktop layout ─────────────────────────────────────────────
//
//  ViewBox 730 × 440
//
//  [Frontend] ──────────→ [job-scraper] ──INSERT──→ [jobs DDB]
//      ↓╲ dashed                                         │ stream
//      ↓  ╲                                           [SQS]
//      ↓   ╲                                       [job-processor]
//      ↓    ╲                                    ↙       ↓        ↘
//  [resume] [cover-letter] [job-sum] [comp-res] [cv-match]  ON-DEMAND
//      ↓(d)     ↓(d)          ↓          ↓          ↓
//          [DynamoDB — jobs · companies · profiles]
//
// Node geometry: cx = x+w/2, cy = y+h/2, right = x+w, bottom = y+h

const D_NODES = [
  // Pipeline ─────────────────────────────────────────────────────
  { x:  10, y:  20, w: 120, h: 48, type: 'lambda',    name: 'Frontend',            sub: null                      },
  { x: 250, y:  20, w: 120, h: 48, type: 'lambda',    name: 'job-scraper',          sub: 'Lambda + Apify'          },
  { x: 450, y:  26, w: 120, h: 36, type: 'data',      name: 'DynamoDB',             sub: 'jobs'                    },
  { x: 450, y: 112, w: 120, h: 36, type: 'infra',     name: 'SQS',                  sub: null                      },
  { x: 440, y: 180, w: 140, h: 56, type: 'processor', name: 'job-processor',        sub: 'Sequential orchestrator' },
  { x: 320, y: 288, w: 120, h: 48, type: 'lambda',    name: 'job-summariser',       sub: 'Lambda + Claude'         },
  { x: 450, y: 288, w: 120, h: 48, type: 'lambda',    name: 'company-researcher',   sub: 'Lambda + Claude'         },
  { x: 580, y: 288, w: 120, h: 48, type: 'lambda',    name: 'cv-matcher',           sub: 'Lambda + Claude'         },
  // Combined write-back node — full width, all lambdas drop straight down into it
  { x:  10, y: 380, w: 690, h: 36, type: 'data',      name: 'DynamoDB',             sub: 'jobs · companies · profiles' },
  // On-demand — aligned to the same y=288 row as the pipeline lambdas
  { x:  10, y: 288, w: 120, h: 48, type: 'lambda',    name: 'resume-tailor',        sub: 'Lambda + Claude'         },
  { x: 150, y: 288, w: 120, h: 48, type: 'lambda',    name: 'cover-letter-gen',     sub: 'Lambda + Claude'         },
]

// ── Connections ────────────────────────────────────────────────
//
// All defined as SVG path strings.
//
// On-demand routing (dashed):
//   Frontend (cx=70) → resume-tailor (cx=70)     : straight down
//   Frontend (cx=70) → cover-letter-gen (cx=210) : diagonal right
//   resume-tailor    → DynamoDB (cx=70)          : straight down
//   cover-letter-gen → DynamoDB (cx=210)         : straight down

const D_CONNS = [
  // Pipeline (solid) ─────────────────────────────────────────────
  // Frontend right (130,44) → job-scraper left (250,44)
  { d: 'M 130,44  L 250,44',           label: 'triggers',         lx: 190, ly:  36, anchor: 'middle' },
  // job-scraper right (370,44) → jobs-pipe left (450,44)
  { d: 'M 370,44  L 450,44',           label: 'INSERT',            lx: 410, ly:  36, anchor: 'middle' },
  { d: 'M 510,62  L 510,112',          label: 'stream',            lx: 514, ly:  87, anchor: 'start'  },
  { d: 'M 510,148 L 510,180',          label: 'MaxConcurrency=2',  lx: 514, ly: 164, anchor: 'start'  },
  // fan from job-processor bottom (510,236)
  { d: 'M 510,236 L 380,288',          label: 'invokes',           lx: 436, ly: 257, anchor: 'middle' },
  { d: 'M 510,236 L 510,288',          label: 'invokes',           lx: 514, ly: 257, anchor: 'start'  },
  { d: 'M 510,236 L 640,288',          label: 'invokes',           lx: 582, ly: 257, anchor: 'middle' },
  // write-backs — straight down into full-width DynamoDB node, no labels
  { d: 'M 380,336 L 380,380' },
  { d: 'M 510,336 L 510,380' },
  { d: 'M 640,336 L 640,380' },
  // On-demand (dashed, 60% opacity) ──────────────────────────────
  // Frontend bottom → resume-tailor top (straight down, cx=70)
  { d: 'M 70,68   L 70,288',                                                                           dashed: true },
  // Frontend bottom → cover-letter-gen top (diagonal right)
  { d: 'M 70,68   L 210,288',                                                                          dashed: true },
  // resume-tailor bottom → DynamoDB top (straight down, cx=70)
  { d: 'M 70,336  L 70,380' },
  // cover-letter-gen bottom → DynamoDB top (straight down, cx=210)
  { d: 'M 210,336 L 210,380' },
]

// ── Mobile data (on-demand stays at bottom) ────────────────────

const M_PIPELINE = [
  { name: 'Frontend',            sub: null,                      type: 'lambda',    arrow: 'triggers'          },
  { name: 'job-scraper',         sub: 'Lambda + Apify',          type: 'lambda',    arrow: 'INSERT'            },
  { name: 'jobs',                sub: 'DynamoDB',                type: 'data',      arrow: 'stream'            },
  { name: 'SQS',                 sub: null,                      type: 'data',      arrow: 'MaxConcurrency=2'  },
  { name: 'job-processor',       sub: 'Sequential orchestrator', type: 'processor', arrow: 'invokes ×3'        },
  { name: 'job-summariser',      sub: 'Lambda + Claude',         type: 'lambda',    arrow: 'jobs'              },
  { name: 'company-researcher',  sub: 'Lambda + Claude',         type: 'lambda',    arrow: 'companies'         },
  { name: 'cv-matcher',          sub: 'Lambda + Claude',         type: 'lambda',    arrow: 'jobs'              },
  { name: 'DynamoDB',            sub: 'jobs · companies · profiles', type: 'data',  arrow: null                },
]

const M_ONDEMAND = [
  { name: 'resume-tailor',    sub: 'Lambda + Claude', type: 'lambda', arrow: 'reads / writes' },
  { name: 'cover-letter-gen', sub: 'Lambda + Claude', type: 'lambda', arrow: 'reads / writes' },
  { name: 'DynamoDB',         sub: 'jobs · companies · profiles', type: 'data', arrow: null   },
]

// ── Component ──────────────────────────────────────────────────

function ArchitectureDiagram() {
  return (
    <div className="arch-diagram">

      {/* ── Desktop SVG ─────────────────────────────────────── */}
      <svg
        className="arch-svg"
        width="100%"
        viewBox="0 0 730 440"
        aria-label="System data flow diagram"
      >
        <defs>
          <marker id="arch-arr" markerWidth="6" markerHeight="5"
            refX="6" refY="2.5" orient="auto">
            <polygon points="0 0, 6 2.5, 0 5"
              style={{ fill: 'var(--color-accent)' }} />
          </marker>
        </defs>

        {/* ON-DEMAND label — centred above the two on-demand Lambdas in the bottom row */}
        <text x={145} y={278} textAnchor="middle"
          style={{ fontSize: 10, fill: 'var(--color-text-muted)', fontWeight: 600, letterSpacing: '0.07em' }}>
          ON-DEMAND
        </text>

        {/* Connections drawn before nodes so arrowheads sit under node edges */}
        {D_CONNS.map((c, i) => (
          <g key={i} style={c.dashed ? { opacity: 0.6 } : undefined}>
            <path
              d={c.d}
              markerEnd="url(#arch-arr)"
              style={{
                fill: 'none',
                stroke: 'var(--color-accent)',
                strokeWidth: 1.5,
                ...(c.dashed ? { strokeDasharray: '5 3' } : {}),
              }}
            />
            {c.label && (
              <text x={c.lx} y={c.ly} textAnchor={c.anchor || 'middle'}
                style={{ fontSize: 10, fill: 'var(--color-text-muted)' }}>
                {c.label}
              </text>
            )}
          </g>
        ))}

        {/* Nodes */}
        {D_NODES.map((n, i) => {
          const cx = n.x + n.w / 2
          const cy = n.y + n.h / 2
          const nameY = n.sub ? cy - 7 : cy
          return (
            <g key={i}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="6"
                style={{
                  fill:        (n.type === 'data' || n.type === 'infra') ? 'var(--color-bg-subtle)'  : 'var(--color-bg-surface)',
                  stroke:      n.type === 'processor' ? 'var(--color-accent)'     : 'var(--color-border)',
                  strokeWidth: n.type === 'processor' ? 2 : 0.5,
                }}
              />
              {n.type === 'lambda' && (
                <path d={`M ${n.x + 6},${n.y + 1.5} H ${n.x + n.w - 6}`}
                  style={{ stroke: 'var(--color-accent)', strokeWidth: 3, fill: 'none', strokeLinecap: 'round' }} />
              )}
              {n.type === 'data' && (
                <path d={`M ${n.x + 6},${n.y + n.h - 1.5} H ${n.x + n.w - 6}`}
                  style={{ stroke: 'var(--color-accent)', strokeWidth: 3, fill: 'none', strokeLinecap: 'round' }} />
              )}
              <text x={cx} y={nameY} textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: n.type === 'processor' ? 12 : 11, fontWeight: 500, fill: 'var(--color-text-primary)' }}>
                {n.name}
              </text>
              {n.sub && (
                <text x={cx} y={cy + 7} textAnchor="middle" dominantBaseline="central"
                  style={{ fontSize: 10, fill: 'var(--color-text-muted)' }}>
                  {n.sub}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* ── Mobile HTML layout (on-demand at bottom) ────────── */}
      <div className="arch-mobile">

        <p className="arch-m-section-label">Pipeline</p>

        {M_PIPELINE.map((item, i) => (
          <div key={i} className="arch-m-item">
            <div className={`arch-m-node arch-m-node--${item.type}`}>
              <span className="arch-m-name">{item.name}</span>
              {item.sub && <span className="arch-m-sub">{item.sub}</span>}
            </div>
            {item.arrow && (
              <div className="arch-m-arrow">
                <span className="arch-m-arrow__track" />
                <span className="arch-m-arrow__label">{item.arrow}</span>
              </div>
            )}
          </div>
        ))}

        <p className="arch-m-section-label arch-m-section-label--sep">On-demand</p>

        {M_ONDEMAND.map((item, i) => (
          <div key={i} className="arch-m-item">
            <div className={`arch-m-node arch-m-node--${item.type}`}>
              <span className="arch-m-name">{item.name}</span>
              {item.sub && <span className="arch-m-sub">{item.sub}</span>}
            </div>
            {item.arrow && (
              <div className="arch-m-arrow arch-m-arrow--dashed">
                <span className="arch-m-arrow__track" />
                <span className="arch-m-arrow__label">{item.arrow}</span>
              </div>
            )}
          </div>
        ))}

      </div>
    </div>
  )
}

export default ArchitectureDiagram
