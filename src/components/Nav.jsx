import { NavLink } from 'react-router-dom'
import DarkModeToggle from './DarkModeToggle'
import './Nav.css'

function Nav({ theme, onToggle }) {
  return (
    <nav className="nav">
      <div className="nav__inner">
        <NavLink to="/" className="nav__brand">
          Dom Profico
        </NavLink>
        <div className="nav__right">
          <NavLink
            to="/resume"
            className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}
          >
            Resume
          </NavLink>
          <NavLink
            to="/projects"
            className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}
          >
            Projects
          </NavLink>
          <DarkModeToggle theme={theme} onToggle={onToggle} />
        </div>
      </div>
    </nav>
  )
}

export default Nav
