import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App.tsx'
import './index.css'

// An expired or invalid token on a protected call means the session is over
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url || ''
    const isAuthCall = url.includes('/api/auth/')
    if (error.response?.status === 401 && !isAuthCall && localStorage.getItem('authToken')) {
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      window.location.assign('/')
    }
    return Promise.reject(error)
  }
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
