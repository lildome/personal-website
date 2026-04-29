import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import './Dashboard.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL

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

function ResumeOutputPanel({ status, pdfUrl, startedAt, error, onRegenerate }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (status !== 'generating') {
      setElapsed(0)
      return
    }
    const base = startedAt ? new Date(startedAt).getTime() : Date.now()
    setElapsed(Math.floor((Date.now() - base) / 1000))
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - base) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [status, startedAt])

  if (status === 'generating') {
    return (
      <div className="db-resume-panel">
        <div className="db-resume-panel__progress">
          <span className="db-resume-panel__progress-text">
            Generating resume... {elapsed}s
          </span>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="db-resume-panel">
        <div className="db-resume-panel__header">
          <span className="db-section-label db-section-label--inline">Tailored resume</span>
          <div className="db-resume-panel__actions">
            <button className="db-btn db-btn--secondary" type="button" onClick={onRegenerate} disabled={status === 'generating'}>
              Regenerate
            </button>
            <a href={pdfUrl} download className="db-btn db-btn--accent">
              Download PDF
            </a>
          </div>
        </div>
        <iframe
          src={pdfUrl}
          title="Tailored resume preview"
          className="db-resume-panel__iframe"
        />
        <p className="db-resume-panel__mobile-note">PDF preview is only available on desktop.</p>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="db-resume-panel">
        <div className="db-resume-panel__error">
          <span className="db-section-label">Resume generation failed</span>
          {error && <p className="db-resume-panel__error-text">{error}</p>}
          <button className="db-btn db-btn--accent" type="button" onClick={onRegenerate} disabled={status === 'generating'}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return null
}

function RevisionFeedbackModal({ open, onClose, onSubmit }) {
  const [feedback, setFeedback] = useState('')
  const modalRef = useRef(null)

  useEffect(() => {
    if (open) setFeedback('')
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleEsc(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const modal = modalRef.current
    if (!modal) return
    const focusable = modal.querySelectorAll('button, textarea, input, [tabindex]:not([tabindex="-1"])')
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    function trapFocus(e) {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', trapFocus)
    return () => document.removeEventListener('keydown', trapFocus)
  }, [open])

  if (!open) return null

  return (
    <div className="db-modal-scrim" onClick={onClose}>
      <div className="db-modal db-modal--wide" ref={modalRef} onClick={e => e.stopPropagation()}>
        <h2 className="db-modal__heading">Request revision</h2>
        <textarea
          className="db-modal__textarea"
          autoFocus
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          placeholder="What would you like to change about this cover letter? Be specific about which paragraphs or what aspects need adjustment."
          rows={7}
        />
        <div className="db-modal__footer">
          <button className="db-btn db-btn--secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="db-btn db-btn--accent"
            type="button"
            disabled={!feedback.trim()}
            onClick={() => { onSubmit(feedback); onClose() }}
          >
            Request revision
          </button>
        </div>
      </div>
    </div>
  )
}

function CoverLetterOutputPanel({ status, pdfUrl, startedAt, error, onRegenerate, onRevise }) {
  const [elapsed, setElapsed] = useState(0)
  const [revisionModalOpen, setRevisionModalOpen] = useState(false)

  useEffect(() => {
    if (status !== 'generating') {
      setElapsed(0)
      return
    }
    const base = startedAt ? new Date(startedAt).getTime() : Date.now()
    setElapsed(Math.floor((Date.now() - base) / 1000))
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - base) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [status, startedAt])

  if (status === 'generating') {
    return (
      <div className="db-resume-panel">
        <div className="db-resume-panel__progress">
          <span className="db-resume-panel__progress-text">
            Generating cover letter... {elapsed}s
          </span>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <>
        <div className="db-resume-panel">
          <div className="db-resume-panel__header">
            <span className="db-section-label db-section-label--inline">Cover letter</span>
            <div className="db-resume-panel__actions">
              <button className="db-btn db-btn--secondary" type="button" onClick={() => setRevisionModalOpen(true)}>
                Revise
              </button>
              <button className="db-btn db-btn--secondary" type="button" onClick={onRegenerate}>
                Regenerate
              </button>
              <a href={pdfUrl} download className="db-btn db-btn--accent">
                Download PDF
              </a>
            </div>
          </div>
          <iframe
            src={pdfUrl}
            title="Cover letter preview"
            className="db-resume-panel__iframe"
          />
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="db-resume-panel__mobile-note db-cover-letter-panel__open-link"
          >
            Open PDF →
          </a>
        </div>
        <RevisionFeedbackModal
          open={revisionModalOpen}
          onClose={() => setRevisionModalOpen(false)}
          onSubmit={feedback => onRevise(feedback)}
        />
      </>
    )
  }

  if (status === 'failed') {
    return (
      <div className="db-resume-panel">
        <div className="db-resume-panel__error">
          <span className="db-section-label">Cover letter generation failed</span>
          {error && <p className="db-resume-panel__error-text">{error}</p>}
          <button className="db-btn db-btn--accent" type="button" onClick={onRegenerate}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return null
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

  const [scrapeForm, setScrapeForm] = useState({ position: '', location: '', country: 'US', maxItems: 25 })
  const [scrapeSuccess, setScrapeSuccess] = useState(false)
  const [scrapeLoading, setScrapeLoading] = useState(false)

  const currentJobIdRef = useRef(null)
  const pollIntervalRef = useRef(null)
  const pollStartRef = useRef(null)
  const coverLetterPollStartRef = useRef(null)

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

  useEffect(() => {
    currentJobIdRef.current = selectedJobId
  }, [selectedJobId])

  useEffect(() => {
    const resumeStatus = jobDetail?.resume?.status
    const coverLetterStatus = jobDetail?.cover_letter?.status
    const jobId = jobDetail?.job?.id

    const eitherGenerating = resumeStatus === 'generating' || coverLetterStatus === 'generating'

    if (!eitherGenerating || !jobId) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      pollStartRef.current = null
      coverLetterPollStartRef.current = null
      return
    }

    if (pollIntervalRef.current) return

    pollStartRef.current = resumeStatus === 'generating' ? Date.now() : null
    coverLetterPollStartRef.current = coverLetterStatus === 'generating' ? Date.now() : null

    pollIntervalRef.current = setInterval(async () => {
      const now = Date.now()

      if (pollStartRef.current && now - pollStartRef.current > 90_000) {
        pollStartRef.current = null
        setJobDetail(prev => {
          if (!prev || prev.job.id !== jobId || prev.resume?.status !== 'generating') return prev
          return { ...prev, resume: { ...prev.resume, status: 'failed', error: 'Generation is taking longer than expected. Check back in a few minutes.' } }
        })
      }

      if (coverLetterPollStartRef.current && now - coverLetterPollStartRef.current > 90_000) {
        coverLetterPollStartRef.current = null
        setJobDetail(prev => {
          if (!prev || prev.job.id !== jobId || prev.cover_letter?.status !== 'generating') return prev
          return { ...prev, cover_letter: { ...prev.cover_letter, status: 'failed', error: 'Generation is taking longer than expected. Check back in a few minutes.' } }
        })
      }

      if (currentJobIdRef.current !== jobId) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
        return
      }

      try {
        const res = await apiFetch(`/jobs/${jobId}/generation-status`)
        if (res.status === 401) { handleUnauth(); return }
        const data = await res.json()
        if (currentJobIdRef.current !== jobId) return
        setJobDetail(prev => prev && prev.job.id === jobId
          ? { ...prev, resume: data.resume, cover_letter: data.cover_letter }
          : prev
        )
      } catch {
        // ignore transient network errors during polling
      }
    }, 3000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [jobDetail?.resume?.status, jobDetail?.cover_letter?.status, jobDetail?.job?.id, handleUnauth])

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
    loadJobDetail(id)
  }

  function backToList() {
    setView('list')
    setSelectedJobId(null)
    setJobDetail(null)
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

    setJobDetail(prev => prev ? {
      ...prev,
      resume: {
        status: 'generating',
        pdf_url: null,
        started_at: new Date().toISOString(),
        error: null,
      }
    } : prev)

    const res = await apiFetch(`/jobs/${selectedJobId}/resume`, { method: 'POST' })
    if (res.status === 401) { handleUnauth(); openModal(); return }
    // 202 — polling picks up the real status
  }

  async function runCoverLetter() {
    if (locked) { openModal(); return }

    setJobDetail(prev => prev ? {
      ...prev,
      cover_letter: {
        status: 'generating',
        pdf_url: null,
        started_at: new Date().toISOString(),
        error: null,
      }
    } : prev)

    const res = await apiFetch(`/jobs/${selectedJobId}/cover-letter`, {
      method: 'POST',
      body: JSON.stringify({ mode: 'generate' }),
    })
    if (res.status === 401) { handleUnauth(); openModal(); return }
    // 202 — polling picks up the real status
  }

  async function runCoverLetterRevise(feedback) {
    if (locked) { openModal(); return }

    setJobDetail(prev => prev ? {
      ...prev,
      cover_letter: {
        status: 'generating',
        pdf_url: null,
        started_at: new Date().toISOString(),
        error: null,
      }
    } : prev)

    try {
      const res = await apiFetch(`/jobs/${selectedJobId}/cover-letter`, {
        method: 'POST',
        body: JSON.stringify({ mode: 'revise', feedback }),
      })
      if (res.status === 401) { handleUnauth(); openModal(); return }
      // 202 — polling picks up the real status
    } catch {
      setJobDetail(prev => prev ? {
        ...prev,
        cover_letter: {
          ...prev.cover_letter,
          status: 'failed',
          error: 'Failed to submit revision request. Please try again.',
        }
      } : prev)
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
                        disabled={jobDetail.resume?.status === 'generating'}
                        type="button"
                      >
                        Tailor resume
                      </button>
                      <button
                        className={locked ? 'db-btn db-btn--locked' : 'db-btn db-btn--secondary'}
                        onClick={locked ? openModal : runCoverLetter}
                        disabled={jobDetail.cover_letter?.status === 'generating'}
                        type="button"
                      >
                        Cover letter
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
                  {jobDetail.resume && jobDetail.resume.status !== 'none' && (
                    <ResumeOutputPanel
                      status={jobDetail.resume.status}
                      pdfUrl={jobDetail.resume.pdf_url}
                      startedAt={jobDetail.resume.started_at}
                      error={jobDetail.resume.error}
                      onRegenerate={runResume}
                    />
                  )}

                  {/* Output panel — cover letter */}
                  {jobDetail.cover_letter && jobDetail.cover_letter.status !== 'none' && (
                    <CoverLetterOutputPanel
                      status={jobDetail.cover_letter.status}
                      pdfUrl={jobDetail.cover_letter.pdf_url}
                      startedAt={jobDetail.cover_letter.started_at}
                      error={jobDetail.cover_letter.error}
                      onRegenerate={runCoverLetter}
                      onRevise={runCoverLetterRevise}
                    />
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
