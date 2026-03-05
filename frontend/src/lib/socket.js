/**
 * Socket.IO singleton.
 *
 * Import `socket` wherever you need WebSocket access.
 * The connection is lazy — it only opens when socket.connect() is called
 * (done inside the Zustand store action `connectToTable`).
 */

import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || ''

const socket = io(API_URL, {
  // Don't auto-connect — we connect explicitly when entering a game room
  autoConnect: false,
  // Polling first: establishes connection immediately over plain HTTPS on any
  // host (CDN, App Runner, etc.). Socket.IO will upgrade to WebSocket once
  // the polling handshake succeeds, so we still get a persistent connection
  // when the server supports it.
  transports: ['polling', 'websocket'],
  // Reconnect automatically after network drops
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
})

// Dev-only logging
if (import.meta.env.DEV) {
  socket.on('connect', () => console.log('[socket] connected', socket.id))
  socket.on('disconnect', (reason) => console.log('[socket] disconnected', reason))
  socket.on('error', (err) => console.warn('[socket] server error', err))
}

export default socket
