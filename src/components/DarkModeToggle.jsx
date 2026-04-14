import './DarkModeToggle.css'

function DarkModeToggle({ theme, onToggle }) {
  return (
    <button
      className="dark-mode-toggle"
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? '☀' : '🌙'}
    </button>
  )
}

export default DarkModeToggle
