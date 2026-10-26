import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
}
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

export type PushStatus = 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on'

export function usePushNotifications(apiUrl: string, authToken: string | null) {
  const [status, setStatus] = useState<PushStatus>('off')

  // Registers the service worker, fetches the device token and saves it for this user.
  // Safe to call repeatedly: the same worker and token are reused.
  const register = useCallback(async () => {
    const query = new URLSearchParams(config as Record<string, string>).toString()
    const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`)
    const app = getApps()[0] ?? initializeApp(config)
    const token = await getToken(getMessaging(app), {
      vapidKey,
      serviceWorkerRegistration: registration,
    })
    await axios.post(
      `${apiUrl}/api/notifications/token`,
      { token },
      { headers: { Authorization: `Bearer ${authToken}` } }
    )
    return getMessaging(app)
  }, [apiUrl, authToken])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      if (!(await isSupported().catch(() => false))) return setStatus('unsupported')
      if (!vapidKey || !config.messagingSenderId) return setStatus('unconfigured')
      if (Notification.permission === 'denied') return setStatus('denied')
      if (Notification.permission !== 'granted') return
      try {
        const messaging = await register()
        if (cancelled) return
        setStatus('on')
        // Foreground messages are not shown by the browser, so display them manually
        unsubscribe = onMessage(messaging, (payload) => {
          const { title, body } = payload.notification || {}
          if (title) new Notification(title, { body })
        })
      } catch (err) {
        console.error('Failed to register notifications:', err)
        if (!cancelled) setStatus('off')
      }
    })()
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [register])

  const enable = useCallback(async () => {
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return setStatus(permission === 'denied' ? 'denied' : 'off')
      await register()
      setStatus('on')
    } catch (err) {
      console.error('Failed to enable notifications:', err)
      setStatus('off')
    }
  }, [register])

  return { status, enable }
}
