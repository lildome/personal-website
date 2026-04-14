import { Link } from 'react-router-dom'
import './Landing.css'

function Landing() {
  return (
    <div className="landing">
      <div className="landing__content">
        <h1 className="landing__name">[PLACEHOLDER: name]</h1>
        <h2 className="landing__tagline">[PLACEHOLDER: one-liner tagline]</h2>
        <p className="landing__intro">
          [PLACEHOLDER: brief intro paragraph — 2-3 sentences, conversational, first person]
        </p>
        <div className="landing__cta">
          <Link to="/resume" className="btn btn--primary">
            [PLACEHOLDER: primary CTA label]
          </Link>
          <Link to="/blog" className="btn btn--secondary">
            [PLACEHOLDER: secondary CTA label]
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Landing
