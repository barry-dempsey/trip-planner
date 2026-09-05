import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import './TripDetail.css'

interface ItineraryItem {
  _id: string
  stop: string
  time: string
  transport: string
  notes: string
  createdAt: string
}

interface Trip {
  _id: string
  name: string
  groupId: string
  destination: { address: string; lat?: number; lng?: number }
  origin: { address: string; lat?: number; lng?: number }
  startDate: string
  endDate: string
  itinerary: ItineraryItem[]
  members: Array<{ userId: string; role: string }>
  travelSuggestions?: any
}

interface Comment {
  _id: string
  question: string
  answer: string | null
  createdAt: string
}

export default function TripDetail() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showItineraryForm, setShowItineraryForm] = useState(false)
  const [itineraryForm, setItineraryForm] = useState({
    stop: '',
    time: '',
    transport: '',
    notes: '',
  })
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [questionText, setQuestionText] = useState('')
  const [askingQuestion, setAskingQuestion] = useState(false)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4001'
  const token = localStorage.getItem('authToken')

  useEffect(() => {
    fetchTrip()

    // Poll for suggestions every 2 seconds if not available yet
    if (!trip?.travelSuggestions) {
      const interval = setInterval(fetchTrip, 2000)
      return () => clearInterval(interval)
    }
  }, [groupId, trip?.travelSuggestions])

  useEffect(() => {
    if (trip?._id) {
      fetchComments()
    }
  }, [trip?._id])

  const fetchTrip = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/trips/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setTrip(response.data)
    } catch (err) {
      setError('Failed to load trip')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/comments/trip/${trip?._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setComments(response.data)
    } catch (err) {
      console.error('Failed to load comments:', err)
    }
  }

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!questionText.trim() || !trip) return

    setAskingQuestion(true)
    try {
      const response = await axios.post(
        `${apiUrl}/api/comments/trip/${trip._id}`,
        { question: questionText },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setComments([response.data, ...comments])
      setQuestionText('')
    } catch (err) {
      console.error('Failed to ask question:', err)
    } finally {
      setAskingQuestion(false)
    }
  }

  const handleAddItinerary = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const method = editingItemId ? 'put' : 'post'
      const url = editingItemId
        ? `${apiUrl}/api/trips/${groupId}/itinerary/${editingItemId}`
        : `${apiUrl}/api/trips/${groupId}/itinerary`

      await axios[method](url, itineraryForm, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setItineraryForm({ stop: '', time: '', transport: '', notes: '' })
      setEditingItemId(null)
      setShowItineraryForm(false)
      fetchTrip()
    } catch (err) {
      setError('Failed to save itinerary item')
      console.error(err)
    }
  }

  const handleDeleteItinerary = async (itemId: string) => {
    try {
      await axios.delete(`${apiUrl}/api/trips/${groupId}/itinerary/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchTrip()
    } catch (err) {
      setError('Failed to delete itinerary item')
      console.error(err)
    }
  }

  const handleEditItinerary = (item: ItineraryItem) => {
    setItineraryForm({
      stop: item.stop,
      time: item.time.slice(0, 16),
      transport: item.transport,
      notes: item.notes,
    })
    setEditingItemId(item._id)
    setShowItineraryForm(true)
  }

  const handleCancelEdit = () => {
    setItineraryForm({ stop: '', time: '', transport: '', notes: '' })
    setEditingItemId(null)
    setShowItineraryForm(false)
  }

  if (loading) return <div className="loading">Loading trip...</div>
  if (error) return <div className="error">{error}</div>
  if (!trip) return <div className="error">Trip not found</div>

  return (
    <div className="trip-detail">
      <button className="back-button" onClick={() => navigate('/trips')}>
        ← Back to Trips
      </button>

      <div className="trip-header">
        <h1>{trip.name}</h1>
        <div className="trip-meta">
          <p>
            <strong>From:</strong> {trip.origin?.address || 'Unknown'}
          </p>
          <p>
            <strong>To:</strong> {trip.destination?.address || 'Unknown'}
          </p>
          <p>
            <strong>Dates:</strong>{' '}
            {new Date(trip.startDate).toLocaleDateString()} -{' '}
            {trip.endDate ? new Date(trip.endDate).toLocaleDateString() : 'TBD'}
          </p>
          <p>
            <strong>Members:</strong> {trip.members.length}
          </p>
        </div>

        {trip.travelSuggestions && (
          <div className="travel-suggestions">
            <h3>✈️ AI Travel Suggestions</h3>
            {trip.travelSuggestions.raw_suggestions && (
              <div className="suggestion-content">
                {trip.travelSuggestions.raw_suggestions
                  .split('\n')
                  .filter(line => line.trim().length > 0)
                  .map((line, idx) => {
                    const trimmed = line.trim()
                    const isHeader = trimmed.startsWith('####')
                    const isOption = trimmed.match(/^Option\s+[A-Z]:/i)

                    // Clean up markdown symbols
                    let cleaned = trimmed
                      .replace(/^#+\s*/g, '') // Remove headers
                      .replace(/\*\*/g, '') // Remove bold
                      .replace(/\*/g, '') // Remove italics
                      .replace(/^[-•]\s*/g, '') // Remove bullets
                      .replace(/`/g, '') // Remove code ticks
                      .trim()

                    return (
                      <p key={idx} className={isHeader || isOption ? 'suggestion-heading' : 'suggestion-text'}>
                        {cleaned}
                      </p>
                    )
                  })
                }
              </div>
            )}
            {trip.travelSuggestions.transportation_options && !trip.travelSuggestions.raw_suggestions && (
              <div className="suggestion-item">
                <h4>Transportation Options</h4>
                <p>{trip.travelSuggestions.transportation_options}</p>
              </div>
            )}
          </div>
        )}
        {!trip.travelSuggestions && (
          <p className="suggestions-loading">✨ Generating AI travel suggestions...</p>
        )}
      </div>

      <div className="itinerary-section">
        <div className="section-header">
          <h2>Itinerary</h2>
          <button
            className="add-button"
            onClick={() => {
              if (showItineraryForm) {
                handleCancelEdit()
              } else {
                setShowItineraryForm(true)
              }
            }}
          >
            {showItineraryForm ? 'Cancel' : '+ Add Stop'}
          </button>
        </div>

        {showItineraryForm && (
          <form className="itinerary-form" onSubmit={handleAddItinerary}>
            <div className="form-group">
              <label>Stop/Location</label>
              <input
                type="text"
                value={itineraryForm.stop}
                onChange={(e) => setItineraryForm({ ...itineraryForm, stop: e.target.value })}
                placeholder="e.g., Eiffel Tower"
                required
              />
            </div>

            <div className="form-group">
              <label>Date & Time</label>
              <input
                type="datetime-local"
                value={itineraryForm.time}
                onChange={(e) => setItineraryForm({ ...itineraryForm, time: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Transport</label>
              <input
                type="text"
                value={itineraryForm.transport}
                onChange={(e) => setItineraryForm({ ...itineraryForm, transport: e.target.value })}
                placeholder="e.g., Metro, Flight, Car"
              />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={itineraryForm.notes}
                onChange={(e) => setItineraryForm({ ...itineraryForm, notes: e.target.value })}
                placeholder="Add any notes about this stop..."
              />
            </div>

            <button type="submit">{editingItemId ? 'Update' : 'Add'} Stop</button>
          </form>
        )}

        <div className="itinerary-list">
          {trip.itinerary.length === 0 ? (
            <p className="empty">No stops yet. Add one to get started!</p>
          ) : (
            trip.itinerary.map((item) => (
              <div key={item._id} className="itinerary-item">
                <div className="item-content">
                  <h3>{item.stop}</h3>
                  <p className="time">{new Date(item.time).toLocaleString()}</p>
                  {item.transport && <p className="transport">🚗 {item.transport}</p>}
                  {item.notes && <p className="notes">{item.notes}</p>}
                </div>
                <div className="item-actions">
                  <button
                    className="edit-button"
                    onClick={() => handleEditItinerary(item)}
                  >
                    ✏️
                  </button>
                  <button
                    className="delete-button"
                    onClick={() => handleDeleteItinerary(item._id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="qa-section">
        <div className="section-header">
          <h2>Questions & Answers</h2>
        </div>

        <form className="question-form" onSubmit={handleAskQuestion}>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Ask a question about your trip or travel suggestions..."
            rows={3}
          />
          <button type="submit" disabled={askingQuestion || !questionText.trim()}>
            {askingQuestion ? '🤔 Thinking...' : '💬 Ask Claude'}
          </button>
        </form>

        <div className="comments-list">
          {comments.length === 0 ? (
            <p className="empty">No questions yet. Ask something to get AI insights!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment._id} className="comment-item">
                <div className="question">
                  <strong>Q: {comment.question}</strong>
                </div>
                {comment.answer ? (
                  <div className="answer">
                    <strong>A:</strong> {comment.answer}
                  </div>
                ) : (
                  <div className="answer loading">Generating answer...</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
