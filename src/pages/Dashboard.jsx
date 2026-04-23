import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import './Dashboard.css'

const API_BASE = 'https://nvv4c6g5jl.execute-api.us-east-1.amazonaws.com/prod'

function getToken() {
  return localStorage.getItem('dashboard_token')
}

function isSessionValid() {
  const token = getToken()
  const expiry = localStorage.getItem('dashboard_token_expiry')
  return !!(token && expiry && Date.now() < parseInt(expiry, 10))
}

function clearSession() {
  localStorage.removeItem('dashboard_token')
  localStorage.removeItem('dashboard_token_expiry')
}

async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers['X-Session-Token'] = token
  return fetch(API_BASE + path, { ...options, headers })
}

function ScoreBadge({ score, onLockClick }) {
  if (score == null) {
    return (
      <span
        className="db-locked-pill"
        onClick={e => { e.stopPropagation(); onLockClick() }}
        role="button"
        tabIndex={0}
        title="Unlock to view score"
      >
        ••••
      </span>
    )
  }
  const mod = score >= 7 ? 'high' : score >= 5 ? 'mid' : 'low'
  return <span className={`db-score-badge db-score-badge--${mod}`}>{score}</span>
}

function StatusPill({ status }) {
  const slug = (status || 'unknown').toLowerCase().replace(/\s+/g, '-')
  return <span className={`db-status-pill db-status-pill--${slug}`}>{status || '—'}</span>
}

function ResumeOutputPanel({ pdfUrl, markdown }) {
  const [showRaw, setShowRaw] = useState(false)

  if (!pdfUrl) {
    return (
      <div className="db-card">
        <span className="db-section-label">Tailored resume</span>
        <p className="db-resume-fallback-note">PDF generation unavailable — showing raw markdown.</p>
        <pre className="db-output-pre">{markdown}</pre>
      </div>
    )
  }

  return (
    <div className="db-card db-resume-preview">
      <div className="db-resume-preview__header">
        <span className="db-section-label db-section-label--inline">Tailored resume</span>
        <a href={pdfUrl} download className="db-btn db-btn--accent">
          Download PDF
        </a>
      </div>
      <iframe
        src={pdfUrl}
        title="Tailored resume preview"
        className="db-resume-preview__iframe"
      />
      <p className="db-resume-preview__mobile-note">PDF preview is only available on desktop.</p>
      <button className="db-raw-toggle" type="button" onClick={() => setShowRaw(v => !v)}>
        View raw markdown {showRaw ? '▾' : '▸'}
      </button>
      {showRaw && <pre className="db-output-pre">{markdown}</pre>}
    </div>
  )
}

