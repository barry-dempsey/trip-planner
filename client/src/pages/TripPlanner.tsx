import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import './TripPlanner.css'

interface Trip {
  _id: string
  name: string
  groupId: string
  destination: { address: string }
  origin: { address: string }
  startDate: string
  members: Array<{ userId: string }>
}

export default function TripPlanner() {
  const navigate = useNavigate()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    destination: '',
    origin: '',
    startDate: '',
  })

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4001'
  const token = localStorage.getItem('authToken')

  useEffect(() => {
    fetchTrips()
  }, [])

  const fetchTrips = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/trips`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setTrips(response.data)
    } catch (err) {
      setError('Failed to load trips')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const tripData = {
        name: formData.name,
        destination: { address: formData.destination },
        origin: { address: formData.origin },
        startDate: new Date(formData.startDate).toISOString(),
      }
      const response = await axios.post(`${apiUrl}/api/trips`, tripData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setTrips([...trips, response.data])
      setFormData({ name: '', destination: '', origin: '', startDate: '' })
      setFormOpen(false)
      setError(null)
    } catch (err) {
      setError('Failed to create trip')
      console.error(err)
    }
  }

  const handleDeleteTrip = async (groupId: string) => {
    try {
      await axios.delete(`${apiUrl}/api/trips/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setTrips(trips.filter((t) => t.groupId !== groupId))
    } catch (err) {
      setError('Failed to delete trip')
      console.error(err)
    }
  }

  if (loading) return <div className="loading">Loading trips...</div>

  return (
    <div className="trip-planner">
      <div className="header">
        <h2>Your Trips</h2>
        <button onClick={() => setFormOpen(!formOpen)}>
          {formOpen ? 'Cancel' : '+ New Trip'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {formOpen && (
        <form className="trip-form" onSubmit={handleCreateTrip}>
          <div className="form-group">
            <label>Trip Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Paris Weekend"
              required
            />
          </div>

          <div className="form-group">
            <label>Origin</label>
            <input
              type="text"
              value={formData.origin}
              onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
              placeholder="e.g., San Francisco, CA"
              required
            />
          </div>

          <div className="form-group">
            <label>Destination</label>
            <input
              type="text"
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              placeholder="e.g., Paris, France"
              required
            />
          </div>

          <div className="form-group">
            <label>Start Date</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              required
            />
          </div>

          <button type="submit">Create Trip</button>
        </form>
      )}

      <div className="trips-list">
        {trips.length === 0 ? (
          <p className="empty">No trips yet. Create one to get started!</p>
        ) : (
          trips.map((trip) => (
            <div key={trip._id} className="trip-card">
              <div className="trip-info" onClick={() => navigate(`/trips/${trip.groupId}`)}>
                <h3>{trip.name}</h3>
                <p>{trip.origin?.address || 'Unknown'} → {trip.destination?.address || 'Unknown'}</p>
                <small>{new Date(trip.startDate).toLocaleDateString()}</small>
              </div>
              <div className="trip-actions">
                <span className="members">{trip.members.length} members</span>
                <button
                  className="delete-btn"
                  onClick={() => {
                    if (confirm('Delete this trip?')) {
                      handleDeleteTrip(trip.groupId)
                    }
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
