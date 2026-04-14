import { forwardRef, useRef, useState, useLayoutEffect, useId } from 'react'
import {
  LambdaIcon,
  DatabaseIcon,
  QueueIcon,
  ApiIcon,
  FrontendIcon,
  StorageIcon,
  PipeIcon,
  DeployIcon,
} from './icons/index.js'
import './ArchitectureDiagram.css'

// ── Static data ────────────────────────────────────────────────

const NODES = [
  { id: 'amplify',           name: 'Amplify',            sublabel: 'Frontend',        icon: FrontendIcon,  variant: 'surface', group: 'frontend'  },
  { id: 'apiGateway',        name: 'API Gateway',         sublabel: null,              icon: ApiIcon,       variant: 'surface', group: 'api'       },
  { id: 'apiLambda',         name: 'api',                 sublabel: 'Lambda',          icon: LambdaIcon,    variant: 'lambda',  group: 'api'       },
  { id: 'jobScraper',        name: 'job-scraper',         sublabel: 'Lambda + Apify',  icon: LambdaIcon,    variant: 'lambda',  group: 'pipeline'  },
  { id: 'sqs',               name: 'SQS',                 sublabel: null,              icon: QueueIcon,     variant: 'surface', group: 'pipeline'  },
  { id: 'jobProcessor',      name: 'job-processor',       sublabel: 'MaxConcurrency=2',icon: LambdaIcon,    variant: 'lambda',  group: 'pipeline'  },
  { id: 'jobSummariser',     name: 'job-summariser',      sublabel: 'Lambda + Claude', icon: LambdaIcon,    variant: 'lambda',  group: 'pipeline'  },
  { id: 'companyResearcher', name: 'company-researcher',  sublabel: 'Lambda + Claude', icon: LambdaIcon,    variant: 'lambda',  group: 'pipeline'  },
  { id: 'cvMatcher',         name: 'cv-matcher',          sublabel: 'Lambda + Claude', icon: LambdaIcon,    variant: 'lambda',  group: 'pipeline'  },
  { id: 'resumeTailor',      name: 'resume-tailor',       sublabel: 'Lambda + Claude', icon: LambdaIcon,    variant: 'lambda',  group: 'ondemand'  },
  { id: 'coverLetter',       name: 'cover-letter-gen',    sublabel: 'Lambda + Claude', icon: LambdaIcon,    variant: 'lambda',  group: 'ondemand'  },
  { id: 'jobsTable',         name: 'jobs',                sublabel: 'DynamoDB',        icon: DatabaseIcon,  variant: 'dynamo',  group: 'data'      },
  { id: 'companiesTable',    name: 'companies',           sublabel: 'DynamoDB',        icon: DatabaseIcon,  variant: 'dynamo',  group: 'data'      },
  { id: 'profiles',          name: 'candidate_profiles',  sublabel: 'DynamoDB',        icon: DatabaseIcon,  variant: 'dynamo',  group: 'data'      },
  { id: 'ssm',               name: 'SSM Param Store',     sublabel: null,              icon: StorageIcon,   variant: 'surface', group: 'infra'     },
  { id: 'lambdaRole',        name: 'Lambda Role',         sublabel: 'Execution IAM',   icon: StorageIcon,   variant: 'surface', group: 'infra'     },
  { id: 'ecr',               name: 'ECR',                 sublabel: null,              icon: StorageIcon,   variant: 'surface', group: 'infra'     },
  { id: 'github',            name: 'GitHub Actions',      sublabel: null,              icon: DeployIcon,    variant: 'surface', group: 'cicd'      },
  { id: 'docker',            name: 'Docker',              sublabel: null,              icon: DeployIcon,    variant: 'surface', group: 'cicd'      },
  { id: 'ecrPush',           name: 'ECR push',            sublabel: 'update-function', icon: PipeIcon,      variant: 'surface', group: 'cicd'      },
]

