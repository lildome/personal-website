function StorageIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon
        points="5,9 19,9 17,6 7,6"
        style={{ fill: 'var(--color-accent)', opacity: 0.4, stroke: 'var(--color-accent)' }}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect
        x="5" y="9" width="14" height="10" rx="1"
        style={{ fill: 'var(--color-accent)', opacity: 0.15, stroke: 'var(--color-accent)' }}
        strokeWidth="1.5"
      />
    </svg>
  )
}

export default StorageIcon
