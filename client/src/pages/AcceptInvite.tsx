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

      // Extract groupId from token if needed, or make a request without auth
      // For now, we'll extract it from the invite mechanism
      const response = await axios.post(
        `${apiUrl}/api/groups/unknown/invitations/${token}/accept`
      )

      setTripName(response.data.trip?.name)
      setTimeout(() => {
        navigate('/trips')
      }, 2000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to accept invitation')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f5f5f5',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '400px',
        }}
      >
        {loading && !error ? (
          <>
            <h2 style={{ margin: '0 0 20px 0' }}>Accepting Invitation...</h2>
            <div style={{ fontSize: '40px', margin: '20px 0' }}>⏳</div>
            <p style={{ color: '#666', margin: 0 }}>Please wait while we add you to the trip</p>
          </>
        ) : error ? (
          <>
            <h2 style={{ margin: '0 0 20px 0', color: '#c33' }}>❌ Oops!</h2>
            <p style={{ color: '#666', margin: '0 0 20px 0' }}>{error}</p>
            <button
              onClick={() => navigate('/trips')}
              style={{
                background: '#667eea',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Back to Trips
            </button>
          </>
        ) : (
          <>
            <h2 style={{ margin: '0 0 20px 0', color: '#4caf50' }}>✅ Success!</h2>
            <p style={{ color: '#666', margin: '0 0 20px 0' }}>
              You've been added to <strong>{tripName}</strong>
            </p>
            <p style={{ color: '#999', fontSize: '12px', margin: 0 }}>
              Redirecting to your trips...
            </p>
          </>
        )}
      </div>
    </div>
  )
}
