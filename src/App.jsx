import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Nav from './components/Nav'
import Landing from './pages/Landing'
import Resume from './pages/Resume'
import Blog from './pages/Blog'
import Projects from './pages/Projects'
import Dashboard from './pages/Dashboard'

function App() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }

  return (
    <div className="app-shell">
      <Nav theme={theme} onToggle={toggleTheme} />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/resume" element={<Resume />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/job-hunt" element={<Blog />} />
          <Route path="/projects/job-hunt/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
