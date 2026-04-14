function ApiIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon
        points="12,3 21,12 12,21 3,12"
        style={{ fill: 'var(--color-accent)', opacity: 0.15, stroke: 'var(--color-accent)' }}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <polygon
        points="12,7 17,12 12,17 7,12"
        style={{ fill: 'var(--color-accent)', opacity: 0.4 }}
      />
    </svg>
  )
}

export default ApiIcon
