function DeployIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="10.5" y="11" width="3" height="10" rx="1.5"
        style={{ fill: 'var(--color-accent)', opacity: 0.4 }}
      />
      <polygon
        points="12,3 19,14 5,14"
        style={{ fill: 'var(--color-accent)' }}
      />
    </svg>
  )
}

export default DeployIcon
