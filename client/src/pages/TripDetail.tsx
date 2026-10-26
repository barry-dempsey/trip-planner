import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { io, Socket } from 'socket.io-client'
import './TripDetail.css'
import Polls from '../components/Polls'
import Expenses from '../components/Expenses'
import LiveLocationMap from '../components/LiveLocationMap'
import { usePushNotifications } from '../hooks/usePushNotifications'

interface ItineraryItem {
  _id: string
  stop: string
  time: string
  transport: string
  notes: string
  createdAt: string
  version?: number
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
  members: Array<{ userId?: string; email?: string; role: string; status?: string }>
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
  const [activeUsers, setActiveUsers] = useState<any[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [conflictError, setConflictError] = useState<any>(null)
  const [showMembersTab, setShowMembersTab] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [generatingItinerary, setGeneratingItinerary] = useState(false)
  const [inviteToken, setInviteToken] = useState<string | null>(null)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4001'
  const token = localStorage.getItem('authToken')
  const currentUid = JSON.parse(localStorage.getItem('user') || '{}').uid
  const push = usePushNotifications(apiUrl, token)

  useEffect(() => {
    // Initialize Socket.io connection
    const socketInstance = io(apiUrl, {
      auth: { token: token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    })

    socketInstance.on('connect', () => {
      console.log('Socket connected')
      if (groupId) {
        socketInstance.emit('join-trip', { tripId: groupId, userId: token })
      }
    })

    socketInstance.on('presence:update', (data) => {
      setActiveUsers(data.activeUsers || [])
    })

    socketInstance.on('itinerary:itemAdded', (data) => {
      setTrip((prev) => {
        if (!prev) return prev
        if (prev.itinerary.some((i) => i._id === data.item._id)) return prev
        return {
          ...prev,
          itinerary: [...prev.itinerary, data.item],
        }
      })
    })

    socketInstance.on('itinerary:itemUpdated', (data) => {
      setTrip((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          itinerary: prev.itinerary.map((item) =>
            item._id === data.itemId ? data.item : item
          ),
        }
      })
    })

    socketInstance.on('itinerary:itemDeleted', (data) => {
      setTrip((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          itinerary: prev.itinerary.filter((item) => item._id !== data.itemId),
        }
      })
    })

    setSocket(socketInstance)

    return () => {
      if (groupId) {
        socketInstance.emit('leave-trip', groupId)
      }
      socketInstance.disconnect()
    }
  }, [groupId, apiUrl, token])

  useEffect(() => {
    fetchTrip()

    // Poll for suggestions every 2 seconds if not available yet
    if (!trip?.travelSuggestions?.raw_suggestions) {
      const interval = setInterval(fetchTrip, 2000)
      return () => clearInterval(interval)
    }
  }, [groupId, trip?.travelSuggestions?.raw_suggestions])

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

