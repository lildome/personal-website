import { Link } from 'react-router-dom'
import projectData from '../data/projects.json'
import './Projects.css'

const project = projectData.projects[0]

function Projects() {
  return (
    <div className="projects">
      <div className="projects__inner">
        <h1 className="projects__heading">Projects</h1>
        <div className="projects__grid">
          <Link to="/projects/job-hunt" className="project-card">
            <h2 className="project-card__title">{project.title}</h2>
            <p className="project-card__tagline">{project.tagline}</p>
            <span className="project-card__cta">Read more →</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Projects
