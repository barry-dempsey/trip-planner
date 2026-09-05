import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useSocket } from './hooks/useSocket'
import { useAuth } from './hooks/useAuth'
import Auth from './pages/Auth'
import TripPlanner from './pages/TripPlanner'
import TripDetail from './pages/TripDetail'
import './App.css'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('authToken')
  return token ? <>{children}</> : <Navigate to="/" />
}

function AppHeader() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const socket = useSocket()
  const token = localStorage.getItem('authToken')

  useEffect(() => {
    if (socket) {
      setIsConnected(socket.connected)
      socket.on('connect', () => setIsConnected(true))
      socket.on('disconnect', () => setIsConnected(false))
    }
  }, [socket])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header>
      <div className="header-content">
        <h1>Trip Planner</h1>
        {token && (
          <div className="header-actions">
            <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

export default function App() {
  return (
    <Router>
      <div className="app">
        <AppHeader />
        <main>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route
              path="/trips"
              element={
                <ProtectedRoute>
                  <TripPlanner />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trips/:groupId"
              element={
                <ProtectedRoute>
                  <TripDetail />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </Router>
  )
}
