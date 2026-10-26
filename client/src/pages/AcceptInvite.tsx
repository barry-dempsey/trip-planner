import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tripName, setTripName] = useState<string | null>(null)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4001'

  useEffect(() => {
    acceptInvite()
  }, [token])

  const acceptInvite = async () => {
    try {
      if (!token) {
        setError('Invalid invitation link')
        setLoading(false)
        return
      }

      const authToken = localStorage.getItem('authToken')
      if (!authToken) {
        sessionStorage.setItem('pendingInvite', `/accept-invite/${token}`)
        navigate('/')
        return
      }

      const response = await axios.post(
        `${apiUrl}/api/groups/invitations/${token}/accept`,
        {},
        { headers: { Authorization: `Bearer ${authToken}` } }
      )

      console.log('Accept response:', response.data)
      setTripName(response.data.trip?.name)
      setTimeout(() => {
        navigate('/trips')
      }, 2000)
    } catch (err: any) {
      console.error('Accept error:', err)
      setError(err.response?.data?.error || 'Failed to accept invitation')
      setLoading(false)
    }
  }

  return (
    <div className="invite-page">
      <div className="invite-card">
        {loading && !error ? (
          <>
            <h2>Accepting Invitation...</h2>
            <div className="emoji">⏳</div>
            <p>Please wait while we add you to the trip</p>
          </>
        ) : error ? (
          <>
            <h2 className="text-error">❌ Oops!</h2>
            <p>{error}</p>
            <button onClick={() => navigate('/trips')}>
              Back to Trips
            </button>
          </>
        ) : (
          <>
            <h2 style={{ color: 'var(--success)' }}>✅ Success!</h2>
            <p>
              You've been added to <strong>{tripName}</strong>
            </p>
            <p className="small">
              Redirecting to your trips...
            </p>
          </>
        )}
      </div>
    </div>
  )
}
