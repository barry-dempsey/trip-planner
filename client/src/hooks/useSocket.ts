import { useEffect, useRef, useState } from 'react'
import io, { Socket } from 'socket.io-client'

export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [])

  return socket
}
