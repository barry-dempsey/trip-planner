import { useEffect, useState } from 'react'
import io, { Socket } from 'socket.io-client'

export function useSocket(token: string | null): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (!token) {
      setSocket(null)
      return
    }
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:4001', {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [token])

  return socket
}
