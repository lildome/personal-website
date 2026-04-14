import React, { useState } from 'react'
import projectData from '../data/projects.json'
import ArchitectureDiagram from '../components/ArchitectureDiagram'
import './Blog.css'

const project = projectData.projects[0]

function Blog() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="blog">
      {/* Section 1 — Hook */}
      <section className="blog-hook">
        <div className="blog-hook__inner">
          <h1 className="blog-hook__title">[PLACEHOLDER: hook heading — project name, punchy]</h1>
          <p className="blog-hook__intro">
            [PLACEHOLDER: hook opening paragraph — informal, first person, sets the scene for why this project exists]
          </p>
          <div className="blog-hook__stats">
            <div className="stat-card">
              <span className="stat-card__value">{project.stats.lambdas}</span>
              <span className="stat-card__label">Lambda Functions</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__value">{project.stats.awsServices}</span>
              <span className="stat-card__label">AWS Services</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__value">{project.status}</span>
              <span className="stat-card__label">Status</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2 — The Problem */}
      <section className="blog-section">
        <div className="blog-section__inner">
          <div className="problem-grid">
            <div className="problem-grid__left">
              <h2 className="blog-section__heading">The problem</h2>
              <p>[PLACEHOLDER: the problem paragraph — describe the manual, tedious job hunt process in first person]</p>
            </div>
            <div className="problem-grid__right">
              <h3 className="problem-grid__subheading">What I used to do manually</h3>
              <ul className="problem-checklist">
                <li>Reading job descriptions</li>
                <li>Researching companies</li>
                <li>Tailoring CVs</li>
                <li>Writing cover letters</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 — Pipeline Overview */}
      <section className="blog-section blog-section--subtle">
        <div className="blog-section__inner blog-section__inner--centred">
          <h2 className="blog-section__heading">Pipeline overview</h2>
          <p className="blog-section__sub">
            [PLACEHOLDER: one sentence describing what the pipeline does end-to-end]
          </p>
          <div className="pipeline">
            {project.pipeline.map((step, i) => (
              <React.Fragment key={step.name}>
                <div className="pipeline-card">
                  <strong className="pipeline-card__name">{step.name}</strong>
                  <p className="pipeline-card__desc">{step.description}</p>
                </div>
                {i < project.pipeline.length - 1 && (
                  <span className="pipeline-arrow" aria-hidden="true">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4 — Architecture */}
      <section className="blog-section">
        <div className="blog-section__inner">
          <h2 className="blog-section__heading">Architecture</h2>

          {/* Expandable flowchart */}
          <div className="flowchart">
            <button
              className="flowchart__toggle"
              onClick={() => setExpanded(e => !e)}
              aria-expanded={expanded}
            >
              <div className="flowchart__toggle-text">
                <span className="flowchart__toggle-title">AWS architecture diagram</span>
                <span className="flowchart__toggle-sub">Full data flow — trigger to output</span>
              </div>
              <span className={`flowchart__chevron${expanded ? ' flowchart__chevron--open' : ''}`}>›</span>
            </button>

            {expanded && (
              <div className="flowchart__content">
                <ArchitectureDiagram layout="vertical" />
              </div>
            )}
          </div>

          {/* Decision cards */}
          <div className="decisions-grid">
            {project.decisions.map((d, i) => (
              <div key={i} className="decision-card">
                <div className="decision-card__half">
                  <span className="decision-card__label decision-card__label--problem">Problem</span>
                  <p className="decision-card__text">{d.problem}</p>
                </div>
                <div className="decision-card__divider" />
                <div className="decision-card__half">
                  <span className="decision-card__label decision-card__label--solution">Solution</span>
                  <p className="decision-card__text">{d.solution}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5 — Tech Stack */}
      <section className="blog-section blog-section--subtle">
        <div className="blog-section__inner blog-section__inner--centred">
          <h2 className="blog-section__heading">Tech stack</h2>
          <div className="stack-badges">
            {project.stack.map(item => (
              <span key={item} className="stack-badge">{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Section 6 — What I Learned */}
      <section className="blog-section">
        <div className="blog-section__inner blog-section__inner--narrow">
          <h2 className="blog-section__heading">What I learned</h2>
          {project.learnings.map((l, i) => (
            <p key={i} className="blog-section__para">{l}</p>
          ))}
        </div>
      </section>

      {/* Section 7 — What's Next */}
      <section className="blog-section blog-section--subtle">
        <div className="blog-section__inner blog-section__inner--narrow">
          <h2 className="blog-section__heading">What's next</h2>
          <ul className="next-steps">
            {project.nextSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

export default Blog
