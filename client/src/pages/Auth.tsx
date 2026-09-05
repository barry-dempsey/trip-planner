import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Auth.css'

export default function Auth() {
  const navigate = useNavigate()
  const { login, signup, error } = useAuth()
  const [isSignup, setIsSignup] = useState(false)
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    let success = false
    if (isSignup) {
      if (formData.password !== formData.confirmPassword) {
        alert('Passwords do not match')
        setLoading(false)
        return
      }
      success = await signup(formData.email, formData.password)
    } else {
      success = await login(formData.email, formData.password)
    }

    if (success) {
      navigate('/trips')
    }
    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Trip Planner</h1>
        <h2>{isSignup ? 'Sign Up' : 'Log In'}</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          {isSignup && (
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Loading...' : isSignup ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        <p className="toggle-auth">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => setIsSignup(!isSignup)}
            className="toggle-button"
          >
            {isSignup ? 'Log In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}
