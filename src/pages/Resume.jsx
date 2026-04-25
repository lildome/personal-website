import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Resume.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL

function Resume() {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let ignore = false

    async function fetchProfile() {
      try {
        const response = await fetch(`${API_BASE}/profile`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        if (!ignore) setProfile(data)
      } catch {
        if (!ignore) setError(true)
      }
    }

    fetchProfile()
    return () => { ignore = true }
  }, [])

  if (error) {
    return (
      <div className="resume">
        <p>
          Resume temporarily unavailable. You can find me on{' '}
          <a
            href="https://www.linkedin.com/in/dominick-profico-4668b8272/"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </a>
          .
        </p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="resume">
        <p style={{ textAlign: 'center' }}>Loading...</p>
      </div>
    )
  }

  const {
    name,
    location,
    phone,
    email,
    linkedin,
    github,
    summary,
    experience,
    projects,
    skills,
    education,
  } = profile

  return (
    <div className="resume">
      <header className="resume__header">
        <h1 className="resume__name">{name}</h1>
        <div className="resume__contact">
          <span>{location}</span>
          <span>{phone}</span>
          <span>{email}</span>
          <a href={`https://${linkedin}`} target="_blank" rel="noreferrer">{linkedin}</a>
          <a href={`https://${github}`} target="_blank" rel="noreferrer">{github}</a>
        </div>
      </header>

      <section className="resume__section">
        <h2 className="resume__section-heading">Summary</h2>
        <p>{summary}</p>
      </section>

      <section className="resume__section">
        <h2 className="resume__section-heading">Experience</h2>
        {experience.map((job, i) => (
          <div key={i} className="resume__job">
            <div className="resume__job-header">
              <div>
                <span className="resume__job-company">{job.company}</span>
                <span className="resume__job-role">{job.role}</span>
              </div>
              <span className="resume__job-period">{job.period}</span>
            </div>
            <ul className="resume__bullets">
              {job.bullets.map((bullet, j) => (
                <li key={j}>{bullet}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="resume__section">
        <h2 className="resume__section-heading">Projects</h2>
        {projects.map((project, i) => (
          <div key={i} className="resume__job">
            <div className="resume__job-header">
              <div>
                <span className="resume__job-company">{project.title}</span>
                <span className="resume__job-role">{project.subtitle}</span>
              </div>
              {project.subtitleLink && (
                <div className="resume__job-header-right">
                  <Link
                    to={project.subtitleLink.to}
                    className="resume__project-link"
                    onClick={() => window.scrollTo(0, 0)}
                  >
                    {project.subtitleLink.label}
                  </Link>
                </div>
              )}
            </div>
            <ul className="resume__bullets">
              {project.bullets.map((bullet, j) => (
                <li key={j}>{bullet}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="resume__section">
        <h2 className="resume__section-heading">Skills</h2>
        <div className="resume__skills">
          {skills.categories.map((cat, i) => (
            <div key={i} className="resume__skill-category">
              <span className="resume__skill-label">{cat.label}</span>
              <div className="resume__skill-items">
                {cat.items.map((item, j) => (
                  <span key={j} className="resume__skill-pill-wrapper">
                    <span className="resume__skill-pill">{item.name} ({item.proficiency})</span>
                    <span className="resume__skill-tooltip">{item.description}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="resume__section">
        <h2 className="resume__section-heading">Education</h2>
        <div className="resume__education">
          <div className="resume__education-header">
            <span className="resume__education-institution">{education.institution}</span>
            <span className="resume__education-year">{education.year}</span>
          </div>
          {education.degrees.map((degree, i) => (
            <p key={i} className="resume__education-degree">{degree}</p>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Resume
