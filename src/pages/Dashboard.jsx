import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import './Dashboard.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL

const TIME_FILTER_MS = {
  day: 24 * 60 * 60 * 1000,
  '3days': 3 * 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
}

function getTimeFilterField(bucket) {
  switch (bucket) {
    case 'applied': return 'status_changed_at'
    case 'archive': return 'archived_at'
    case 'analysed': return 'analysis_completed_at'
    case 'screened':
    default: return 'scrapedAt'
  }
}

function getJobTimeValue(job, bucket) {
  if (bucket === 'analysed') {
    return job.analysis_completed_at || job.status_changed_at
  }
  return job[getTimeFilterField(bucket)]
}

function getTimeFilterVerb(bucket) {
  switch (bucket) {
    case 'applied': return 'Updated'
    case 'archive': return 'Archived'
    case 'analysed': return 'Analysed'
    case 'screened':
    default: return 'Scraped'
  }
}

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

function relativeTime(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1mo ago' : `${months}mo ago`
}

function isAnalysing(job) {
  return ['summarising', 'researching', 'matching'].includes(job.analysis?.status)
}

function reasonLabel(reason, extras) {
  switch (reason) {
    case 'not_found': return 'Job not found'
    case 'in_progress': return `Already in progress (${extras?.current_status})`
    case 'already_complete': return 'Already analysed'
    case 'enqueue_failed': return 'Queue submission failed'
    case 'malformed_url': return 'Not a valid URL'
    case 'duplicate': return extras?.existing_job_id
      ? 'Already in your jobs list'
      : 'Duplicate URL'
    case 'nothing_to_retry': return 'Nothing to retry'
    case 'missing_url': return 'No URL on record'
    case 'delete_failed': return 'Could not delete record'
    default: return reason
  }
}

function canRetry(job) {
  if (!job) return false
  if (job.ingestion_status === 'failed') return false

  const hasScreening = !!job.screening
  const analysisStatus = job.analysis?.status

  if (!hasScreening) return true

  if (analysisStatus === undefined) return false
  if (analysisStatus === 'complete') return false

  return ['summarising', 'researching', 'matching', 'failed', 'pending'].includes(analysisStatus)
}

function ScoreBadge({ score, onLockClick, pending }) {
  if (pending) {
    return (
      <span className="db-pending-pill" title="Screening in progress">
        ••••
      </span>
    )
  }
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
  return <span className={`db-status-pill db-status-pill--${slug}`}>{status || '-'}</span>
}