const CONNECTIONS = [
  { from: 'amplify',           to: 'apiGateway',       label: null            },
  { from: 'apiGateway',        to: 'apiLambda',        label: null            },
  { from: 'apiLambda',         to: 'jobScraper',       label: 'trigger'       },
  { from: 'jobScraper',        to: 'jobsTable',        label: 'INSERT'        },
  { from: 'jobsTable',         to: 'sqs',              label: 'stream'        },
  { from: 'sqs',               to: 'jobProcessor',     label: 'MaxConcurrency=2' },
  { from: 'jobProcessor',      to: 'jobSummariser',    label: null            },
  { from: 'jobProcessor',      to: 'companyResearcher',label: null            },
  { from: 'jobProcessor',      to: 'cvMatcher',        label: null            },
  { from: 'jobSummariser',     to: 'jobsTable',        label: null            },
  { from: 'companyResearcher', to: 'companiesTable',   label: null            },
  { from: 'cvMatcher',         to: 'jobsTable',        label: null            },
  { from: 'apiLambda',         to: 'resumeTailor',     label: 'on-demand'     },
  { from: 'apiLambda',         to: 'coverLetter',      label: 'on-demand'     },
  { from: 'resumeTailor',      to: 'profiles',         label: null            },
  { from: 'coverLetter',       to: 'profiles',         label: null            },
  { from: 'jobProcessor',      to: 'ssm',              label: 'assumes'       },
  { from: 'github',            to: 'docker',           label: null            },
  { from: 'docker',            to: 'ecrPush',          label: null            },
  { from: 'ecrPush',           to: 'ecr',              label: 'OIDC'          },
]

const NODES_MAP = Object.fromEntries(NODES.map(n => [n.id, n]))

// ── Path calculation ───────────────────────────────────────────

function getConnectionPath(fromEl, toEl, containerEl) {
  const cRect = containerEl.getBoundingClientRect()
  const fRect = fromEl.getBoundingClientRect()
  const tRect = toEl.getBoundingClientRect()

  const fx = fRect.left - cRect.left + fRect.width / 2
  const fy = fRect.top  - cRect.top  + fRect.height / 2
  const tx = tRect.left - cRect.left + tRect.width / 2
  const ty = tRect.top  - cRect.top  + tRect.height / 2

  const dx = tx - fx
  const dy = ty - fy

  let x1, y1, x2, y2

  if (Math.abs(dx) > Math.abs(dy)) {
    x1 = dx > 0 ? fRect.right  - cRect.left : fRect.left  - cRect.left
    y1 = fy
    x2 = dx > 0 ? tRect.left   - cRect.left : tRect.right - cRect.left
    y2 = ty
  } else {
    x1 = fx
    y1 = dy > 0 ? fRect.bottom - cRect.top  : fRect.top   - cRect.top
    x2 = tx
    y2 = dy > 0 ? tRect.top    - cRect.top  : tRect.bottom - cRect.top
  }

  const dist   = Math.sqrt(dx * dx + dy * dy)
  const offset = dist * 0.4
  const horizontal = Math.abs(dx) > Math.abs(dy)

  const cpx1 = x1 + (horizontal ? (dx > 0 ?  offset : -offset) : 0)
  const cpy1 = y1 + (horizontal ? 0 : (dy > 0 ?  offset : -offset))
  const cpx2 = x2 - (horizontal ? (dx > 0 ?  offset : -offset) : 0)
  const cpy2 = y2 - (horizontal ? 0 : (dy > 0 ?  offset : -offset))

  return {
    path: `M ${x1},${y1} C ${cpx1},${cpy1} ${cpx2},${cpy2} ${x2},${y2}`,
    midX: (x1 + x2) / 2,
    midY: (y1 + y2) / 2,
  }
}

// ── Sub-components ─────────────────────────────────────────────

const NodeCard = forwardRef(function NodeCard({ icon: Icon, name, sublabel, variant = 'surface' }, ref) {
  return (
    <div ref={ref} className={`arch-node arch-node--${variant}`}>
      <Icon size={20} />
      <span className="arch-node__name">{name}</span>
      {sublabel && <span className="arch-node__sublabel">{sublabel}</span>}
    </div>
  )
})

