function QueueIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="6"  width="18" height="3" rx="1.5" style={{ fill: 'var(--color-accent)' }} />
      <rect x="3" y="11" width="13" height="3" rx="1.5" style={{ fill: 'var(--color-accent)', opacity: 0.7 }} />
      <rect x="3" y="16" width="8"  height="3" rx="1.5" style={{ fill: 'var(--color-accent)', opacity: 0.4 }} />
    </svg>
  )
}

export default QueueIcon
