import { Link } from 'react-router-dom'
import './Landing.css'

function Landing() {
  return (
    <div className="landing">
      <div className="landing__content">
        <h1 className="landing__name">Dominick Profico</h1>
        <h2 className="landing__tagline">Software engineer. Melbourne, AU.</h2>
        <p className="landing__intro">
          I'm Dom Profico. I'm a software engineer based in Melbourne, and at my core I'm two things: a problem solver and a learner. I like getting to the root of things, understanding a problem completely before reaching for a solution. That instinct was sharpened studying mathematics and computer science, and it follows me into everything I build.
        </p>
        <p className="landing__intro">
          Right now that looks like an AI agent pipeline I've been building from scratch. I took a problem I was living with daily and used it as a vehicle to go deep on something I wanted to understand: how LLMs actually behave in production, how to design agents that do real work, and what it takes to orchestrate all of it on AWS.
        </p>
        <div className="landing__cta">
          <Link to="/resume" className="btn btn--primary">
            View my resume
          </Link>
          <Link to="/blog" className="btn btn--secondary">
            See what I've been building
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Landing
