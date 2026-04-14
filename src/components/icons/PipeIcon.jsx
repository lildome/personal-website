function PipeIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="2" y="10" width="14" height="4" rx="2"
        style={{ fill: 'var(--color-accent)', opacity: 0.25 }}
      />
      <polygon
        points="14,7 22,12 14,17"
        style={{ fill: 'var(--color-accent)' }}
      />
    </svg>
  )
}

export default PipeIcon
