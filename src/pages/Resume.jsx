import resumeData from '../data/resume.json'
import './Resume.css'

function Resume() {
  const {
    name,
    title,
    location,
    phone,
    email,
    linkedin,
    summary,
    experience,
    skills,
    education,
  } = resumeData

  return (
    <div className="resume">
      <header className="resume__header">
        <h1 className="resume__name">{name}</h1>
        <p className="resume__title">{title}</p>
        <div className="resume__contact">
          <span>{location}</span>
          <span>{phone}</span>
          <span>{email}</span>
          <span>{linkedin}</span>
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
        {education.map((edu, i) => (
          <div key={i} className="resume__education">
            <div className="resume__education-header">
              <span className="resume__education-institution">{edu.institution}</span>
              <span className="resume__education-year">{edu.year}</span>
            </div>
            <p className="resume__education-degree">{edu.degree}</p>
          </div>
        ))}
      </section>
    </div>
  )
}

export default Resume
