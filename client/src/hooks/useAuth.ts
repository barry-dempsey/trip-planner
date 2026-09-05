import { useEffect, useState } from 'react'
import axios from 'axios'

interface User {
  uid: string
  email: string | null
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4001'

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    const userData = localStorage.getItem('user')
    if (token && userData) {
      setUser(JSON.parse(userData))
    }
    setLoading(false)
  }, [])

  const signup = async (email: string, password: string) => {
    try {
      setError(null)
      const response = await axios.post(`${apiUrl}/api/auth/signup`, {
        email,
        password,
      })
      const { uid, token } = response.data
      localStorage.setItem('authToken', token)
      const user = { uid, email }
      localStorage.setItem('user', JSON.stringify(user))
      setUser(user)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed'
      setError(message)
      return false
    }
  }

  const login = async (email: string, password: string) => {
    try {
      setError(null)
      const response = await axios.post(`${apiUrl}/api/auth/login`, {
        email,
        password,
      })
      const { uid, token } = response.data
      localStorage.setItem('authToken', token)
      const user = { uid, email }
      localStorage.setItem('user', JSON.stringify(user))
      setUser(user)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    setUser(null)
  }

  return { user, loading, error, login, signup, logout }
}
