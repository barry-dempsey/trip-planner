import { useEffect, useState } from 'react'
import axios from 'axios'
import type { Socket } from 'socket.io-client'

interface PollOption {
  _id: string
  text: string
  votes: string[]
}

interface Poll {
  _id: string
  question: string
  options: PollOption[]
  allowMultiple: boolean
  status: 'open' | 'closed'
  createdBy: string
}

interface Props {
  groupId: string
  apiUrl: string
  token: string | null
  currentUid?: string
  isOrganizer: boolean
  socket: Socket | null
}

export default function Polls({ groupId, apiUrl, token, currentUid, isOrganizer, socket }: Props) {
  const [polls, setPolls] = useState<Poll[]>([])
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const base = `${apiUrl}/api/polls/trip/${groupId}`
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    axios
      .get<Poll[]>(base, { headers })
      .then((res) => {
        setPolls(res.data)
        setLoadFailed(false)
      })
      .catch((err) => {
        setLoadFailed(true)
        setError(err.response?.data?.error || 'Failed to load polls')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  useEffect(() => {
    if (!socket) return
    const onCreated = ({ poll }: { poll: Poll }) =>
      setPolls((prev) => (prev.some((p) => p._id === poll._id) ? prev : [poll, ...prev]))
    const onUpdated = ({ poll }: { poll: Poll }) =>
      setPolls((prev) => prev.map((p) => (p._id === poll._id ? poll : p)))
    const onDeleted = ({ pollId }: { pollId: string }) =>
      setPolls((prev) => prev.filter((p) => p._id !== pollId))

    socket.on('poll:created', onCreated)
    socket.on('poll:updated', onUpdated)
    socket.on('poll:deleted', onDeleted)
    return () => {
      socket.off('poll:created', onCreated)
      socket.off('poll:updated', onUpdated)
      socket.off('poll:deleted', onDeleted)
    }
  }, [socket])

  const run = async (fn: () => Promise<void>) => {
    setError(null)
    try {
      await fn()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong')
    }
  }

  const createPoll = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      const res = await axios.post<Poll>(
        base,
        { question, options: options.filter((o) => o.trim()), allowMultiple },
        { headers }
      )
      setPolls((prev) => (prev.some((p) => p._id === res.data._id) ? prev : [res.data, ...prev]))
      setQuestion('')
      setOptions(['', ''])
      setAllowMultiple(false)
    })
  }

  const vote = (poll: Poll, optionId: string) =>
    run(async () => {
      const res = await axios.post<Poll>(`${base}/${poll._id}/vote`, { optionId }, { headers })
      setPolls((prev) => prev.map((p) => (p._id === poll._id ? res.data : p)))
    })

  const close = (poll: Poll) =>
    run(async () => {
      const res = await axios.post<Poll>(`${base}/${poll._id}/close`, {}, { headers })
      setPolls((prev) => prev.map((p) => (p._id === poll._id ? res.data : p)))
    })

  const remove = (poll: Poll) =>
    run(async () => {
      await axios.delete(`${base}/${poll._id}`, { headers })
      setPolls((prev) => prev.filter((p) => p._id !== poll._id))
    })

  return (
    <div className="qa-section">
      <div className="section-header">
        <h2>Polls</h2>
      </div>

      {error && <p className="text-error">{error}</p>}

      <form className="question-form" onSubmit={createPoll}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask the group, e.g. Where should we eat on day 2?"
          maxLength={300}
        />
        {options.map((opt, i) => (
          <input
            key={i}
            value={opt}
            onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
            placeholder={`Option ${i + 1}`}
            maxLength={200}
          />
        ))}
        <div className="form-row">
          {options.length < 10 && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => setOptions([...options, ''])}>
              + Add option
            </button>
          )}
          <label>
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={(e) => setAllowMultiple(e.target.checked)}
            />{' '}
            Allow multiple choices
          </label>
        </div>
        <button
          type="submit"
          disabled={!question.trim() || options.filter((o) => o.trim()).length < 2}
        >
          🗳️ Create poll
        </button>
      </form>

      <div className="comments-list">
        {polls.length === 0 ? (
          loadFailed ? null : <p className="empty">No polls yet. Create one to let the group decide!</p>
        ) : (
          polls.map((poll) => {
            const total = poll.options.reduce((sum, o) => sum + o.votes.length, 0)
            const canManage = poll.createdBy === currentUid || isOrganizer
            return (
              <div key={poll._id} className="comment-item">
                <div className="question">
                  <strong>{poll.question}</strong>
                  {poll.status === 'closed' && (
                    <span className="badge badge-muted">🔒 Closed</span>
                  )}
                </div>
                {poll.options.map((opt) => {
                  const mine = !!currentUid && opt.votes.includes(currentUid)
                  const pct = total ? Math.round((opt.votes.length / total) * 100) : 0
                  return (
                    <button
                      key={opt._id}
                      type="button"
                      disabled={poll.status === 'closed'}
                      onClick={() => vote(poll, opt._id)}
                      className={`poll-option${mine ? ' mine' : ''}`}
                      style={{ ['--pct' as string]: `${pct}%` }}
                    >
                      {mine ? '✓ ' : ''}
                      {opt.text} — {opt.votes.length} ({pct}%)
                    </button>
                  )
                })}
                {canManage && (
                  <div className="row-actions">
                    {poll.status === 'open' && (
                      <button type="button" className="btn-secondary btn-sm" onClick={() => close(poll)}>
                        Close poll
                      </button>
                    )}
                    <button type="button" className="btn-danger btn-sm" onClick={() => remove(poll)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
