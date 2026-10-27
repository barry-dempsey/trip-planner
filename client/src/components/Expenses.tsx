import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import type { Socket } from 'socket.io-client'

interface Expense {
  _id: string
  description: string
  amountCents: number
  currency: string
  paidBy: string
  splitAmong: string[]
  createdBy: string
}

interface Summary {
  expenses: Expense[]
  balances: Record<string, number>
  settlements: Array<{ from: string; to: string; amountCents: number }>
}

interface Member {
  userId?: string
  email?: string
  role: string
  status?: string
}

interface Props {
  groupId: string
  apiUrl: string
  token: string | null
  currentUid?: string
  members: Member[]
  socket: Socket | null
}

const fmt = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)

export default function Expenses({ groupId, apiUrl, token, currentUid, members, socket }: Props) {
  const [data, setData] = useState<Summary>({ expenses: [], balances: {}, settlements: [] })
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(currentUid || '')
  const [error, setError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const base = `${apiUrl}/api/expenses/trip/${groupId}`
  const headers = { Authorization: `Bearer ${token}` }
  const active = members.filter((m) => m.status === 'active' && m.userId)
  const nameOf = (uid: string) => active.find((m) => m.userId === uid)?.email || uid
  const currency = data.expenses[0]?.currency || 'EUR'

  const load = useCallback(async () => {
    try {
      const res = await axios.get<Summary>(base, { headers })
      setData(res.data)
      setLoadFailed(false)
    } catch (err: any) {
      setLoadFailed(true)
      setError(err.response?.data?.error || 'Failed to load expenses')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, token])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!socket) return
    socket.on('expenses:changed', load)
    return () => {
      socket.off('expenses:changed', load)
    }
  }, [socket, load])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const res = await axios.post<Summary>(base, { description, amount, paidBy }, { headers })
      setData(res.data)
      setDescription('')
      setAmount('')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add expense')
    }
  }

  const remove = async (id: string) => {
    setError(null)
    try {
      const res = await axios.delete<Summary>(`${base}/${id}`, { headers })
      setData(res.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete expense')
    }
  }

  return (
    <div className="qa-section">
      <div className="section-header">
        <h2>Expenses</h2>
      </div>

      {error && <p className="text-error">{error}</p>}

      <form className="question-form" onSubmit={add}>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was it for? e.g. Dinner"
          maxLength={200}
        />
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
        />
        <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
          {active.map((m) => (
            <option key={m.userId} value={m.userId}>
              Paid by {m.email || m.userId}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!description.trim() || !(Number(amount) > 0)}>
          💸 Add expense (split equally)
        </button>
      </form>

      {data.settlements.length > 0 && (
        <div className="comment-item">
          <div className="question">
            <strong>Settle up</strong>
          </div>
          {data.settlements.map((s, i) => (
            <div key={i}>
              {nameOf(s.from)} → {nameOf(s.to)}: <strong>{fmt(s.amountCents, currency)}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="comments-list">
        {data.expenses.length === 0 ? (
          loadFailed ? null : <p className="empty">No expenses yet.</p>
        ) : (
          data.expenses.map((exp) => (
            <div key={exp._id} className="comment-item">
              <div className="question">
                <strong>{exp.description}</strong> — {fmt(exp.amountCents, exp.currency)}
                <span className="comment-meta">
                  paid by {nameOf(exp.paidBy)}, split {exp.splitAmong.length} ways
                </span>
                {exp.createdBy === currentUid && (
                  <button type="button" className="btn-danger btn-sm" onClick={() => remove(exp._id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
