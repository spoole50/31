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
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.error || 'Request failed')
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
  onlineGame: null,
  onlineGamePlayerId: null,  // game-level player ID (different from table player ID)
  onlineError: null,
  onlineLoading: false,
  disconnectedPlayers: [],
  socketConnected: false,

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
      set({ table, onlineLoading: false })
      get()._connectSocket(table.table_id)
    } catch (e) {
      set({ onlineLoading: false, onlineError: e.message })
    }
  },

  leaveTable: async () => {
    const { playerId, table } = get()
    if (!table) return
    try {
      await api(`/api/tables/${table.table_id}/leave`, {
        method: 'POST',
        body: { player_id: playerId },
      })
    } catch { /* best effort */ }
    socket.emit('leave_table', { table_id: table.table_id, player_id: playerId })
    socket.disconnect()
    set({ table: null, onlineGame: null, socketConnected: false, disconnectedPlayers: [] })
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
    socket.connect()

    socket.once('connect', () => {
      set({ socketConnected: true })
      socket.emit('join_table', { table_id: tableId, player_id: playerId, player_name: playerName })

      // Heartbeat every 10 seconds
      const heartbeat = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping', { player_id: playerId })
        } else {
          clearInterval(heartbeat)
        }
      }, 10_000)
    })

    socket.on('connect', () => set({ socketConnected: true }))
    socket.on('disconnect', () => set({ socketConnected: false }))

    socket.on('table_updated', (table) => set({ table }))

    socket.on('game_updated', (game) => {
      const { playerName } = get()
      const entry = Object.entries(game.players || {}).find(([, p]) => p.name === playerName)
      set({ onlineGame: game, onlineGamePlayerId: entry?.[0] ?? null })
    })

    socket.on('player_disconnected', ({ player_id, player_name, new_host_id }) => {
      set((s) => ({
        disconnectedPlayers: [...s.disconnectedPlayers, { player_id, player_name }],
        // If host changed, update our local table optimistically
        table: s.table && new_host_id
          ? { ...s.table, host_id: new_host_id }
          : s.table,
      }))
    })

    socket.on('turn_timeout', ({ player_name }) => {
      // Could show a toast — for now just log
      console.info(`[timeout] ${player_name}'s turn was skipped`)
    })

    socket.on('error', ({ message }) => set({ onlineError: message }))
  },

  clearOnlineError: () => set({ onlineError: null }),
}))

export default useGameStore
