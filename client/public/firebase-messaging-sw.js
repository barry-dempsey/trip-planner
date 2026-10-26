/* global firebase, importScripts, self */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

// Config is passed as query params when the worker is registered
const params = new URL(self.location).searchParams
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  projectId: params.get('projectId'),
  appId: params.get('appId'),
  messagingSenderId: params.get('messagingSenderId'),
})

const messaging = firebase.messaging()

// Take over immediately instead of waiting for all open tabs to close
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

messaging.onBackgroundMessage((payload) => {
  console.log('[sw] push received', payload)
  const { title, body } = payload.notification || {}
  if (!title) return
  self.registration.showNotification(title, {
    body,
    data: { groupId: payload.data?.groupId, url: payload.data?.url },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data
  const groupId = data?.groupId || data?.FCM_MSG?.data?.groupId
  const url = data?.url || data?.FCM_MSG?.data?.url || (groupId ? `/trips/${groupId}` : '/trips')
  event.waitUntil(self.clients.openWindow(url))
})
