/**
 * Global game state — Zustand store.
 *
 * Replaces the prop-drilling chain in v1's App.js.
 *
 * Two distinct slices:
 *   localGame   — single-player / pass-and-play (REST only, AI turns polled)
 *   onlineGame  — multiplayer table (REST for lobby + WebSocket for live play)
 *
 * Socket events are wired up here so any component can call store actions
 * without knowing whether the update came from a REST response or a socket push.
 */

import { create } from 'zustand'
import socket from '../lib/socket'

const API = import.meta.env.VITE_API_URL || ''

// ── Tiny fetch helper ─────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  // Seat token from create/join — proves we own our player id at the table
  const token = localStorage.getItem('playerToken')
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token && { 'X-Player-Token': token }) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // FastAPI validation errors (422) put a list of {msg, loc} in `detail`
    const detail = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail
    throw new Error(detail || data.error || 'Request failed')
  }
  return data
}

// ── Store ─────────────────────────────────────────────────────────────────────
const useGameStore = create((set, get) => ({
  // ── Local game ──────────────────────────────────────────────────────────────
  localGame: null,
  localPlayerId: null,
  localHandoffPlayerId: null,   // next human in pass-and-play waiting for device
  localLoading: false,
  localError: null,
  localUseTimer: false,

  startLocalGame: async (playerNames, numAI, aiDifficulties, useTimer = false) => {
    set({ localLoading: true, localError: null })
    try {
      const game = await api('/api/games', {
        method: 'POST',
        body: { player_names: playerNames, num_ai_players: numAI, ai_difficulties: aiDifficulties },
      })
      // Default view: first human player's perspective
      const firstHuman = Object.entries(game.players).find(([, p]) => !p.is_ai)
      const firstId = firstHuman ? firstHuman[0] : Object.keys(game.players)[0]
      set({ localGame: game, localPlayerId: firstId, localLoading: false, localUseTimer: useTimer })

      // Chain AI turns immediately if it starts on AI
      get()._maybeLocalAITurn(game)
    } catch (e) {
      set({ localLoading: false, localError: e.message })
    }
  },

  localDraw: async (fromDiscard) => {
    const { localGame, localPlayerId } = get()
    if (!localGame) return
    try {
      const game = await api(`/api/games/${localGame.game_id}/draw`, {
        method: 'POST',
        body: { player_id: localPlayerId, from_discard: fromDiscard },
      })
      set({ localGame: game })
    } catch (e) {
      set({ localError: e.message })
    }
  },

  localDiscard: async (cardIndex) => {
    const { localGame, localPlayerId } = get()
    if (!localGame) return
    try {
      const game = await api(`/api/games/${localGame.game_id}/discard`, {
        method: 'POST',
        body: { player_id: localPlayerId, card_index: cardIndex },
      })
      set({ localGame: game })
      get()._maybeLocalAITurn(game)
    } catch (e) {
      set({ localError: e.message })
    }
  },

  localKnock: async () => {
    const { localGame, localPlayerId } = get()
    if (!localGame) return
    try {
      const game = await api(`/api/games/${localGame.game_id}/knock`, {
        method: 'POST',
        body: { player_id: localPlayerId },
      })
      set({ localGame: game })
      get()._maybeLocalAITurn(game)
    } catch (e) {
      set({ localError: e.message })
    }
  },

  /** Force-skip the current player's turn when the local timer expires. */
  localTimeoutTurn: async () => {
    const { localGame } = get()
    if (!localGame) return
    try {
      const game = await api(`/api/games/${localGame.game_id}/timeout`, { method: 'POST' })
      set({ localGame: game })
      get()._maybeLocalAITurn(game)
    } catch (e) {
      set({ localError: e.message })
    }
  },

  /** Recursively play AI turns, then trigger pass-and-play handoff if needed. */
  _maybeLocalAITurn: async (game) => {
    if (!game || game.phase === 'finished') return
    const current = game.players[game.current_player_id]

    if (!current?.is_ai) {
      // It's a human's turn — if it's a different human, request handoff
      const { localPlayerId } = get()
      if (current && current.id !== localPlayerId) {
        set({ localHandoffPlayerId: current.id })
      }
      return
    }

    await new Promise((r) => setTimeout(r, 900))
    try {
      const next = await api(`/api/games/${game.game_id}/ai-turn`, { method: 'POST' })
      set({ localGame: next })
      get()._maybeLocalAITurn(next)
    } catch {
      // AI turn failed — ignore silently
    }
  },

  /** Confirm pass-and-play handoff — called when next player taps to reveal hand. */
  confirmLocalHandoff: () => {
    const { localHandoffPlayerId } = get()
    if (localHandoffPlayerId) {
      set({ localPlayerId: localHandoffPlayerId, localHandoffPlayerId: null })
    }
  },

  clearLocalGame: () => set({ localGame: null, localPlayerId: null, localHandoffPlayerId: null, localError: null, localUseTimer: false }),

  // ── Online / table ──────────────────────────────────────────────────────────
  // Rehydrate from localStorage so page refreshes don't lose player identity
  playerId: localStorage.getItem('playerId') || null,
  playerName: localStorage.getItem('playerName') || '',
  table: null,
  // True while a refreshed page is trying to get back into its saved table;
  // the lobby / game pages wait on this before redirecting away.
  resuming: !!localStorage.getItem('tableId'),
  onlineGame: null,
  onlineGamePlayerId: null,  // game-level player ID (different from table player ID)
  onlineError: null,
  onlineLoading: false,
  notice: null,                 // transient informational message for the toast
  disconnectedPlayers: [],
  socketConnected: false,
  _heartbeatInterval: null,

  setPlayerIdentity: (id, name) => {
    localStorage.setItem('playerId', id)
    localStorage.setItem('playerName', name)
    set({ playerId: id, playerName: name })
  },

  createTable: async (tableName, maxPlayers, isPrivate) => {
    const { playerId, playerName } = get()
    set({ onlineLoading: true, onlineError: null })
    try {
      const table = await api('/api/tables', {
        method: 'POST',
        body: { host_id: playerId, host_name: playerName, table_name: tableName, max_players: maxPlayers, is_private: isPrivate },
      })
      localStorage.setItem('tableId', table.table_id)
      localStorage.setItem('playerToken', table.player_token)
      set({ table, onlineLoading: false })
      get()._connectSocket(table.table_id)
    } catch (e) {
      set({ onlineLoading: false, onlineError: e.message })
    }
  },

  joinTable: async (inviteCode) => {
    const { playerId, playerName } = get()
    set({ onlineLoading: true, onlineError: null })
    try {
      const table = await api('/api/tables/join', {
        method: 'POST',
        body: { player_id: playerId, player_name: playerName, invite_code: inviteCode },
      })
      localStorage.setItem('tableId', table.table_id)
      localStorage.setItem('playerToken', table.player_token)
      set({ table, onlineLoading: false })
      get()._connectSocket(table.table_id)
    } catch (e) {
      set({ onlineLoading: false, onlineError: e.message })
    }
  },

  /**
   * After a page refresh, rejoin the table this browser was sitting at.
   *
   * The server keeps a dropped player seated for a 30 s grace period. If we
   * reconnect inside it, `join_table` re-registers our socket and the server
   * replays the current game state, so play continues where it left off.
   */
  resumeTable: async () => {
    const { playerId, table } = get()
    if (table || !playerId || !localStorage.getItem('tableId')) {
      set({ resuming: false })
      return
    }
    set({ resuming: true })
    try {
      const current = await api(`/api/player/${playerId}/table`)
      localStorage.setItem('tableId', current.table_id)
      set({ table: current, resuming: false })
      get()._connectSocket(current.table_id)
    } catch {
      // Grace period expired or the table is gone — nothing to resume
      localStorage.removeItem('tableId')
      localStorage.removeItem('playerToken')
      set({ resuming: false })
    }
  },

  leaveTable: async () => {
    const { playerId, table } = get()
    localStorage.removeItem('tableId')
    if (!table) {
      localStorage.removeItem('playerToken')
      return
    }
    try {
      await api(`/api/tables/${table.table_id}/leave`, {
        method: 'POST',
        body: { player_id: playerId },
      })
    } catch { /* best effort */ }
    localStorage.removeItem('playerToken')  // after the leave call, which needs it
    socket.emit('leave_table', { table_id: table.table_id, player_id: playerId })
    socket.disconnect()
    // Clean up heartbeat interval on leave
    const hb = get()._heartbeatInterval
    if (hb) clearInterval(hb)
    set({ table: null, onlineGame: null, socketConnected: false, disconnectedPlayers: [], _heartbeatInterval: null })
  },

  startOnlineGame: async () => {
    const { playerId, table } = get()
    if (!table) return
    set({ onlineLoading: true, onlineError: null })
    try {
      const updated = await api(`/api/tables/${table.table_id}/start`, {
        method: 'POST',
        body: { host_id: playerId },
      })
      set({ table: updated, onlineLoading: false })
    } catch (e) {
      set({ onlineLoading: false, onlineError: e.message })
    }
  },

  addAI: async (difficulty = 'medium') => {
    const { playerId, table } = get()
    if (!table) return
    try {
      const updated = await api(`/api/tables/${table.table_id}/add-ai`, {
        method: 'POST',
        body: { host_id: playerId, difficulty },
      })
      set({ table: updated })
    } catch (e) {
      set({ onlineError: e.message })
    }
  },

  sendGameAction: (action, params = {}) => {
    const { playerId, table } = get()
    if (!table) return
    socket.emit('game_action', {
      table_id: table.table_id,
      player_id: playerId,
      action,
      ...params,
    })
  },

  // ── Socket setup ──────────────────────────────────────────────────────────
  _connectSocket: (tableId) => {
    const { playerId, playerName } = get()

    // Remove all old listeners to prevent stacking on reconnect
    socket.off('connect')
    socket.off('disconnect')
    socket.off('table_updated')
    socket.off('game_updated')
    socket.off('player_disconnected')
    socket.off('turn_timeout')
    socket.off('error')

    // Clear any previous heartbeat interval
    const prevHeartbeat = get()._heartbeatInterval
    if (prevHeartbeat) {
      clearInterval(prevHeartbeat)
      set({ _heartbeatInterval: null })
    }

    // The seat token is read at send time so a reconnect always uses the
    // current one.
    const joinRoom = () => socket.emit('join_table', {
      table_id: tableId,
      player_id: playerId,
      player_name: playerName,
      player_token: localStorage.getItem('playerToken'),
    })

    // (Re)attach to the table on EVERY connect, not just the first. After an
    // automatic reconnect (network blip, or the socket dropping while a
    // refreshed page resumes) the new socket isn't mapped to this player until
    // it sends join_table, and the server would eliminate us when the
    // disconnect grace period runs out.
    socket.on('connect', () => {
      set({ socketConnected: true })
      joinRoom()
    })
    socket.on('disconnect', () => set({ socketConnected: false }))

    // Heartbeat every 10 seconds while connected. It keeps running across
    // reconnects and is cleared on leave or the next _connectSocket.
    const heartbeat = setInterval(() => {
      if (socket.connected) socket.emit('ping', { player_id: playerId })
    }, 10_000)
    set({ _heartbeatInterval: heartbeat })

    if (socket.connected) {
      // Already connected (no 'connect' event will fire) — attach directly
      joinRoom()
    } else {
      socket.connect()
    }

    socket.on('table_updated', (table) => set({ table }))

    socket.on('game_updated', (game) => {
      // Server sends `your_player_id` in each per-player payload
      set({ onlineGame: game, onlineGamePlayerId: game.your_player_id ?? null })
    })

    socket.on('player_disconnected', ({ player_id, player_name, new_host_id, may_reconnect }) => {
      // After a refresh we hear about our own old socket dropping — ignore it
      if (player_id === get().playerId) return
      set((s) => ({
        disconnectedPlayers: [...s.disconnectedPlayers, { player_id, player_name }],
        notice: may_reconnect
          ? `${player_name} disconnected — waiting for them to reconnect`
          : `${player_name} left the game`,
        // If host changed, update our local table optimistically
        table: s.table && new_host_id
          ? { ...s.table, host_id: new_host_id }
          : s.table,
      }))
    })

    socket.on('turn_timeout', ({ player_name }) => {
      set({ notice: `${player_name}'s turn timed out and was skipped` })
    })

    socket.on('error', ({ message }) => set({ onlineError: message }))
  },

  clearOnlineError: () => set({ onlineError: null }),
  clearNotice: () => set({ notice: null }),
}))

export default useGameStore