function DiagramGroup({ label, direction = 'row', children }) {
  return (
    <div className="arch-group">
      <span className="arch-group__label">{label}</span>
      <div className={`arch-group__inner arch-group__inner--${direction}`}>
        {children}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────

function ArchitectureDiagram({ layout = 'vertical' }) {
  const containerRef = useRef(null)
  const nodeRefs = useRef({})
  const rawId = useId()
  const markerId = 'arch-arrow-' + rawId.replace(/:/g, '')

  const [svgPaths, setSvgPaths] = useState([])
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 })
  const [effectiveLayout, setEffectiveLayout] = useState(layout)

  function nodeRef(id) {
    return el => { nodeRefs.current[id] = el }
  }

  function nodeProps(id) {
    const n = NODES_MAP[id]
    return { icon: n.icon, name: n.name, sublabel: n.sublabel, variant: n.variant }
  }

  // Effect 1: determine layout based on prop + viewport width
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    const isMobile = window.innerWidth < 768
    setEffectiveLayout(isMobile ? 'vertical' : layout)
  }, [layout])

  // Effect 2: measure nodes and calculate SVG paths
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    function measure() {
      setSvgSize({
        w: container.scrollWidth,
        h: container.scrollHeight,
      })

      const paths = []
      for (const conn of CONNECTIONS) {
        const fromEl = nodeRefs.current[conn.from]
        const toEl   = nodeRefs.current[conn.to]
        if (!fromEl || !toEl) continue
        paths.push({ ...conn, ...getConnectionPath(fromEl, toEl, container) })
      }
      setSvgPaths(paths)
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [effectiveLayout])

  // SVG overlay (shared between both layouts)
  const svgOverlay = (
    <svg
      className="arch-svg-overlay"
      width={svgSize.w}
      height={svgSize.h}
      aria-hidden="true"
    >
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon
            points="0 0, 8 3, 0 6"
            style={{ fill: 'var(--color-accent)', opacity: 0.6 }}
          />
        </marker>
      </defs>
      {svgPaths.map((conn, i) => (
        <g key={`${conn.from}-${conn.to}-${i}`}>
          <path
            d={conn.path}
            className="arch-conn-path"
            style={{ stroke: 'var(--color-accent)' }}
            markerEnd={`url(#${markerId})`}
          />
          {conn.label && (
            <text
              x={conn.midX}
              y={conn.midY - 4}
              textAnchor="middle"
              className="arch-conn-label"
              style={{ fill: 'var(--color-text-muted)' }}
            >
              {conn.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  )

  // ── Horizontal layout ──────────────────────────────────────

  if (effectiveLayout === 'horizontal') {
    return (
      <div className="arch-diagram arch-diagram--horizontal" ref={containerRef}>
        <div className="arch-main-flow">

          <DiagramGroup label="Frontend" direction="column">
            <NodeCard ref={nodeRef('amplify')} {...nodeProps('amplify')} />
          </DiagramGroup>

          <DiagramGroup label="API Layer" direction="column">
            <NodeCard ref={nodeRef('apiGateway')} {...nodeProps('apiGateway')} />
            <NodeCard ref={nodeRef('apiLambda')}  {...nodeProps('apiLambda')} />
          </DiagramGroup>

          <DiagramGroup label="Pipeline" direction="column">
            <NodeCard ref={nodeRef('jobScraper')}   {...nodeProps('jobScraper')} />
            <NodeCard ref={nodeRef('sqs')}           {...nodeProps('sqs')} />
            <NodeCard ref={nodeRef('jobProcessor')}  {...nodeProps('jobProcessor')} />
            <div className="arch-row">
              <NodeCard ref={nodeRef('jobSummariser')}     {...nodeProps('jobSummariser')} />
              <NodeCard ref={nodeRef('companyResearcher')} {...nodeProps('companyResearcher')} />
              <NodeCard ref={nodeRef('cvMatcher')}         {...nodeProps('cvMatcher')} />
            </div>
          </DiagramGroup>

          <DiagramGroup label="On-demand" direction="column">
            <NodeCard ref={nodeRef('resumeTailor')} {...nodeProps('resumeTailor')} />
            <NodeCard ref={nodeRef('coverLetter')}  {...nodeProps('coverLetter')} />
          </DiagramGroup>

          <DiagramGroup label="Data" direction="column">
            <NodeCard ref={nodeRef('jobsTable')}      {...nodeProps('jobsTable')} />
            <NodeCard ref={nodeRef('companiesTable')} {...nodeProps('companiesTable')} />
            <NodeCard ref={nodeRef('profiles')}       {...nodeProps('profiles')} />
          </DiagramGroup>

        </div>

        <div className="arch-support-row">
          <DiagramGroup label="Infrastructure" direction="row">
            <NodeCard ref={nodeRef('ssm')}        {...nodeProps('ssm')} />
            <NodeCard ref={nodeRef('lambdaRole')} {...nodeProps('lambdaRole')} />
            <NodeCard ref={nodeRef('ecr')}        {...nodeProps('ecr')} />
          </DiagramGroup>

          <DiagramGroup label="CI/CD" direction="row">
            <NodeCard ref={nodeRef('github')}  {...nodeProps('github')} />
            <NodeCard ref={nodeRef('docker')}  {...nodeProps('docker')} />
            <NodeCard ref={nodeRef('ecrPush')} {...nodeProps('ecrPush')} />
          </DiagramGroup>
        </div>

        {svgOverlay}
      </div>
    )
  }

  // ── Vertical layout (default + mobile fallback) ────────────

  return (
    <div className="arch-diagram arch-diagram--vertical" ref={containerRef}>

      <DiagramGroup label="Frontend" direction="row">
        <NodeCard ref={nodeRef('amplify')} {...nodeProps('amplify')} />
      </DiagramGroup>

      <DiagramGroup label="API Layer" direction="row">
        <NodeCard ref={nodeRef('apiGateway')} {...nodeProps('apiGateway')} />
        <NodeCard ref={nodeRef('apiLambda')}  {...nodeProps('apiLambda')} />
      </DiagramGroup>

      <DiagramGroup label="Pipeline" direction="column">
        <div className="arch-row">
          <NodeCard ref={nodeRef('jobScraper')}  {...nodeProps('jobScraper')} />
          <NodeCard ref={nodeRef('sqs')}          {...nodeProps('sqs')} />
          <NodeCard ref={nodeRef('jobProcessor')} {...nodeProps('jobProcessor')} />
        </div>
        <div className="arch-row">
          <NodeCard ref={nodeRef('jobSummariser')}     {...nodeProps('jobSummariser')} />
          <NodeCard ref={nodeRef('companyResearcher')} {...nodeProps('companyResearcher')} />
          <NodeCard ref={nodeRef('cvMatcher')}         {...nodeProps('cvMatcher')} />
        </div>
      </DiagramGroup>

      <div className="arch-side-by-side">
        <DiagramGroup label="On-demand" direction="column">
          <NodeCard ref={nodeRef('resumeTailor')} {...nodeProps('resumeTailor')} />
          <NodeCard ref={nodeRef('coverLetter')}  {...nodeProps('coverLetter')} />
        </DiagramGroup>

        <DiagramGroup label="Data" direction="column">
          <NodeCard ref={nodeRef('jobsTable')}      {...nodeProps('jobsTable')} />
          <NodeCard ref={nodeRef('companiesTable')} {...nodeProps('companiesTable')} />
          <NodeCard ref={nodeRef('profiles')}       {...nodeProps('profiles')} />
        </DiagramGroup>
      </div>

      <div className="arch-side-by-side">
        <DiagramGroup label="Infrastructure" direction="row">
          <NodeCard ref={nodeRef('ssm')}        {...nodeProps('ssm')} />
          <NodeCard ref={nodeRef('lambdaRole')} {...nodeProps('lambdaRole')} />
          <NodeCard ref={nodeRef('ecr')}        {...nodeProps('ecr')} />
        </DiagramGroup>

        <DiagramGroup label="CI/CD" direction="row">
          <NodeCard ref={nodeRef('github')}  {...nodeProps('github')} />
          <NodeCard ref={nodeRef('docker')}  {...nodeProps('docker')} />
          <NodeCard ref={nodeRef('ecrPush')} {...nodeProps('ecrPush')} />
        </DiagramGroup>
      </div>

      {svgOverlay}
    </div>
  )
}

export default ArchitectureDiagram
