function FrontendIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="2" y="3" width="20" height="18" rx="2"
        style={{ fill: 'var(--color-bg-surface)', stroke: 'var(--color-accent)' }}
        strokeWidth="1.5"
      />
      <rect
        x="2" y="3" width="20" height="5" rx="2"
        style={{ fill: 'var(--color-accent)', opacity: 0.25 }}
      />
      <rect
        x="2" y="6" width="20" height="2"
        style={{ fill: 'var(--color-accent)', opacity: 0.25 }}
      />
      <circle cx="6"  cy="5.5" r="1" style={{ fill: 'var(--color-accent)' }} />
      <circle cx="9"  cy="5.5" r="1" style={{ fill: 'var(--color-accent)', opacity: 0.6 }} />
      <circle cx="12" cy="5.5" r="1" style={{ fill: 'var(--color-accent)', opacity: 0.3 }} />
    </svg>
  )
}

export default FrontendIcon
