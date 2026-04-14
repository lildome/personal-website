function DatabaseIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4,8 L4,17 Q4,20.5 12,20.5 Q20,20.5 20,17 L20,8"
        style={{ fill: 'var(--color-accent)', opacity: 0.12 }}
      />
      <ellipse
        cx="12" cy="8" rx="8" ry="3"
        style={{ fill: 'var(--color-bg-surface)' }}
      />
      <ellipse
        cx="12" cy="8" rx="8" ry="3"
        style={{ fill: 'none', stroke: 'var(--color-accent)' }}
        strokeWidth="1.5"
      />
      <path
        d="M4,8 L4,17 Q4,20.5 12,20.5 Q20,20.5 20,17 L20,8"
        style={{ fill: 'none', stroke: 'var(--color-accent)' }}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M4,17 Q4,20.5 12,20.5 Q20,20.5 20,17"
        style={{ fill: 'none', stroke: 'var(--color-accent)' }}
        strokeWidth="1.5"
      />
    </svg>
  )
}

export default DatabaseIcon