export default function Dashboard() {
  const [locked, setLocked] = useState(() => !isSessionValid())
  const [navSlot, setNavSlot] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)

  const [view, setView] = useState('list')
  const [selectedJobId, setSelectedJobId] = useState(null)

  const [jobs, setJobs] = useState([])
  const [jobDetail, setJobDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  const [statusFilter, setStatusFilter] = useState('')
  const [minScore, setMinScore] = useState('')

  const [outputPanel, setOutputPanel] = useState(null)
  const [guidedFeedback, setGuidedFeedback] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const [scrapeForm, setScrapeForm] = useState({ position: '', location: '', country: 'US', maxItems: 25 })
  const [scrapeSuccess, setScrapeSuccess] = useState(false)
  const [scrapeLoading, setScrapeLoading] = useState(false)

  useEffect(() => {
    setNavSlot(document.getElementById('nav-extra-slot'))
    if (!isSessionValid()) {
      clearSession()
      setLocked(true)
    }
  }, [])

  const handleUnauth = useCallback(() => {
    clearSession()
    setLocked(true)
  }, [])

  const loadJobs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/jobs')
      if (res.status === 401) { handleUnauth(); return }
      const data = await res.json()
      setJobs(data)
    } finally {
      setLoading(false)
    }
  }, [handleUnauth])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  async function loadJobDetail(id) {
    setDetailLoading(true)
    try {
      const res = await apiFetch(`/jobs/${id}`)
      if (res.status === 401) { handleUnauth(); return }
      const data = await res.json()
      setJobDetail(data)
    } finally {
      setDetailLoading(false)
    }
  }

  function openDetail(id) {
    setSelectedJobId(id)
    setView('detail')
    setJobDetail(null)
    setOutputPanel(null)
    loadJobDetail(id)
  }

  function backToList() {
    setView('list')
    setSelectedJobId(null)
    setJobDetail(null)
    setOutputPanel(null)
  }

  function openModal() {
    if (!locked) return
    setModalOpen(true)
    setPinError('')
    setPinInput('')
  }

  function closeModal() {
    setModalOpen(false)
    setPinError('')
  }

  async function submitPin(e) {
    e.preventDefault()
    setPinLoading(true)
    setPinError('')
    try {
      const res = await fetch(API_BASE + '/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      })
      if (res.status === 401) {
        setPinError('Incorrect PIN')
        return
      }
      const data = await res.json()
      localStorage.setItem('dashboard_token', data.token)
      localStorage.setItem('dashboard_token_expiry', String(Date.now() + 8 * 60 * 60 * 1000))
      setLocked(false)
      setModalOpen(false)
      setPinInput('')
      loadJobs()
      if (selectedJobId) loadJobDetail(selectedJobId)
    } catch {
      setPinError('Network error. Try again.')
    } finally {
      setPinLoading(false)
    }
  }

  async function updateStatus(id, status) {
    if (locked) { openModal(); return }
    const res = await apiFetch(`/jobs/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
    if (res.status === 401) { handleUnauth(); openModal(); return }
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status } : j))
    if (jobDetail?.job?.id === id) {
      setJobDetail(prev => ({ ...prev, job: { ...prev.job, status } }))
    }
  }

  async function runResume() {
    if (locked) { openModal(); return }
    setActionLoading(true)
    try {
      const res = await apiFetch(`/jobs/${selectedJobId}/resume`, { method: 'POST' })
      if (res.status === 401) { handleUnauth(); openModal(); return }
      const data = await res.json()
      setOutputPanel({
        type: 'resume',
        content: data.tailored_resume,
        pdfUrl: data.tailored_resume_pdf_url,
      })
    } finally {
      setActionLoading(false)
    }
  }

  async function runCoverLetter() {
    if (locked) { openModal(); return }
    setActionLoading(true)
    try {
      const res = await apiFetch(`/jobs/${selectedJobId}/cover-letter`, {
        method: 'POST',
        body: JSON.stringify({ mode: 'autonomous' }),
      })
      if (res.status === 401) { handleUnauth(); openModal(); return }
      const data = await res.json()
      setOutputPanel({ type: 'cover-letter', content: data.cover_letter })
    } finally {
      setActionLoading(false)
    }
  }

  async function startGuidedCoverLetter() {
    if (locked) { openModal(); return }
    setActionLoading(true)
    try {
      const res = await apiFetch(`/jobs/${selectedJobId}/cover-letter`, {
        method: 'POST',
        body: JSON.stringify({ mode: 'guided', conversation_history: [] }),
      })
      if (res.status === 401) { handleUnauth(); openModal(); return }
      const data = await res.json()
      setOutputPanel({ type: 'cover-letter-guided', content: data.draft, history: data.conversation_history })
      setGuidedFeedback('')
    } finally {
      setActionLoading(false)
    }
  }

  async function reviseGuidedCoverLetter() {
    if (!outputPanel?.history || !guidedFeedback) return
    setActionLoading(true)
    try {
      const res = await apiFetch(`/jobs/${selectedJobId}/cover-letter`, {
        method: 'POST',
        body: JSON.stringify({
          mode: 'guided',
          feedback: guidedFeedback,
          conversation_history: outputPanel.history,
        }),
      })
      if (res.status === 401) { handleUnauth(); openModal(); return }
      const data = await res.json()
      setOutputPanel({ type: 'cover-letter-guided', content: data.draft, history: data.conversation_history })
      setGuidedFeedback('')
    } finally {
      setActionLoading(false)
    }
  }

  async function submitScrape(e) {
    e.preventDefault()
    if (locked) { openModal(); return }
    setScrapeLoading(true)
    try {
      await apiFetch('/scrape', {
        method: 'POST',
        body: JSON.stringify({
          position: scrapeForm.position,
          ...(scrapeForm.location ? { location: scrapeForm.location } : {}),
          ...(scrapeForm.country ? { country: scrapeForm.country } : {}),
          ...(scrapeForm.maxItems ? { maxItemsPerSearch: scrapeForm.maxItems } : {}),
        }),
      })
      setScrapeSuccess(true)
    } finally {
      setScrapeLoading(false)
    }
  }

  const filteredJobs = jobs.filter(j => {
    if (statusFilter && j.status !== statusFilter) return false
    if (minScore !== '' && j.match_score != null && j.match_score < Number(minScore)) return false
    return true
  })

  const detailTitle = jobDetail?.job?.positionName
    ? jobDetail.job.positionName.length > 32
      ? jobDetail.job.positionName.slice(0, 32) + '…'
      : jobDetail.job.positionName
    : '…'

  function reqText(req) {
    if (typeof req === 'string') return req
    return req.requirement || req.skill || req.text || ''
  }

  const PinPill = (
    <button
      className={`db-pin-pill ${locked ? 'db-pin-pill--locked' : 'db-pin-pill--unlocked'}`}
      onClick={locked ? openModal : undefined}
      aria-label={locked ? 'Locked — click to unlock' : 'Session unlocked'}
      type="button"
    >
      <span className="db-pin-pill__dot" />
    </button>
  )

  return (
    <div className="dashboard" data-theme="dark">
      {navSlot && createPortal(PinPill, navSlot)}

      {modalOpen && (
        <div className="db-modal-scrim" onClick={closeModal}>
          <div className="db-modal" onClick={e => e.stopPropagation()}>
            <h2 className="db-modal__heading">Enter PIN</h2>
            <p className="db-modal__sub">
              Unlock to run AI actions — scraping, resume tailoring, and cover letter generation.
            </p>
            {pinError && <p className="db-modal__error">{pinError}</p>}
            <form onSubmit={submitPin}>
              <input
                className="db-modal__input"
                type="password"
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                autoFocus
                placeholder="••••"
              />
              <button className="db-modal__submit" type="submit" disabled={pinLoading}>
                {pinLoading ? 'Checking…' : 'Unlock'}
              </button>
            </form>
            <button className="db-modal__cancel" type="button" onClick={closeModal}>
              Cancel — continue browsing
            </button>
          </div>
        </div>
      )}

      <div className="dashboard__inner">

        {/* ── LIST VIEW ─────────────────────────────────── */}
        {view === 'list' && (
          <>
            <nav className="db-breadcrumb" aria-label="Breadcrumb">
              <span className="db-breadcrumb__item">Projects</span>
              <span className="db-breadcrumb__sep">/</span>
              <span className="db-breadcrumb__item">Job hunt</span>
              <span className="db-breadcrumb__sep">/</span>
              <span className="db-breadcrumb__item">Dashboard</span>
            </nav>

            <div className="db-toolbar">
              <div className="db-toolbar__left">
                <h1 className="db-toolbar__heading">Jobs</h1>
                <span className="db-toolbar__count">{filteredJobs.length}</span>
              </div>
              <div className="db-toolbar__right">
                <select
                  className="db-filter-select"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="new">New</option>
                  <option value="applied">Applied</option>
                  <option value="interviewing">Interviewing</option>
                  <option value="offer">Offer</option>
                  <option value="rejected">Rejected</option>
                  <option value="archived">Archived</option>
                </select>
                <input
                  className={`db-filter-input${locked ? ' f-input--locked' : ''}`}
                  type="number"
                  min="0"
                  max="10"
                  placeholder="Min score"
                  value={minScore}
                  onChange={e => setMinScore(e.target.value)}
                  disabled={locked}
                  title={locked ? 'Unlock to filter by score' : undefined}
                />
                <button className="db-btn db-btn--secondary" onClick={loadJobs} disabled={loading}>
                  {loading ? '…' : 'Refresh'}
                </button>
                <button
                  className="db-btn db-btn--accent"
                  onClick={() => { setView('search'); setScrapeSuccess(false) }}
                  type="button"
                >
                  New search
                </button>
              </div>
            </div>

            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Position</th>
                    <th style={{ width: '20%' }}>Company</th>
                    <th style={{ width: '18%' }}>Location</th>
                    <th style={{ width: '10%' }}>Score</th>
                    <th style={{ width: '13%' }}>Status</th>
                    <th style={{ width: '11%' }}>Scraped</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map(job => (
                    <tr
                      key={job.id}
                      className="db-table__row"
                      onClick={() => openDetail(job.id)}
                    >
                      <td className="db-table__position">{job.positionName}</td>
                      <td>{job.company}</td>
                      <td className="db-table__muted">{job.location}</td>
                      <td>
                        <ScoreBadge score={job.match_score} onLockClick={openModal} />
                      </td>
                      <td><StatusPill status={job.status} /></td>
                      <td className="db-table__muted db-table__mono">
                        {job.scrapedAt?.slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                  {!loading && filteredJobs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="db-table__empty">No jobs found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── DETAIL VIEW ───────────────────────────────── */}
        {view === 'detail' && (
          <>
            <nav className="db-breadcrumb" aria-label="Breadcrumb">
              <Link to="/projects" className="db-breadcrumb__link">Projects</Link>
              <span className="db-breadcrumb__sep">/</span>
              <Link to="/projects/job-hunt" className="db-breadcrumb__link">Job hunt</Link>
              <span className="db-breadcrumb__sep">/</span>
              <Link
                to="/projects/job-hunt/dashboard"
                className="db-breadcrumb__link"
                onClick={e => { e.preventDefault(); backToList() }}
              >
                Dashboard
              </Link>
              <span className="db-breadcrumb__sep">/</span>
              <span className="db-breadcrumb__item">{detailTitle}</span>
            </nav>
            <button className="db-back" type="button" onClick={backToList}>← Back</button>

            {detailLoading && <p className="db-loading">Loading…</p>}

            {!detailLoading && jobDetail && (
              <div className="db-detail-grid">
                <div className="db-detail-main">

                  {/* Main card */}
                  <div className="db-card">
                    <h1 className="db-detail-title">
                      {jobDetail.job.positionName}
                      <span className="db-detail-company"> @ {jobDetail.job.company}</span>
                    </h1>
                    <div className="db-meta-row">
                      {jobDetail.job.location && (
                        <span className="db-tag">{jobDetail.job.location}</span>
                      )}
                      <ScoreBadge score={jobDetail.job.match_score} onLockClick={openModal} />
                    </div>

                    {jobDetail.job.match_summary ? (
                      <p className="db-match-summary">{jobDetail.job.match_summary}</p>
                    ) : (
                      <div
                        className="db-locked-row"
                        onClick={openModal}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && openModal()}
                      >
                        <span className="db-locked-row__icon">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <rect x="3" y="6" width="8" height="7" rx="1.5" fill="currentColor" opacity=".4"/>
                            <path d="M4.5 6V4a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none"/>
                          </svg>
                        </span>
                        <span className="db-locked-row__label">Match analysis hidden</span>
                        <span className="db-locked-row__action">Unlock to view →</span>
                      </div>
                    )}

                    <hr className="db-rule" />

                    <div className="db-status-row">
                      <span className="db-section-label">Status</span>
                      {locked ? (
                        <button
                          className="db-status-locked-btn"
                          type="button"
                          onClick={openModal}
                        >
                          {jobDetail.job.status || 'unknown'}&nbsp;🔒
                        </button>
                      ) : (
                        <select
                          className="db-status-select"
                          value={jobDetail.job.status || ''}
                          onChange={e => updateStatus(selectedJobId, e.target.value)}
                        >
                          <option value="new">New</option>
                          <option value="applied">Applied</option>
                          <option value="interviewing">Interviewing</option>
                          <option value="offer">Offer</option>
                          <option value="rejected">Rejected</option>
                          <option value="archived">Archived</option>
                        </select>
                      )}
                    </div>

                    <div className="db-actions">
                      <button
                        className={locked ? 'db-btn db-btn--locked' : 'db-btn db-btn--accent'}
                        onClick={locked ? openModal : runResume}
                        disabled={actionLoading}
                        type="button"
                      >
                        Tailor resume
                      </button>
                      <button
                        className={locked ? 'db-btn db-btn--locked' : 'db-btn db-btn--secondary'}
                        onClick={locked ? openModal : runCoverLetter}
                        disabled={actionLoading}
                        type="button"
                      >
                        Cover letter
                      </button>
                      <button
                        className={locked ? 'db-btn db-btn--locked' : 'db-btn db-btn--secondary'}
                        onClick={locked ? openModal : startGuidedCoverLetter}
                        disabled={actionLoading}
                        type="button"
                      >
                        Cover letter guided
                      </button>
                    </div>

                    {locked && (
                      <p className="db-locked-note">
                        Unlock with PIN to tailor resume and generate cover letters.
                      </p>
                    )}
                  </div>

                  {/* Job summary card */}
                  {jobDetail.job.summary && (
                    <div className="db-card">
                      <span className="db-section-label">Job summary</span>

                      {jobDetail.job.summary.job_summary && (
                        <p className="db-summary-text">{jobDetail.job.summary.job_summary}</p>
                      )}

                      {jobDetail.job.summary.experience_requirements?.length > 0 && (
                        <div className="db-req-section">
                          <span className="db-section-label">Experience</span>
                          <ul className="db-req-list">
                            {jobDetail.job.summary.experience_requirements.map((req, i) => (
                              <li key={i} className="db-req-item">
                                <span className="db-req-text">{reqText(req)}</span>
                                {req.confidence && (
                                  <span className={`db-conf-badge db-conf-badge--${req.confidence}`}>
                                    {req.confidence}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {jobDetail.job.summary.skill_requirements?.length > 0 && (
                        <div className="db-req-section">
                          <span className="db-section-label">Skills</span>
                          <ul className="db-req-list">
                            {jobDetail.job.summary.skill_requirements.map((req, i) => (
                              <li key={i} className="db-req-item">
                                <span className="db-req-text">{reqText(req)}</span>
                                {req.confidence && (
                                  <span className={`db-conf-badge db-conf-badge--${req.confidence}`}>
                                    {req.confidence}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {jobDetail.job.summary.red_flags &&
                        jobDetail.job.summary.red_flags !== 'none identified' && (
                          <p className="db-red-flags">⚠ {jobDetail.job.summary.red_flags}</p>
                        )}
                    </div>
                  )}

                  {/* Output panel — resume */}
                  {outputPanel?.type === 'resume' && (
                    <ResumeOutputPanel
                      pdfUrl={outputPanel.pdfUrl}
                      markdown={outputPanel.content}
                    />
                  )}

                  {/* Output panel — cover letter */}
                  {(outputPanel?.type === 'cover-letter' || outputPanel?.type === 'cover-letter-guided') && (
                    <div className="db-card">
                      <span className="db-section-label">Cover letter</span>
                      <pre className="db-output-pre">{outputPanel.content}</pre>
                      {outputPanel.type === 'cover-letter-guided' && (
                        <div className="db-guided">
                          <textarea
                            className="db-guided__textarea"
                            placeholder="Feedback for revision…"
                            value={guidedFeedback}
                            onChange={e => setGuidedFeedback(e.target.value)}
                          />
                          <button
                            className="db-btn db-btn--secondary"
                            type="button"
                            onClick={reviseGuidedCoverLetter}
                            disabled={actionLoading || !guidedFeedback}
                          >
                            Revise
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Sidebar */}
                <aside className="db-sidebar">
                  <div className="db-card">
                    <span className="db-section-label">Company</span>

                    {jobDetail.company?.candidate_fit_score != null ? (
                      <div className="db-fit-block">
                        <span className="db-fit-score">{jobDetail.company.candidate_fit_score}</span>
                        <span className="db-fit-label">Candidate fit</span>
                        {jobDetail.company.candidate_fit_reasoning && (
                          <p className="db-fit-reasoning">{jobDetail.company.candidate_fit_reasoning}</p>
                        )}
                      </div>
                    ) : (
                      <div
                        className="db-locked-placeholder"
                        onClick={openModal}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && openModal()}
                      >
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                          <rect x="3" y="6" width="8" height="7" rx="1.5" fill="currentColor" opacity=".4"/>
                          <path d="M4.5 6V4a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none"/>
                        </svg>
                        <span>Fit score hidden — unlock to view</span>
                      </div>
                    )}

                    {jobDetail.company?.summary && (
                      <p className="db-company-summary">{jobDetail.company.summary}</p>
                    )}

                    {jobDetail.company?.culture_notes && (
                      <div className="db-culture-block">
                        <span className="db-section-label">Culture</span>
                        <p className="db-culture-text">{jobDetail.company.culture_notes}</p>
                      </div>
                    )}

                    {jobDetail.company?.recent_news &&
                      jobDetail.company.recent_news !== 'N/A' && (
                        <div className="db-news-block">
                          <span className="db-section-label">Recent news</span>
                          <p className="db-news-text">{jobDetail.company.recent_news}</p>
                        </div>
                      )}
                  </div>
                </aside>
              </div>
            )}
          </>
        )}

        {/* ── SEARCH VIEW ───────────────────────────────── */}
        {view === 'search' && (
          <>
            <nav className="db-breadcrumb" aria-label="Breadcrumb">
              <Link to="/projects" className="db-breadcrumb__link">Projects</Link>
              <span className="db-breadcrumb__sep">/</span>
              <Link to="/projects/job-hunt" className="db-breadcrumb__link">Job hunt</Link>
              <span className="db-breadcrumb__sep">/</span>
              <Link
                to="/projects/job-hunt/dashboard"
                className="db-breadcrumb__link"
                onClick={e => { e.preventDefault(); backToList() }}
              >
                Dashboard
              </Link>
              <span className="db-breadcrumb__sep">/</span>
              <span className="db-breadcrumb__item">New search</span>
            </nav>
            <button className="db-back" type="button" onClick={backToList}>← Back</button>

            <div className="db-search-wrap">
              <div className="db-card">
                <h2 className="db-search-heading">Search for jobs</h2>
                <form className="db-search-form" onSubmit={submitScrape}>
                  <div className="db-form-grid">
                    <div className="db-form-field">
                      <label className="db-form-label">Position / keywords</label>
                      <input
                        className="db-form-input"
                        type="text"
                        required
                        value={scrapeForm.position}
                        onChange={e => setScrapeForm(f => ({ ...f, position: e.target.value }))}
                        placeholder="e.g. Software Engineer"
                      />
                    </div>
                    <div className="db-form-field">
                      <label className="db-form-label">Location</label>
                      <input
                        className="db-form-input"
                        type="text"
                        value={scrapeForm.location}
                        onChange={e => setScrapeForm(f => ({ ...f, location: e.target.value }))}
                        placeholder="e.g. San Francisco"
                      />
                    </div>
                    <div className="db-form-field">
                      <label className="db-form-label">Country</label>
                      <select
                        className="db-form-select"
                        value={scrapeForm.country}
                        onChange={e => setScrapeForm(f => ({ ...f, country: e.target.value }))}
                      >
                        <option value="US">United States</option>
                        <option value="GB">United Kingdom</option>
                        <option value="CA">Canada</option>
                        <option value="AU">Australia</option>
                        <option value="DE">Germany</option>
                        <option value="FR">France</option>
                        <option value="NL">Netherlands</option>
                        <option value="SG">Singapore</option>
                        <option value="IN">India</option>
                        <option value="remote">Remote</option>
                      </select>
                    </div>
                    <div className="db-form-field">
                      <label className="db-form-label">Max listings</label>
                      <input
                        className="db-form-input"
                        type="number"
                        min="1"
                        max="100"
                        value={scrapeForm.maxItems}
                        onChange={e => setScrapeForm(f => ({ ...f, maxItems: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <button
                    className={locked ? 'db-btn db-btn--locked' : 'db-btn db-btn--accent'}
                    type="submit"
                    disabled={scrapeLoading}
                  >
                    {scrapeLoading ? 'Searching…' : 'Start search'}
                  </button>
                  {locked && (
                    <p className="db-locked-note">Requires PIN unlock.</p>
                  )}
                </form>
                {scrapeSuccess && (
                  <p className="db-scrape-success">
                    Search started. Results will appear in the jobs list once complete.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
