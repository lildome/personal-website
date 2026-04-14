function LambdaIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="2" y="2" width="20" height="20" rx="5"
        style={{ fill: 'var(--color-accent)', opacity: 0.15 }}
      />
      <polyline
        points="7,6 12,12 17,18"
        style={{ stroke: 'var(--color-accent)', fill: 'none' }}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="12,6 7,18"
        style={{ stroke: 'var(--color-accent)', fill: 'none' }}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default LambdaIcon