  const handleGenerateItinerary = async () => {
    const preferences = window.prompt(
      'Any preferences for the AI? (e.g. budget, food, relaxed pace). Leave blank to skip.',
      ''
    )
    if (preferences === null) return
    setGeneratingItinerary(true)
    try {
      await axios.post(
        `${apiUrl}/api/trips/${groupId}/itinerary/generate`,
        { preferences },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      fetchTrip()
    } catch (err: any) {
      alert(`Error: ${err.response?.data?.error || 'Failed to generate itinerary'}`)
    } finally {
      setGeneratingItinerary(false)
    }
  }

  const handleRemoveMember = async (member: { userId?: string; email?: string }) => {
    if (!confirm(`Remove ${member.email || 'this member'} from the trip?`)) return
    try {
      await axios.delete(`${apiUrl}/api/groups/${groupId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
        data: member.userId ? { userId: member.userId } : { email: member.email },
      })
      fetchTrip()
    } catch (err: any) {
      alert(`Error: ${err.response?.data?.error || 'Failed to remove member'}`)
    }
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !trip) return

    setInviting(true)
    try {
      const response = await axios.post(
        `${apiUrl}/api/groups/${groupId}/members`,
        { email: inviteEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setInviteToken(response.data.invitation?.token)
      setInviteEmail('')
      fetchTrip()
    } catch (err: any) {
      alert(`Error: ${err.response?.data?.error || 'Failed to send invite'}`)
      console.error('Failed to invite member:', err)
    } finally {
      setInviting(false)
    }
  }

  const handleAddItinerary = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const method = editingItemId ? 'put' : 'post'
      const url = editingItemId
        ? `${apiUrl}/api/trips/${groupId}/itinerary/${editingItemId}`
        : `${apiUrl}/api/trips/${groupId}/itinerary`

      const payload = editingItemId
        ? { ...itineraryForm, version: trip?.itinerary.find((i) => i._id === editingItemId)?.version }
        : itineraryForm

      await axios[method](url, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setItineraryForm({ stop: '', time: '', transport: '', notes: '' })
      setEditingItemId(null)
      setShowItineraryForm(false)
      setConflictError(null)

      if (socket) {
        socket.emit('presence:stopEdit', { tripId: groupId, userId: token })
      }

      fetchTrip()
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConflictError({
          currentVersion: err.response.data.currentVersion,
          expectedVersion: err.response.data.expectedVersion,
          itemId: editingItemId,
        })
        setError('This item was updated by another user. Reload to see changes.')
      } else {
        setError('Failed to save itinerary item')
      }
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

    if (socket) {
      socket.emit('presence:startEdit', {
        tripId: groupId,
        userId: token,
        itemId: item._id,
      })
    }
  }

  const handleCancelEdit = () => {
    setItineraryForm({ stop: '', time: '', transport: '', notes: '' })
    setEditingItemId(null)
    setShowItineraryForm(false)
    setConflictError(null)

    if (socket) {
      socket.emit('presence:stopEdit', { tripId: groupId, userId: token })
    }
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
        <div className="trip-title-row">
          <h1>{trip.name}</h1>
          {(push.status === 'off' || push.status === 'denied') && (
            <button
              type="button"
              disabled={push.status === 'denied'}
              title={push.status === 'denied' ? 'Notifications are blocked in your browser settings' : ''}
              onClick={push.enable}
            >
              🔔 Enable notifications
            </button>
          )}
          {push.status === 'on' && <span className="push-on">🔔 Notifications on</span>}
          {activeUsers.length > 0 && (
            <div className="presence-indicator">
              <span>Active:</span>
              {activeUsers.map((user) => (
                <span key={user.userId} className="presence-user">
                  <span className={`presence-dot${user.status === 'editing' ? ' editing' : ''}`} />
                  {user.userEmail}
                </span>
              ))}
            </div>
          )}
        </div>
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

        {trip.travelSuggestions?.raw_suggestions && (
          <div className="travel-suggestions">
            <h3>✈️ AI Travel Suggestions</h3>
            {trip.travelSuggestions.raw_suggestions && (
              <div className="suggestion-content">
                {trip.travelSuggestions.raw_suggestions
                  .split('\n')
                  .filter((line: string) => line.trim().length > 0)
                  .map((line: string, idx: number) => {
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
        {!trip.travelSuggestions?.raw_suggestions && (
          <p className="suggestions-loading">
            {trip.travelSuggestions?.error
              ? `⚠️ Couldn't generate suggestions (${trip.travelSuggestions.error}). Retrying...`
              : '✨ Generating AI travel suggestions...'}
          </p>
        )}
      </div>

      {conflictError && (
        <div className="conflict-banner">
          <strong>⚠️ Conflict Detected:</strong> This item was updated by another user.
          <button
            className="btn-link"
            onClick={() => {
              fetchTrip()
              setConflictError(null)
            }}
          >
            Reload to see changes
          </button>
        </div>
      )}

      <div className="itinerary-section">
        <div className="section-header">
          <h2>Itinerary</h2>
          <div className="section-actions">
          <button
            className="add-button"
            onClick={handleGenerateItinerary}
            disabled={generatingItinerary}
          >
            {generatingItinerary ? '✨ Generating...' : '✨ Generate with AI'}
          </button>
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
            trip.itinerary.map((item) => {
              const editingUser = activeUsers.find((u) => u.editingItemId === item._id)
              return (
                <div key={item._id} className={`itinerary-item${editingUser ? ' editing' : ''}`}>
                  <div className="item-content">
                    {editingUser && (
                      <div className="editing-note">
                        ✏️ {editingUser.userEmail} is editing...
                      </div>
                    )}
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
            )})
          )}
        </div>
      </div>

      <div className="qa-section">
        <div className="section-header">
          <h2>Members</h2>
          <button
            className="add-button"
            onClick={() => setShowMembersTab(!showMembersTab)}
          >
            {showMembersTab ? 'Hide' : '+ Invite'}
          </button>
        </div>

        {showMembersTab && (
          <>
            <form className="question-form" onSubmit={handleInviteMember}>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter email address..."
                required
              />
              <button type="submit" disabled={inviting || !inviteEmail.trim()}>
                {inviting ? '📧 Sending...' : '📧 Send Invite'}
              </button>
            </form>

            {inviteToken && (
              <div className="invite-box">
                <strong>✓ Invitation Created!</strong>
                <p>Share this link with the invited person:</p>
                <div
                  className="invite-link"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/accept-invite/${inviteToken}`)
                    alert('Link copied to clipboard!')
                  }}
                >
                  {`${window.location.origin}/accept-invite/${inviteToken}`}
                </div>
                <p className="small">(Click to copy link)</p>
                <button className="btn-sm" onClick={() => setInviteToken(null)}>
                  Done
                </button>
              </div>
            )}
          </>
        )}

        <div className="comments-list">
          {trip.members.map((member) => (
            <div key={member.userId || member.email} className="comment-item">
              <div className="question">
                <strong>{member.email || 'Unknown'}</strong>
                <span className="comment-meta">
                  {member.role === 'organizer' ? '👑 Organizer' : 'Member'}
                </span>
                <span className={`badge ${member.status === 'active' ? 'badge-success' : 'badge-muted'}`}>
                  {member.status === 'pending' ? '⏳ Invited' : '✓ Active'}
                </span>
                {member.role !== 'organizer' &&
                  trip.members.some(
                    (m) => m.role === 'organizer' && m.userId === currentUid
                  ) && (
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      onClick={() => handleRemoveMember(member)}
                    >
                      {member.status === 'pending' ? 'Cancel invite' : 'Remove'}
                    </button>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <LiveLocationMap
        groupId={trip.groupId}
        socket={socket}
        currentUid={currentUid}
        destination={trip.destination}
      />

      <Polls
        groupId={trip.groupId}
        apiUrl={apiUrl}
        token={token}
        currentUid={currentUid}
        isOrganizer={trip.members.some((m) => m.role === 'organizer' && m.userId === currentUid)}
        socket={socket}
      />

      <Expenses
        groupId={trip.groupId}
        apiUrl={apiUrl}
        token={token}
        currentUid={currentUid}
        members={trip.members}
        socket={socket}
      />

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
            {askingQuestion ? '🤔 Thinking...' : '💬 Ask AI'}
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