function ResumeOutputPanel({ status, pdfUrl, startedAt, error, onRegenerate, onDownload, locked, onLockClick }) {
  const [elapsed, setElapsed] = useState(0)
  const [pendingRegen, setPendingRegen] = useState(false)

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

  useEffect(() => {
    if (status !== 'done') setPendingRegen(false)
  }, [status])

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

  if (status === 'done' && locked) {
    return (
      <div className="db-resume-panel">
        <div className="db-resume-panel__header">
          <span className="db-section-label db-section-label--inline">Tailored resume</span>
        </div>
        <div
          className="db-resume-panel__locked"
          onClick={onLockClick}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onLockClick()}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="3" y="6" width="8" height="7" rx="1.5" fill="currentColor" opacity=".4"/>
            <path d="M4.5 6V4a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none"/>
          </svg>
          <span>Unlock to view tailored resume</span>
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
            <button
              className="db-btn db-btn--secondary"
              type="button"
              onClick={() => { setPendingRegen(true); onRegenerate() }}
              disabled={pendingRegen}
            >
              {pendingRegen && <span className="db-spinner" aria-hidden="true" />}
              Regenerate
            </button>
            <button className="db-btn db-btn--accent" type="button" onClick={onDownload}>
              Download PDF
            </button>
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
          <button className="db-btn db-btn--accent" type="button" onClick={onRegenerate}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return null
}

function Modal({ title, onClose, buttons, children }) {
  const modalRef = useRef(null)

  useEffect(() => {
    function handleEsc(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  useEffect(() => {
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
  }, [])

  return (
    <div className="db-modal-scrim" onClick={onClose}>
      <div className="db-modal db-modal--wide" ref={modalRef} onClick={e => e.stopPropagation()}>
        <h2 className="db-modal__heading">{title}</h2>
        {children}
        <div className="db-modal__footer">
          {buttons.map((btn, i) => (
            <button
              key={i}
              className={`db-btn db-btn--${btn.variant}`}
              type="button"
              disabled={btn.disabled}
              onClick={btn.onClick}
              autoFocus={btn.autoFocus}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function RevisionFeedbackModal({ onClose, onSubmit }) {
  const [feedback, setFeedback] = useState('')

  return (
    <Modal
      title="Request revision"
      onClose={onClose}
      buttons={[
        { label: 'Cancel', variant: 'secondary', onClick: onClose },
        {
          label: 'Request revision',
          variant: 'accent',
          disabled: !feedback.trim(),
          onClick: () => { onSubmit(feedback); onClose() },
        },
      ]}
    >
      <textarea
        className="db-modal__textarea"
        autoFocus
        value={feedback}
        onChange={e => setFeedback(e.target.value)}
        placeholder="What would you like to change about this cover letter? Be specific about which paragraphs or what aspects need adjustment."
        rows={7}
      />
    </Modal>
  )
}

function LockConfirmModal({ onClose, onConfirm }) {
  return (
    <Modal
      title="Lock the dashboard?"
      onClose={onClose}
      buttons={[
        { label: 'Cancel', variant: 'secondary', onClick: onClose, autoFocus: true },
        { label: 'Lock', variant: 'accent', onClick: onConfirm },
      ]}
    >
      <p className="db-modal__sub">You'll need to enter your PIN to unlock again.</p>
    </Modal>
  )
}

function CoverLetterOutputPanel({ status, pdfUrl, startedAt, error, onRegenerate, onRevise, onDownload, locked, onLockClick }) {
  const [elapsed, setElapsed] = useState(0)
  const [revisionModalOpen, setRevisionModalOpen] = useState(false)
  const [pendingRegen, setPendingRegen] = useState(false)

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

  useEffect(() => {
    if (status !== 'done') setPendingRegen(false)
  }, [status])

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

  if (status === 'done' && locked) {
    return (
      <div className="db-resume-panel">
        <div className="db-resume-panel__header">
          <span className="db-section-label db-section-label--inline">Cover letter</span>
        </div>
        <div
          className="db-resume-panel__locked"
          onClick={onLockClick}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onLockClick()}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="3" y="6" width="8" height="7" rx="1.5" fill="currentColor" opacity=".4"/>
            <path d="M4.5 6V4a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none"/>
          </svg>
          <span>Unlock to view cover letter</span>
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
              <button
                className="db-btn db-btn--secondary"
                type="button"
                onClick={() => { setPendingRegen(true); onRegenerate() }}
                disabled={pendingRegen}
              >
                {pendingRegen && <span className="db-spinner" aria-hidden="true" />}
                Regenerate
              </button>
              <button className="db-btn db-btn--accent" type="button" onClick={onDownload}>
                Download PDF
              </button>
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
        {revisionModalOpen && (
          <RevisionFeedbackModal
            onClose={() => setRevisionModalOpen(false)}
            onSubmit={feedback => onRevise(feedback)}
          />
        )}
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
  const [lockModalOpen, setLockModalOpen] = useState(false)

  const [view, setView] = useState('list')
  const [selectedJobId, setSelectedJobId] = useState(null)

  const [bucketCache, setBucketCache] = useState({
    screened: null,
    analysed: null,
    applied: null,
    archive: null,
  })
  const [counts, setCounts] = useState({ screened: 0, analysed: 0, applied: 0, archive: 0 })
  const [activeBucket, setActiveBucket] = useState('screened')

  const [jobDetail, setJobDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  const [statusFilter, setStatusFilter] = useState('')
  const [timeFilter, setTimeFilter] = useState('')

  const [scrapeSource, setScrapeSource] = useState('indeed')
  const [indeedForm, setIndeedForm] = useState({ keywords: '', location: '', country: 'US', maxItems: 25 })
  const [linkedinForm, setLinkedinForm] = useState({ keywords: '', location: '', remote: '', posted_within: '', count: 50 })
  const [seekForm, setSeekForm] = useState({ keywords: '', location: '', remote: '', posted_within: '', count: 100, state: '', postCode: '', radius: '' })
  const [scrapeSuccess, setScrapeSuccess] = useState(false)
  const [scrapeLoading, setScrapeLoading] = useState(false)

  // Phase 9 state
  const [toast, setToast] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [dispatchInFlight, setDispatchInFlight] = useState(false)
  const [analysisStartedAt, setAnalysisStartedAt] = useState(null)
  const [analysisElapsed, setAnalysisElapsed] = useState(0)

  // Phase 10 state
  const [urlsText, setUrlsText] = useState('')
  const [urlSubmitLoading, setUrlSubmitLoading] = useState(false)
  const [failedIngestions, setFailedIngestions] = useState([])
  const [failedLoadError, setFailedLoadError] = useState(false)

  // Phase 11 state
  const [archiveInFlight, setArchiveInFlight] = useState(false)

  // Phase 12 state
  const [retryInFlight, setRetryInFlight] = useState(false)
  const [retryAllInFlight, setRetryAllInFlight] = useState(false)
  const [rowActionsInFlight, setRowActionsInFlight] = useState(new Set())

  const currentJobIdRef = useRef(null)
  const pollIntervalRef = useRef(null)
  const pollStartRef = useRef(null)
  const coverLetterPollStartRef = useRef(null)
  const analysisPollIntervalRef = useRef(null)
  const analysisPollStartRef = useRef(null)

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

  // Resume / cover-letter generation polling
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

  // Analysis polling
  useEffect(() => {
    const analysisStatus = jobDetail?.job?.analysis?.status
    const jobId = jobDetail?.job?.id
    const inFlight = ['summarising', 'researching', 'matching'].includes(analysisStatus)

    if (!inFlight || !jobId) {
      if (analysisPollIntervalRef.current) {
        clearInterval(analysisPollIntervalRef.current)
        analysisPollIntervalRef.current = null
      }
      analysisPollStartRef.current = null
      return
    }

    if (analysisPollIntervalRef.current) return

    analysisPollStartRef.current = Date.now()

    analysisPollIntervalRef.current = setInterval(async () => {
      const now = Date.now()

      if (analysisPollStartRef.current && now - analysisPollStartRef.current > 240_000) {
        analysisPollStartRef.current = null
        setJobDetail(prev => {
          if (!prev || prev.job.id !== jobId) return prev
          const s = prev.job.analysis?.status
          if (!['summarising', 'researching', 'matching'].includes(s)) return prev
          return {
            ...prev,
            job: {
              ...prev.job,
              analysis: {
                ...(prev.job.analysis || {}),
                status: 'failed',
                error: 'Analysis is taking longer than expected. Check back in a few minutes.',
              },
            },
          }
        })
        return
      }

      if (currentJobIdRef.current !== jobId) {
        clearInterval(analysisPollIntervalRef.current)
        analysisPollIntervalRef.current = null
        return
      }

      try {
        const res = await apiFetch(`/jobs/${jobId}`)
        if (res.status === 401) { handleUnauth(); return }
        const data = await res.json()
        if (currentJobIdRef.current !== jobId) return
        setJobDetail(prev => prev && prev.job.id === jobId ? data : prev)
        const newStatus = data.job?.analysis?.status
        if (!['summarising', 'researching', 'matching'].includes(newStatus)) {
          setAnalysisStartedAt(null)
        }
      } catch {
        // ignore transient network errors during polling
      }
    }, 3000)

    return () => {
      if (analysisPollIntervalRef.current) {
        clearInterval(analysisPollIntervalRef.current)
        analysisPollIntervalRef.current = null
      }
    }
  }, [jobDetail?.job?.analysis?.status, jobDetail?.job?.id, handleUnauth])

  // Analysis elapsed timer
  useEffect(() => {
    const analysisStatus = jobDetail?.job?.analysis?.status
    const inFlight = ['summarising', 'researching', 'matching'].includes(analysisStatus)

    if (!inFlight || !analysisStartedAt) {
      setAnalysisElapsed(0)
      return
    }

    setAnalysisElapsed(Math.floor((Date.now() - analysisStartedAt) / 1000))
    const interval = setInterval(() => {
      setAnalysisElapsed(Math.floor((Date.now() - analysisStartedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [jobDetail?.job?.analysis?.status, analysisStartedAt])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(id)
  }, [toast])

  // Clear selection on bucket switch
  useEffect(() => {
    setSelectedIds(new Set())
  }, [activeBucket])

  // Failed ingestions — load on mount and on urls tab switch
  useEffect(() => {
    reloadFailedIngestions()
  }, [])

  useEffect(() => {
    if (scrapeSource === 'urls') reloadFailedIngestions()
  }, [scrapeSource])

  function invalidateAllCaches() {
    setBucketCache({ screened: null, analysed: null, applied: null, archive: null })
    setSelectedIds(new Set())
  }

  const loadBucket = useCallback(async (bucket) => {
    setLoading(true)
    try {
      const res = await apiFetch(`/jobs?bucket=${bucket}`)
      if (res.status === 401) { handleUnauth(); return }
      const data = await res.json()
      setBucketCache(prev => ({ ...prev, [bucket]: data.jobs }))
      setCounts(data.counts)
    } finally {
      setLoading(false)
    }
  }, [handleUnauth])

  useEffect(() => {
    if (bucketCache[activeBucket] === null) {
      loadBucket(activeBucket)
    }
  }, [activeBucket, bucketCache, loadBucket])

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

  function handleLock() {
    clearSession()
    setLocked(true)
    setLockModalOpen(false)
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
      invalidateAllCaches()
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
    invalidateAllCaches()
    if (jobDetail?.job?.id === id) {
      setJobDetail(prev => ({ ...prev, job: { ...prev.job, status } }))
    }
  }

  function computeRestoreDestination(job) {
    const APPLIED_STATUSES = new Set(['applied', 'interviewing', 'offer', 'rejected'])
    if (APPLIED_STATUSES.has(job.status)) return 'Applied'
    if (job.analysis?.status === 'complete') return 'Analysed'
    return 'Screened'
  }

  async function archiveJob() {
    if (locked) { openModal(); return }
    setArchiveInFlight(true)

    try {
      const res = await apiFetch(`/jobs/${selectedJobId}/archive`, { method: 'POST' })
      if (res.status === 401) { handleUnauth(); openModal(); return }

      if (!res.ok) {
        showToast({ variant: 'error', message: 'Failed to archive. Try again.' })
        return
      }

      const now = new Date().toISOString()
      setJobDetail(prev => prev ? {
        ...prev,
        job: { ...prev.job, archived_at: now }
      } : prev)

      setBucketCache({ screened: null, analysed: null, applied: null, archive: null })
      showToast({ variant: 'accepted', message: 'Job archived' })
    } catch {
      showToast({ variant: 'error', message: 'Failed to archive. Try again.' })
    } finally {
      setArchiveInFlight(false)
    }
  }

  async function restoreJob() {
    if (locked) { openModal(); return }
    setArchiveInFlight(true)

    try {
      const res = await apiFetch(`/jobs/${selectedJobId}/restore`, { method: 'POST' })
      if (res.status === 401) { handleUnauth(); openModal(); return }

      if (!res.ok) {
        showToast({ variant: 'error', message: 'Failed to restore. Try again.' })
        return
      }

      setJobDetail(prev => prev ? {
        ...prev,
        job: { ...prev.job, archived_at: undefined }
      } : prev)

      const destination = computeRestoreDestination(jobDetail.job)
      showToast({ variant: 'accepted', message: `Job restored to ${destination} bucket` })

      setBucketCache({ screened: null, analysed: null, applied: null, archive: null })
    } catch {
      showToast({ variant: 'error', message: 'Failed to restore. Try again.' })
    } finally {
      setArchiveInFlight(false)
    }
  }

  async function retryJob() {
    if (locked) { openModal(); return }
    setRetryInFlight(true)

    try {
      const res = await apiFetch('/jobs/retry', {
        method: 'POST',
        body: JSON.stringify({ ids: [selectedJobId] }),
      })
      if (res.status === 401) { handleUnauth(); openModal(); return }

      const data = await res.json()

      if (data.rejected?.length > 0) {
        showToast({
          variant: 'mixed',
          accepted: 0,
          rejected: data.rejected,
          itemKind: 'retry',
        })
        return
      }

      showToast({ variant: 'accepted', message: 'Retry queued' })
      loadJobDetail(selectedJobId)
      setBucketCache({ screened: null, analysed: null, applied: null, archive: null })
    } catch (e) {
      showToast({ variant: 'error', message: 'Failed to retry. Try again.' })
    } finally {
      setRetryInFlight(false)
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

  async function downloadPdf(jobId, type) {
    const res = await apiFetch(`/jobs/${jobId}/${type}/download`)
    if (res.status === 401) { handleUnauth(); openModal(); return }
    const { url } = await res.json()
    window.location.href = url
  }

  async function runFullAnalysis() {
    if (locked) { openModal(); return }

    setAnalysisStartedAt(Date.now())
    setJobDetail(prev => prev ? {
      ...prev,
      job: {
        ...prev.job,
        analysis: { ...(prev.job.analysis || {}), status: 'summarising' },
      },
    } : prev)

    // Mirror the bucket movement that dispatchBatch does, so if the user
    // navigates back to the list the job is already in the right bucket.
    const movedJobId = selectedJobId
    const wasInScreened = (bucketCache.screened || []).some(j => j.id === movedJobId)
    setBucketCache(prev => {
      const screenedNow = prev.screened || []
      const moving = screenedNow.find(j => j.id === movedJobId)
      if (!moving) return prev
      const movedJob = { ...moving, analysis: { ...(moving.analysis || {}), status: 'summarising' } }
      return {
        ...prev,
        screened: screenedNow.filter(j => j.id !== movedJobId),
        analysed: prev.analysed ? [movedJob, ...prev.analysed] : prev.analysed,
      }
    })
    if (wasInScreened) {
      setCounts(prev => ({
        ...prev,
        screened: Math.max(0, prev.screened - 1),
        analysed: prev.analysed + 1,
      }))
    }

    try {
      const res = await apiFetch('/jobs/full-analysis', {
        method: 'POST',
        body: JSON.stringify({ ids: [selectedJobId] }),
      })
      if (res.status === 401) { handleUnauth(); openModal(); return }

      const data = await res.json()

      if (data.rejected && data.rejected.length > 0) {
        const reason = data.rejected[0].reason
        setJobDetail(prev => prev ? {
          ...prev,
          job: {
            ...prev.job,
            analysis: prev.job.analysis?.status === 'summarising' && !prev.job.analysis.summary
              ? null
              : prev.job.analysis,
          },
        } : prev)
        setAnalysisStartedAt(null)
        showToast({ variant: 'mixed', accepted: 0, rejected: [{ id: selectedJobId, reason }] })
      }
      // If accepted: polling picks up real status on next interval
    } catch {
      setJobDetail(prev => prev ? {
        ...prev,
        job: {
          ...prev.job,
          analysis: prev.job.analysis?.status === 'summarising' && !prev.job.analysis.summary
            ? null
            : prev.job.analysis,
        },
      } : prev)
      setAnalysisStartedAt(null)
      showToast({ variant: 'error', message: 'Failed to start analysis. Try again.' })
    }
  }

  async function dispatchBatch() {
    if (locked) { openModal(); return }
    setDispatchInFlight(true)

    const ids = Array.from(selectedIds)

    try {
      const res = await apiFetch('/jobs/full-analysis', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      })
      if (res.status === 401) { handleUnauth(); openModal(); return }

      const data = await res.json()

      showToast({
        variant: data.rejected?.length ? 'mixed' : 'accepted',
        accepted: data.accepted?.length || 0,
        rejected: data.rejected || [],
      })

      // Move accepted jobs from Screened to Analysed in the local caches so the
      // user sees them transition immediately, without waiting for a refresh.
      const acceptedIds = new Set(data.accepted || [])
      setBucketCache(prev => {
        const screenedNow = prev.screened || []
        const movingJobs = screenedNow
          .filter(j => acceptedIds.has(j.id))
          .map(j => ({ ...j, analysis: { ...(j.analysis || {}), status: 'summarising' } }))
        return {
          ...prev,
          screened: screenedNow.filter(j => !acceptedIds.has(j.id)),
          analysed: prev.analysed ? [...movingJobs, ...prev.analysed] : prev.analysed,
        }
      })
      setCounts(prev => ({
        ...prev,
        screened: Math.max(0, prev.screened - acceptedIds.size),
        analysed: prev.analysed + acceptedIds.size,
      }))

      setSelectedIds(new Set())
    } catch {
      showToast({ variant: 'error', message: 'Failed to dispatch batch. Try again.' })
    } finally {
      setDispatchInFlight(false)
    }
  }

  function showToast(t) {
    setToast(t)
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const selectableJobs = filteredJobs.filter(j => !isAnalysing(j))
    const allSelected = selectableJobs.length > 0 && selectedIds.size === selectableJobs.length
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectableJobs.map(j => j.id)))
    }
  }

  function switchSource(newSource) {
    if (newSource === scrapeSource) return
    if (scrapeSource !== 'urls' && newSource !== 'urls') {
      const FORMS = { indeed: [indeedForm, setIndeedForm], linkedin: [linkedinForm, setLinkedinForm], seek: [seekForm, setSeekForm] }
      const [currentForm] = FORMS[scrapeSource]
      const [, setNewForm] = FORMS[newSource]
      setNewForm(prev => ({
        ...prev,
        keywords: currentForm.keywords,
        location: currentForm.location,
      }))
    }
    setScrapeSuccess(false)
    setScrapeSource(newSource)
  }

  async function reloadFailedIngestions() {
    setFailedLoadError(false)
    try {
      const res = await apiFetch('/jobs/failed-ingestions')
      if (res.status === 401) { handleUnauth(); return }
      if (!res.ok) {
        setFailedIngestions([])
        setFailedLoadError(true)
        return
      }
      const data = await res.json()
      setFailedIngestions(Array.isArray(data) ? data : [])
    } catch (e) {
      setFailedIngestions([])
      setFailedLoadError(true)
    }
  }

  async function retryAllFailed() {
    if (locked) { openModal(); return }
    if (failedIngestions.length === 0) return

    setRetryAllInFlight(true)
    const ids = failedIngestions.map(item => item.id)

    try {
      const res = await apiFetch('/jobs/retry', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      })
      if (res.status === 401) { handleUnauth(); openModal(); return }

      const data = await res.json()

      showToast({
        variant: data.rejected?.length ? 'mixed' : 'accepted',
        accepted: data.accepted?.length || 0,
        rejected: data.rejected || [],
        itemKind: 'retry',
      })

      reloadFailedIngestions()
    } catch (e) {
      showToast({ variant: 'error', message: 'Failed to retry. Try again.' })
    } finally {
      setRetryAllInFlight(false)
    }
  }

  async function retrySingle(id) {
    if (locked) { openModal(); return }

    setRowActionsInFlight(prev => new Set(prev).add(id))

    try {
      const res = await apiFetch('/jobs/retry', {
        method: 'POST',
        body: JSON.stringify({ ids: [id] }),
      })
      if (res.status === 401) { handleUnauth(); openModal(); return }

      const data = await res.json()

      if (data.rejected?.length > 0) {
        showToast({
          variant: 'mixed',
          accepted: 0,
          rejected: data.rejected,
          itemKind: 'retry',
        })
      } else {
        showToast({ variant: 'accepted', message: 'Retry queued' })
      }

      reloadFailedIngestions()
    } catch (e) {
      showToast({ variant: 'error', message: 'Failed to retry. Try again.' })
    } finally {
      setRowActionsInFlight(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function dismissSingle(id) {
    if (locked) { openModal(); return }

    setRowActionsInFlight(prev => new Set(prev).add(id))

    try {
      const res = await apiFetch(`/jobs/${id}`, { method: 'DELETE' })
      if (res.status === 401) { handleUnauth(); openModal(); return }

      if (!res.ok) {
        showToast({ variant: 'error', message: 'Failed to dismiss. Try again.' })
        return
      }

      showToast({ variant: 'accepted', message: 'Dismissed' })
      reloadFailedIngestions()
    } catch (e) {
      showToast({ variant: 'error', message: 'Failed to dismiss. Try again.' })
    } finally {
      setRowActionsInFlight(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function submitUrls() {
    if (locked) { openModal(); return }

    const urls = urlsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)

    if (urls.length === 0) return

    setUrlSubmitLoading(true)

    try {
      const res = await apiFetch('/jobs/from-url', {
        method: 'POST',
        body: JSON.stringify({ urls }),
      })
      if (res.status === 401) { handleUnauth(); openModal(); return }

      const data = await res.json()

      showToast({
        variant: data.rejected?.length ? 'mixed' : 'accepted',
        accepted: data.accepted?.length || 0,
        rejected: (data.rejected || []).map(r => ({
          id: r.url,
          reason: r.reason,
          existing_job_id: r.existing_job_id,
        })),
        itemKind: 'url',
      })

      setUrlsText('')
      reloadFailedIngestions()
    } catch (e) {
      showToast({ variant: 'error', message: 'Failed to submit URLs. Try again.' })
    } finally {
      setUrlSubmitLoading(false)
    }
  }

  async function submitScrape(e) {
    e.preventDefault()
    if (locked) { openModal(); return }
    setScrapeLoading(true)
    try {
      if (scrapeSource === 'indeed') {
        await apiFetch('/scrape/indeed', {
          method: 'POST',
          body: JSON.stringify({
            position: indeedForm.keywords,
            ...(indeedForm.location ? { location: indeedForm.location } : {}),
            ...(indeedForm.country ? { country: indeedForm.country } : {}),
            ...(indeedForm.maxItems ? { maxItemsPerSearch: indeedForm.maxItems } : {}),
          }),
        })
      } else if (scrapeSource === 'linkedin') {
        await apiFetch('/scrape/linkedin', {
          method: 'POST',
          body: JSON.stringify({
            keywords: linkedinForm.keywords,
            location: linkedinForm.location,
            ...(linkedinForm.remote ? { remote: linkedinForm.remote } : {}),
            ...(linkedinForm.posted_within ? { posted_within: linkedinForm.posted_within } : {}),
            ...(linkedinForm.count ? { count: linkedinForm.count } : {}),
          }),
        })
      } else {
        await apiFetch('/scrape/seek', {
          method: 'POST',
          body: JSON.stringify({
            keywords: seekForm.keywords,
            location: seekForm.location,
            ...(seekForm.remote ? { remote: seekForm.remote } : {}),
            ...(seekForm.posted_within ? { posted_within: seekForm.posted_within } : {}),
            ...(seekForm.count ? { count: seekForm.count } : {}),
            ...(seekForm.state ? { state: seekForm.state } : {}),
            ...(seekForm.postCode ? { postCode: seekForm.postCode } : {}),
            ...(seekForm.radius ? { radius: seekForm.radius } : {}),
          }),
        })
      }
      setScrapeSuccess(true)
    } finally {
      setScrapeLoading(false)
    }
  }

  const urlsCount = urlsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .length

  const currentBucketJobs = bucketCache[activeBucket] || []
  let displayJobs = currentBucketJobs.filter(j => {
    if (statusFilter && j.status !== statusFilter) return false
    if (timeFilter) {
      const cutoff = Date.now() - TIME_FILTER_MS[timeFilter]
      const value = getJobTimeValue(j, activeBucket)
      if (!value || new Date(value).getTime() < cutoff) return false
    }
    return true
  })
  const filteredJobs = displayJobs

  const sortedJobs = (() => {
    if (activeBucket === 'archive') {
      return [...filteredJobs].sort((a, b) =>
        (b.archived_at || '').localeCompare(a.archived_at || '')
      )
    }
    if (activeBucket === 'applied') {
      return [...filteredJobs].sort((a, b) =>
        (b.status_changed_at || '').localeCompare(a.status_changed_at || '')
      )
    }
    if (activeBucket === 'analysed') {
      // Two visual groups: in-flight at top (most recently started first),
      // then complete/failed below sorted by match_score descending.
      const inFlight = filteredJobs.filter(j => isAnalysing(j))
      const settled = filteredJobs.filter(j => !isAnalysing(j))
      inFlight.sort((a, b) =>
        (b.status_changed_at || b.scrapedAt || '').localeCompare(
          a.status_changed_at || a.scrapedAt || ''
        )
      )
      settled.sort((a, b) =>
        (b.analysis?.match_score || 0) - (a.analysis?.match_score || 0)
      )
      return [...inFlight, ...settled]
    }
    return [...filteredJobs].sort((a, b) =>
      (b.screening?.recommendation_score || 0) - (a.screening?.recommendation_score || 0)
    )
  })()

  // Derived selection state (screened only)
  const selectableJobs = activeBucket === 'screened' ? filteredJobs.filter(j => !isAnalysing(j)) : []
  const allSelectableSelected = selectableJobs.length > 0 && selectedIds.size === selectableJobs.length
  const someButNotAllSelected = selectedIds.size > 0 && !allSelectableSelected

  const detailTitle = jobDetail?.job?.positionName
    ? jobDetail.job.positionName.length > 32
      ? jobDetail.job.positionName.slice(0, 32) + '…'
      : jobDetail.job.positionName
    : '…'

  function reqText(req) {
    if (typeof req === 'string') return req
    return req.requirement || req.skill || req.text || ''
  }

  function FailedIngestionsPanel() {
    if (failedIngestions.length === 0) return null

    return (
      <div className="db-failed-ingestions">
        <div className="db-failed-ingestions__header">
          <span className="db-section-label">
            Failed ingestions ({failedIngestions.length})
          </span>
          <button
            className={locked ? 'db-btn db-btn--locked' : 'db-btn db-btn--secondary'}
            onClick={locked ? undefined : retryAllFailed}
            disabled={retryAllInFlight}
            type="button"
          >
            {retryAllInFlight && <span className="db-spinner" aria-hidden="true" />}
            Retry all
          </button>
        </div>
        <ul className="db-failed-ingestions__list">
          {failedIngestions.map(item => (
            <li key={item.id} className="db-failed-ingestions__item">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="db-failed-ingestions__url"
              >
                {item.url}
              </a>
              <span className="db-failed-ingestions__error">
                {item.ingestion_error || 'Unknown error'}
              </span>
              <span className="db-failed-ingestions__date">
                {item.scrapedAt?.slice(0, 10)}
              </span>
              <div className="db-failed-ingestions__actions">
                <button
                  className={locked ? 'db-btn db-btn--locked' : 'db-btn db-btn--secondary'}
                  onClick={locked ? undefined : () => retrySingle(item.id)}
                  disabled={rowActionsInFlight.has(item.id)}
                  type="button"
                >
                  Retry
                </button>
                <button
                  className={locked ? 'db-btn db-btn--locked' : 'db-btn db-btn--secondary'}
                  onClick={locked ? undefined : () => dismissSingle(item.id)}
                  disabled={rowActionsInFlight.has(item.id)}
                  type="button"
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const PinPill = locked ? (
    <button
      className="db-pin-pill db-pin-pill--locked"
      onClick={openModal}
      aria-label="Locked. Click to unlock"
      type="button"
    >
      <span className="db-pin-pill__dot" />
    </button>
  ) : (
    <button
      className="db-btn db-btn--secondary db-lock-btn"
      onClick={() => setLockModalOpen(true)}
      type="button"
    >
      Lock
    </button>
  )

  // Analysis state for detail page
  const analysisStatus = jobDetail?.job?.analysis?.status
  const analysisInFlight = ['summarising', 'researching', 'matching'].includes(analysisStatus)
  const showFullAnalysisButton = !analysisStatus || analysisStatus === 'pending' || analysisStatus === 'failed'
  const analysisIncomplete = analysisStatus !== 'complete'

  return (
    <div className="dashboard" data-theme="dark">
      {navSlot && createPortal(PinPill, navSlot)}

      {/* Toast */}
      {toast && (
        <div className={`db-toast db-toast--${toast.variant}`} role="alert">
          <button
            className="db-toast__dismiss"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
          >×</button>
          {toast.variant === 'accepted' && (
            <p className="db-toast__message">
              {toast.message ||
                (toast.itemKind === 'url'
                  ? `${toast.accepted} URL${toast.accepted === 1 ? '' : 's'} submitted for ingestion`
                  : toast.itemKind === 'retry'
                    ? `${toast.accepted} ${toast.accepted === 1 ? 'job' : 'jobs'} queued for retry`
                    : `${toast.accepted} ${toast.accepted === 1 ? 'job' : 'jobs'} queued for analysis`
                )
              }
            </p>
          )}
          {toast.variant === 'mixed' && (
            <>
              <p className="db-toast__message">
                {toast.accepted} queued · {toast.rejected.length} rejected
              </p>
              <ul className="db-toast__details">
                {toast.rejected.map((r, i) => (
                  <li key={i}>
                    {toast.itemKind === 'url' && <code className="db-toast__url">{r.id}</code>}
                    {reasonLabel(r.reason, r)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {toast.variant === 'error' && (
            <p className="db-toast__message">{toast.message}</p>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="db-modal-scrim" onClick={closeModal}>
          <div className="db-modal" onClick={e => e.stopPropagation()}>
            <h2 className="db-modal__heading">Enter PIN</h2>
            <p className="db-modal__sub">
              Unlock to run AI actions: scraping, resume tailoring, and cover letter generation.
            </p>
            {pinError && <p className="db-modal__error">{pinError}</p>}
            <form onSubmit={submitPin}>
              <input
                className="db-modal__input"
                type="password"
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                autoFocus
                placeholder="Enter PIN to unlock"
              />
              <button className="db-modal__submit" type="submit" disabled={pinLoading}>
                {pinLoading ? 'Checking…' : 'Unlock'}
              </button>
            </form>
            <button className="db-modal__cancel" type="button" onClick={closeModal}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {lockModalOpen && (
        <LockConfirmModal
          onClose={() => setLockModalOpen(false)}
          onConfirm={handleLock}
        />
      )}

      <div className="dashboard__inner">

        {/* ── LIST VIEW ─────────────────────────────────── */}
        {view === 'list' && (
          <>
            <nav className="db-breadcrumb" aria-label="Breadcrumb">
              <Link to="/projects" className="db-breadcrumb__link">Projects</Link>
              <span className="db-breadcrumb__sep">/</span>
              <Link to="/projects/job-hunt" className="db-breadcrumb__link">Job hunt</Link>
              <span className="db-breadcrumb__sep">/</span>
              <span className="db-breadcrumb__item">Dashboard</span>
            </nav>

            <div className="db-toolbar">
              <div className="db-toolbar__left">
                <div className="db-bucket-tabs">
                  <button
                    type="button"
                    className={`db-bucket-tab${activeBucket === 'screened' ? ' db-bucket-tab--active' : ''}`}
                    onClick={() => setActiveBucket('screened')}
                  >
                    Screened
                    <span className="db-bucket-tab__count">{counts.screened}</span>
                  </button>
                  <button
                    type="button"
                    className={`db-bucket-tab${activeBucket === 'analysed' ? ' db-bucket-tab--active' : ''}`}
                    onClick={() => setActiveBucket('analysed')}
                  >
                    Analysed
                    <span className="db-bucket-tab__count">{counts.analysed}</span>
                  </button>
                  <button
                    type="button"
                    className={`db-bucket-tab${activeBucket === 'applied' ? ' db-bucket-tab--active' : ''}`}
                    onClick={() => setActiveBucket('applied')}
                  >
                    Applied
                    <span className="db-bucket-tab__count">{counts.applied}</span>
                  </button>

                  <span className="db-bucket-tabs__separator" aria-hidden="true" />

                  <button
                    type="button"
                    className={`db-bucket-tab${activeBucket === 'archive' ? ' db-bucket-tab--active' : ''}`}
                    onClick={() => setActiveBucket('archive')}
                  >
                    Archive
                    <span className="db-bucket-tab__count">{counts.archive}</span>
                  </button>
                </div>
              </div>
              <div className="db-toolbar__right">
                <select
                  className="db-filter-select"
                  value={timeFilter}
                  onChange={e => setTimeFilter(e.target.value)}
                >
                  <option value="">All time</option>
                  <option value="day">{getTimeFilterVerb(activeBucket)}: past day</option>
                  <option value="3days">{getTimeFilterVerb(activeBucket)}: past 3 days</option>
                  <option value="week">{getTimeFilterVerb(activeBucket)}: past week</option>
                  <option value="month">{getTimeFilterVerb(activeBucket)}: past month</option>
                </select>
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
                </select>
                <button
                  className="db-btn db-btn--secondary"
                  onClick={invalidateAllCaches}
                  disabled={loading}
                >
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

            {/* Batch dispatch toolbar — screened bucket, selection non-empty */}
            {activeBucket === 'screened' && selectedIds.size > 0 && (
              <div className="db-dispatch-toolbar">
                <span className="db-dispatch-toolbar__count">
                  {selectedIds.size} selected
                </span>
                <button
                  className="db-btn db-btn--accent"
                  onClick={dispatchBatch}
                  disabled={dispatchInFlight}
                  type="button"
                >
                  {dispatchInFlight && <span className="db-spinner" aria-hidden="true" />}
                  Analyse {selectedIds.size} selected
                </button>
                <button
                  className="db-btn db-btn--secondary"
                  onClick={() => setSelectedIds(new Set())}
                  type="button"
                >
                  Clear
                </button>
              </div>
            )}

            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    {activeBucket === 'screened' && (
                      <>
                        <th className="db-checkbox-cell" style={{ width: '4%' }}>
                          <input
                            type="checkbox"
                            checked={allSelectableSelected}
                            ref={el => { if (el) el.indeterminate = someButNotAllSelected }}
                            onChange={toggleSelectAll}
                            aria-label="Select all"
                          />
                        </th>
                        <th style={{ width: '26%' }}>Position</th>
                        <th style={{ width: '18%' }}>Company</th>
                        <th style={{ width: '17%' }}>Location</th>
                        <th style={{ width: '10%' }}>Match</th>
                        <th style={{ width: '10%' }}>Rec</th>
                        <th style={{ width: '15%' }}>Scraped</th>
                      </>
                    )}
                    {activeBucket === 'analysed' && (
                      <>
                        <th style={{ width: '30%' }}>Position</th>
                        <th style={{ width: '20%' }}>Company</th>
                        <th style={{ width: '18%' }}>Location</th>
                        <th style={{ width: '10%' }}>Match</th>
                        <th style={{ width: '10%' }}>Fit</th>
                        <th style={{ width: '12%' }}>Analysed</th>
                      </>
                    )}
                    {activeBucket === 'applied' && (
                      <>
                        <th style={{ width: '35%' }}>Position</th>
                        <th style={{ width: '25%' }}>Company</th>
                        <th style={{ width: '18%' }}>Status</th>
                        <th style={{ width: '22%' }}>Last update</th>
                      </>
                    )}
                    {activeBucket === 'archive' && (
                      <>
                        <th style={{ width: '40%' }}>Position</th>
                        <th style={{ width: '28%' }}>Company</th>
                        <th style={{ width: '16%' }}>Status</th>
                        <th style={{ width: '16%' }}>Archived</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedJobs.map(job => (
                    <tr
                      key={job.id}
                      className="db-table__row"
                      onClick={() => openDetail(job.id)}
                    >
                      {activeBucket === 'screened' && (
                        <td className="db-checkbox-cell">
                          {isAnalysing(job) ? (
                            <span className="db-spinner db-spinner--row" aria-label="Analysing" />
                          ) : (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(job.id)}
                              onChange={() => toggleSelect(job.id)}
                              onClick={e => e.stopPropagation()}
                              aria-label={`Select ${job.positionName}`}
                            />
                          )}
                        </td>
                      )}
                      <td className="db-table__position">{job.positionName}</td>
                      <td>{job.canonical_name || job.company}</td>
                      {activeBucket !== 'applied' && activeBucket !== 'archive' && (
                        <td className="db-table__muted">{job.location}</td>
                      )}
                      {activeBucket === 'screened' && (
                        <>
                          <td>
                            <ScoreBadge
                              score={job.screening?.match_score ?? null}
                              pending={!job.screening}
                              onLockClick={openModal}
                            />
                          </td>
                          <td>
                            <ScoreBadge
                              score={job.screening?.recommendation_score ?? null}
                              pending={!job.screening}
                              onLockClick={openModal}
                            />
                          </td>
                          <td className="db-table__muted db-table__mono">
                            {job.scrapedAt?.slice(0, 10)}
                          </td>
                        </>
                      )}
                      {activeBucket === 'analysed' && (
                        <>
                          <td>
                            {isAnalysing(job) ? (
                              <span
                                className="db-spinner db-spinner--row"
                                title={`Analysis in progress: ${job.analysis?.status}`}
                                aria-label={`Analysing: ${job.analysis?.status}`}
                              />
                            ) : job.analysis?.status === 'failed' ? (
                              <span
                                className="db-status-pill db-status-pill--rejected"
                                title={job.analysis?.error || 'Analysis failed'}
                              >
                                failed
                              </span>
                            ) : (
                              <ScoreBadge
                                score={job.analysis?.match_score ?? null}
                                onLockClick={openModal}
                              />
                            )}
                          </td>
                          <td>
                            {isAnalysing(job) || job.analysis?.status === 'failed' ? (
                              <span className="db-table__muted">—</span>
                            ) : (
                              <ScoreBadge
                                score={job.candidate_fit_score ?? null}
                                onLockClick={openModal}
                              />
                            )}
                          </td>
                          <td className="db-table__muted db-table__mono">
                            {isAnalysing(job)
                              ? `${job.analysis?.status}…`
                              : relativeTime(job.analysis_completed_at || job.status_changed_at)
                            }
                          </td>
                        </>
                      )}
                      {activeBucket === 'applied' && (
                        <>
                          <td><StatusPill status={job.status} /></td>
                          <td className="db-table__muted db-table__mono">
                            {job.status_changed_at?.slice(0, 10)}
                          </td>
                        </>
                      )}
                      {activeBucket === 'archive' && (
                        <>
                          <td><StatusPill status={job.status} /></td>
                          <td className="db-table__muted db-table__mono">
                            {job.archived_at?.slice(0, 10)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {!loading && sortedJobs.length === 0 && (
                    <tr>
                      <td
                        colSpan={
                          activeBucket === 'applied' ? 4
                          : activeBucket === 'archive' ? 4
                          : activeBucket === 'screened' ? 7
                          : 6
                        }
                        className="db-table__empty"
                      >
                        No jobs found
                      </td>
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
                      <span className="db-detail-company">
                        {' '}@ {jobDetail.job.canonical_name || jobDetail.job.company}
                      </span>
                    </h1>
                    <div className="db-meta-row">
                      {jobDetail.job.location && (
                        <span className="db-tag">{jobDetail.job.location}</span>
                      )}
                      <ScoreBadge
                        score={jobDetail.job.analysis?.match_score ?? null}
                        onLockClick={openModal}
                      />
                    </div>

                    {/* Analysis progress / failure / result / locked placeholder */}
                    {analysisInFlight ? (
                      <div className="db-analysis-progress">
                        <span className="db-section-label">Analysis in progress</span>
                        <div className="db-analysis-progress__row">
                          <span className="db-spinner" aria-hidden="true" />
                          <span className="db-analysis-progress__text">
                            {analysisStatus === 'summarising' && 'Summarising job description...'}
                            {analysisStatus === 'researching' && 'Researching company...'}
                            {analysisStatus === 'matching' && 'Matching against your CV...'}
                            {analysisStartedAt != null && ` ${analysisElapsed}s`}
                          </span>
                        </div>
                      </div>
                    ) : analysisStatus === 'failed' ? (
                      <div className="db-analysis-failed">
                        <span className="db-analysis-failed__text">
                          Analysis failed{jobDetail.job.analysis?.error ? `: ${jobDetail.job.analysis.error}` : ''}
                        </span>
                        <button
                          className="db-btn db-btn--secondary"
                          type="button"
                          onClick={runFullAnalysis}
                          style={{ alignSelf: 'flex-start' }}
                        >
                          Retry
                        </button>
                      </div>
                    ) : jobDetail.job.analysis?.match_reasoning ? (
                      <p className="db-match-summary">{jobDetail.job.analysis.match_reasoning}</p>
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
                        </select>
                      )}
                    </div>

                    <div className="db-actions">
                      {jobDetail.job.url && (
                        <a
                          className="db-btn db-btn--accent"
                          href={jobDetail.job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View listing ↗
                        </a>
                      )}
                      {showFullAnalysisButton && (
                        <button
                          className={locked ? 'db-btn db-btn--locked' : 'db-btn db-btn--secondary'}
                          onClick={locked ? undefined : runFullAnalysis}
                          disabled={locked}
                          type="button"
                        >
                          Run full analysis
                        </button>
                      )}
                      {canRetry(jobDetail.job) && (
                        <button
                          className={locked ? 'db-btn db-btn--locked' : 'db-btn db-btn--secondary'}
                          onClick={locked ? undefined : retryJob}
                          disabled={retryInFlight}
                          type="button"
                        >
                          {retryInFlight && <span className="db-spinner" aria-hidden="true" />}
                          Retry
                        </button>
                      )}
                      <button
                        className={locked ? 'db-btn db-btn--locked' : 'db-btn db-btn--secondary'}
                        onClick={locked ? undefined : runResume}
                        disabled={locked || jobDetail.resume?.status === 'generating' || analysisIncomplete}
                        title={!locked && analysisIncomplete ? 'Run full analysis first' : undefined}
                        type="button"
                      >
                        {!locked && jobDetail.resume?.status === 'generating' && <span className="db-spinner" aria-hidden="true" />}
                        Tailor resume
                      </button>
                      <button
                        className={locked ? 'db-btn db-btn--locked' : 'db-btn db-btn--secondary'}
                        onClick={locked ? undefined : runCoverLetter}
                        disabled={locked || jobDetail.cover_letter?.status === 'generating' || analysisIncomplete}
                        title={!locked && analysisIncomplete ? 'Run full analysis first' : undefined}
                        type="button"
                      >
                        {!locked && jobDetail.cover_letter?.status === 'generating' && <span className="db-spinner" aria-hidden="true" />}
                        Cover letter
                      </button>
                      <button
                        className={locked ? 'db-btn db-btn--locked' : 'db-btn db-btn--secondary'}
                        onClick={locked ? undefined : (jobDetail.job.archived_at ? restoreJob : archiveJob)}
                        type="button"
                        disabled={archiveInFlight}
                      >
                        {archiveInFlight && <span className="db-spinner" aria-hidden="true" />}
                        {jobDetail.job.archived_at ? 'Restore' : 'Archive'}
                      </button>
                    </div>
                  </div>

                  {/* Screening card */}
                  {jobDetail.job.screening && (
                    <div className="db-card">
                      <span className="db-section-label">Screening</span>
                      {locked ? (
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
                          <span className="db-locked-row__label">Screening analysis hidden</span>
                          <span className="db-locked-row__action">Unlock to view →</span>
                        </div>
                      ) : (
                        <>
                          <div className="db-screening-score-row">
                            <ScoreBadge
                              score={jobDetail.job.screening.match_score ?? null}
                              onLockClick={openModal}
                            />
                            <span className="db-screening-sublabel">Match</span>
                          </div>
                          {jobDetail.job.screening.match_reasoning && (
                            <p className="db-match-summary">{jobDetail.job.screening.match_reasoning}</p>
                          )}
                          <div className="db-screening-score-row">
                            <ScoreBadge
                              score={jobDetail.job.screening.recommendation_score ?? null}
                              onLockClick={openModal}
                            />
                            <span className="db-screening-sublabel">Recommendation</span>
                          </div>
                          {jobDetail.job.screening.recommendation_reasoning && (
                            <p className="db-match-summary">{jobDetail.job.screening.recommendation_reasoning}</p>
                          )}
                          {jobDetail.job.screening.divergence_reasoning && (
                            <>
                              <span className="db-section-label db-section-label--subsection">Divergence</span>
                              <p className="db-match-summary">{jobDetail.job.screening.divergence_reasoning}</p>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Job summary card */}
                  {jobDetail.job.analysis?.summary && (
                    <div className="db-card">
                      <span className="db-section-label">Job summary</span>

                      {jobDetail.job.analysis.summary.job_summary && (
                        <p className="db-summary-text">{jobDetail.job.analysis.summary.job_summary}</p>
                      )}

                      {jobDetail.job.analysis.summary.experience_requirements?.length > 0 && (
                        <div className="db-req-section">
                          <span className="db-section-label">Experience</span>
                          <ul className="db-req-list">
                            {jobDetail.job.analysis.summary.experience_requirements.map((req, i) => (
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

                      {jobDetail.job.analysis.summary.skill_requirements?.length > 0 && (
                        <div className="db-req-section">
                          <span className="db-section-label">Skills</span>
                          <ul className="db-req-list">
                            {jobDetail.job.analysis.summary.skill_requirements.map((req, i) => (
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

                      {jobDetail.job.analysis.summary.red_flags &&
                        jobDetail.job.analysis.summary.red_flags !== 'none identified' && (
                          <p className="db-red-flags">⚠ {jobDetail.job.analysis.summary.red_flags}</p>
                        )}
                    </div>
                  )}

                  {/* Output panel — resume */}
                  {jobDetail.resume && jobDetail.resume.status !== 'none' && (
                    <ResumeOutputPanel
                      locked={locked}
                      onLockClick={openModal}
                      status={jobDetail.resume.status}
                      pdfUrl={jobDetail.resume.pdf_url}
                      startedAt={jobDetail.resume.started_at}
                      error={jobDetail.resume.error}
                      onRegenerate={runResume}
                      onDownload={() => downloadPdf(selectedJobId, 'resume')}
                    />
                  )}

                  {/* Output panel — cover letter */}
                  {jobDetail.cover_letter && jobDetail.cover_letter.status !== 'none' && (
                    <CoverLetterOutputPanel
                      locked={locked}
                      onLockClick={openModal}
                      status={jobDetail.cover_letter.status}
                      pdfUrl={jobDetail.cover_letter.pdf_url}
                      startedAt={jobDetail.cover_letter.started_at}
                      error={jobDetail.cover_letter.error}
                      onRegenerate={runCoverLetter}
                      onRevise={runCoverLetterRevise}
                      onDownload={() => downloadPdf(selectedJobId, 'cover-letter')}
                    />
                  )}
                </div>

                {/* Sidebar */}
                <aside className="db-sidebar">
                  <div className="db-card">
                    <span className="db-section-label">Company</span>

                    {locked ? (
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
                        <span>Unlock to view company information</span>
                      </div>
                    ) : (
                      <>
                        {jobDetail.company?.candidate_fit_score != null ? (
                          <div className="db-fit-block">
                            <span className="db-fit-score">{jobDetail.company.candidate_fit_score}</span>
                            <span className="db-fit-label">Candidate fit</span>
                            {jobDetail.company.candidate_fit_reasoning && (
                              <p className="db-fit-reasoning">{jobDetail.company.candidate_fit_reasoning}</p>
                            )}
                          </div>
                        ) : (
                          <div className="db-fit-block">
                            <span className="db-fit-label">Candidate fit</span>
                            <p className="db-fit-reasoning db-fit-reasoning--na">Not available</p>
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
                      </>
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
                <div className="db-source-tabs">
                  <button
                    type="button"
                    className={`db-source-tab${scrapeSource === 'linkedin' ? ' db-source-tab--active' : ''}`}
                    onClick={() => switchSource('linkedin')}
                  >
                    LinkedIn
                  </button>
                  <button
                    type="button"
                    className={`db-source-tab${scrapeSource === 'indeed' ? ' db-source-tab--active' : ''}`}
                    onClick={() => switchSource('indeed')}
                  >
                    Indeed
                  </button>
                  <button
                    type="button"
                    className={`db-source-tab${scrapeSource === 'seek' ? ' db-source-tab--active' : ''}`}
                    onClick={() => switchSource('seek')}
                  >
                    Seek
                  </button>
                  <button
                    type="button"
                    className={`db-source-tab${scrapeSource === 'urls' ? ' db-source-tab--active' : ''}`}
                    onClick={() => switchSource('urls')}
                  >
                    From URLs
                  </button>
                </div>
                {scrapeSource !== 'urls' ? (
                <form className="db-search-form" onSubmit={submitScrape}>
                  {scrapeSource === 'indeed' ? (
                    <div className="db-form-grid">
                      <div className="db-form-field">
                        <label className="db-form-label">Keywords</label>
                        <input
                          className="db-form-input"
                          type="text"
                          required
                          value={indeedForm.keywords}
                          onChange={e => setIndeedForm(f => ({ ...f, keywords: e.target.value }))}
                          placeholder="e.g. Software Engineer"
                        />
                      </div>
                      <div className="db-form-field">
                        <label className="db-form-label">Location</label>
                        <input
                          className="db-form-input"
                          type="text"
                          value={indeedForm.location}
                          onChange={e => setIndeedForm(f => ({ ...f, location: e.target.value }))}
                          placeholder="e.g. San Francisco"
                        />
                        <span className="db-form-hint">Type 'remote' to find remote positions.</span>
                      </div>
                      <div className="db-form-field">
                        <label className="db-form-label">Country</label>
                        <select
                          className="db-form-select"
                          value={indeedForm.country}
                          onChange={e => setIndeedForm(f => ({ ...f, country: e.target.value }))}
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
                        </select>
                      </div>
                      <div className="db-form-field">
                        <label className="db-form-label">Max listings</label>
                        <input
                          className="db-form-input"
                          type="number"
                          min="1"
                          max="100"
                          value={indeedForm.maxItems}
                          onChange={e => setIndeedForm(f => ({ ...f, maxItems: Number(e.target.value) }))}
                        />
                      </div>
                    </div>
                  ) : scrapeSource === 'linkedin' ? (
                    <div className="db-form-grid">
                      <div className="db-form-field">
                        <label className="db-form-label">Keywords</label>
                        <input
                          className="db-form-input"
                          type="text"
                          required
                          value={linkedinForm.keywords}
                          onChange={e => setLinkedinForm(f => ({ ...f, keywords: e.target.value }))}
                          placeholder="e.g. Software Engineer"
                        />
                      </div>
                      <div className="db-form-field">
                        <label className="db-form-label">Location</label>
                        <input
                          className="db-form-input"
                          type="text"
                          required
                          value={linkedinForm.location}
                          onChange={e => setLinkedinForm(f => ({ ...f, location: e.target.value }))}
                          placeholder="e.g. Melbourne, Australia"
                        />
                      </div>
                      <div className="db-form-field">
                        <label className="db-form-label">Remote</label>
                        <select
                          className="db-form-select"
                          value={linkedinForm.remote}
                          onChange={e => setLinkedinForm(f => ({ ...f, remote: e.target.value }))}
                        >
                          <option value="">Any</option>
                          <option value="onsite">On-site</option>
                          <option value="remote">Remote</option>
                          <option value="hybrid">Hybrid</option>
                        </select>
                      </div>
                      <div className="db-form-field">
                        <label className="db-form-label">Posted within</label>
                        <select
                          className="db-form-select"
                          value={linkedinForm.posted_within}
                          onChange={e => setLinkedinForm(f => ({ ...f, posted_within: e.target.value }))}
                        >
                          <option value="">Any</option>
                          <option value="day">Last day</option>
                          <option value="3days">Last 3 days</option>
                          <option value="week">Last week</option>
                          <option value="month">Last month</option>
                        </select>
                      </div>
                      <div className="db-form-field">
                        <label className="db-form-label">Max listings</label>
                        <input
                          className="db-form-input"
                          type="number"
                          min="1"
                          max="100"
                          value={linkedinForm.count}
                          onChange={e => setLinkedinForm(f => ({ ...f, count: Number(e.target.value) }))}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="db-form-grid">
                      <div className="db-form-field">
                        <label className="db-form-label">Keywords</label>
                        <input
                          className="db-form-input"
                          type="text"
                          required
                          value={seekForm.keywords}
                          onChange={e => setSeekForm(f => ({ ...f, keywords: e.target.value }))}
                          placeholder="e.g. Software Engineer"
                        />
                      </div>
                      <div className="db-form-field">
                        <label className="db-form-label">Location</label>
                        <input
                          className="db-form-input"
                          type="text"
                          value={seekForm.location}
                          onChange={e => setSeekForm(f => ({ ...f, location: e.target.value }))}
                          placeholder="e.g. Melbourne"
                        />
                      </div>
                      <div className="db-form-field">
                        <label className="db-form-label">Remote</label>
                        <select
                          className="db-form-select"
                          value={seekForm.remote}
                          onChange={e => setSeekForm(f => ({ ...f, remote: e.target.value }))}
                        >
                          <option value="">Any</option>
                          <option value="onsite">On-site</option>
                          <option value="remote">Remote</option>
                          <option value="hybrid">Hybrid</option>
                        </select>
                      </div>
                      <div className="db-form-field">
                        <label className="db-form-label">Posted within</label>
                        <select
                          className="db-form-select"
                          value={seekForm.posted_within}
                          onChange={e => setSeekForm(f => ({ ...f, posted_within: e.target.value }))}
                        >
                          <option value="">Any</option>
                          <option value="day">Last day</option>
                          <option value="3days">Last 3 days</option>
                          <option value="week">Last week</option>
                          <option value="month">Last month</option>
                        </select>
                      </div>
                      <div className="db-form-field">
                        <label className="db-form-label">Max listings</label>
                        <input
                          className="db-form-input"
                          type="number"
                          min="1"
                          max="100"
                          value={seekForm.count}
                          onChange={e => setSeekForm(f => ({ ...f, count: Number(e.target.value) }))}
                        />
                      </div>
                      <div className="db-form-field">
                        <label className="db-form-label">State</label>
                        <input
                          className="db-form-input"
                          type="text"
                          value={seekForm.state}
                          onChange={e => setSeekForm(f => ({ ...f, state: e.target.value }))}
                          placeholder="e.g. VIC"
                        />
                      </div>
                      <div className="db-form-field">
                        <label className="db-form-label">Post code</label>
                        <input
                          className="db-form-input"
                          type="text"
                          value={seekForm.postCode}
                          onChange={e => setSeekForm(f => ({ ...f, postCode: e.target.value }))}
                          placeholder="e.g. 3000"
                        />
                      </div>
                      <div className="db-form-field">
                        <label className="db-form-label">Radius (km)</label>
                        <input
                          className="db-form-input"
                          type="text"
                          value={seekForm.radius}
                          onChange={e => setSeekForm(f => ({ ...f, radius: e.target.value }))}
                          placeholder="e.g. 25"
                        />
                      </div>
                    </div>
                  )}
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
                ) : (
                  <div className="db-url-submit">
                    <div className="db-form-field">
                      <label className="db-form-label">URLs (one per line)</label>
                      <textarea
                        className="db-url-textarea"
                        rows={10}
                        placeholder={"https://example.com/jobs/123\nhttps://other.com/careers/456"}
                        value={urlsText}
                        onChange={e => setUrlsText(e.target.value)}
                      />
                      <span className="db-form-hint">
                        {urlsCount === 0 ? 'No URLs entered' : `${urlsCount} URL${urlsCount === 1 ? '' : 's'} ready to submit`}
                      </span>
                    </div>

                    <button
                      className={locked ? 'db-btn db-btn--locked' : 'db-btn db-btn--accent'}
                      type="button"
                      onClick={submitUrls}
                      disabled={urlsCount === 0 || urlSubmitLoading}
                    >
                      {urlSubmitLoading && <span className="db-spinner" aria-hidden="true" />}
                      Submit {urlsCount > 0 ? urlsCount : ''} URL{urlsCount === 1 ? '' : 's'}
                    </button>
                    {locked && (
                      <p className="db-locked-note">Requires PIN unlock.</p>
                    )}

                    <FailedIngestionsPanel />
                  </div>
                )}
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
