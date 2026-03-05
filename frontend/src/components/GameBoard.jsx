/**
 * GameBoard — the in-game screen.
 *
 * mode="local"  → reads/writes useGameStore local* slice (REST)
 * mode="online" → reads/writes useGameStore online* slice (WebSocket)
 */

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import useGameStore from '../store/gameStore.js'
import OpponentStrip from './OpponentStrip.jsx'
import DiscardPile from './DiscardPile.jsx'
import PlayerHand from './PlayerHand.jsx'
import TurnTimer from './TurnTimer.jsx'
import GameLog from './GameLog.jsx'

// ── Celebration overlay (31 / instant win) ───────────────────────────────────
const SUITS = ['♠', '♥', '♦', '♣']
const SUIT_COLORS = { '♠': '#fff', '♥': '#ef4444', '♦': '#ef4444', '♣': '#fff' }

function CelebrationOverlay({ message, onDone }) {
  const pieces = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    suit: SUITS[i % 4],
    x: Math.random() * 100,
    delay: Math.random() * 0.6,
    rotate: Math.random() * 720 - 360,
    scale: 0.8 + Math.random() * 1.2,
  }))

  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Dark flash */}
      <motion.div
        className="absolute inset-0 bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0.4] }}
        transition={{ duration: 0.4 }}
      />

      {/* Falling suit symbols */}
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute text-2xl select-none"
          style={{ left: `${p.x}%`, color: SUIT_COLORS[p.suit], top: '-5%', fontSize: `${p.scale * 1.5}rem` }}
          initial={{ y: 0, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: 1.8 + Math.random() * 0.8, delay: p.delay, ease: 'easeIn' }}
        >
          {p.suit}
        </motion.span>
      ))}

      {/* Message banner */}
      <motion.div
        className="relative z-10 text-center px-8 py-6 rounded-3xl bg-black/80 border-2 border-yellow-400 shadow-glow"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 1.15, 1], opacity: 1 }}
        transition={{ duration: 0.5, type: 'spring', stiffness: 260, damping: 18 }}
      >
        <div className="text-6xl mb-2">🃏</div>
        <p className="text-yellow-300 font-bold text-2xl">{message}</p>
      </motion.div>
    </motion.div>
  )
}

// ── Pass-and-play handoff overlay ─────────────────────────────────────────────
function PassOverlay({ playerName, onConfirm }) {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6 gap-8"
      style={{ background: 'rgba(10,30,18,0.97)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-center"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <div className="text-5xl mb-4">📱</div>
        <h2 className="text-3xl font-bold mb-2">Pass the device</h2>
        <p className="text-white/50 text-lg">
          Hand it to <span className="text-white font-semibold">{playerName}</span>
        </p>
      </motion.div>

      <motion.button
        className="btn btn-primary btn-lg px-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={onConfirm}
        whileTap={{ scale: 0.95 }}
      >
        I'm {playerName} — Show my hand
      </motion.button>
    </motion.div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function GameBoard({ mode, onExit }) {
  const store = useGameStore()
  const [showLog, setShowLog] = useState(false)
  const [celebrating, setCelebrating] = useState(null)  // message string or null
  const lastMessageRef = useRef(null)

  const isLocal = mode === 'local'
  const game = isLocal ? store.localGame : store.onlineGame
  const myPlayerId = isLocal ? store.localPlayerId : store.onlineGamePlayerId

  // Watch for 31 / instant win messages
  useEffect(() => {
    if (!game?.recent_message) return
    const msg = game.recent_message
    if (msg === lastMessageRef.current) return
    lastMessageRef.current = msg
    if (msg.includes('31') || msg.toLowerCase().includes('instant win')) {
      setCelebrating(msg)
    }
  }, [game?.recent_message])

  if (!game) return null

  const me = game.players[myPlayerId]
  const isMyTurn = game.current_player_id === myPlayerId
  const hasDrawn = me?.hand?.length === 4
  const canDraw = isMyTurn && !hasDrawn && game.phase !== 'finished'
  const canKnock = isMyTurn && !hasDrawn && me && !me.has_knocked && game.phase !== 'final_round' && game.phase !== 'finished'
  const topDiscard = game.discard_pile?.[0] ?? null

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleDrawDeck = () => {
    if (isLocal) store.localDraw(false)
    else store.sendGameAction('draw', { from_discard: false })
  }

  const handleDrawDiscard = () => {
    if (isLocal) store.localDraw(true)
    else store.sendGameAction('draw', { from_discard: true })
  }

  const handleDiscard = (cardIndex) => {
    if (isLocal) store.localDiscard(cardIndex)
    else store.sendGameAction('discard', { card_index: cardIndex })
  }

  const handleKnock = () => {
    if (isLocal) store.localKnock()
    else store.sendGameAction('knock')
  }

  // ── Pass-and-play handoff ───────────────────────────────────────────────────
  const handoffPlayerId = isLocal ? store.localHandoffPlayerId : null
  const handoffName = handoffPlayerId ? game.players[handoffPlayerId]?.name : null

  // ── Game over ───────────────────────────────────────────────────────────────
  if (game.phase === 'finished') {
    const winner = game.winner_id ? game.players[game.winner_id] : null
    const iWon = game.winner_id === myPlayerId
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-6">
        <motion.div
          className="text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <div className="text-6xl mb-3">{iWon ? '🏆' : '💀'}</div>
          <h2 className="text-3xl font-bold mb-2">
            {iWon ? 'You Win!' : winner ? `${winner.name} Wins` : 'Game Over'}
          </h2>
          <p className="text-white/50">
            {iWon ? 'Last player standing.' : 'Better luck next time.'}
          </p>
        </motion.div>

        <div className="w-full max-w-sm space-y-2">
          {Object.values(game.players)
            .sort((a, b) => b.score - a.score)
            .map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.08 }}
                className={`flex items-center justify-between px-4 py-3 rounded-xl
                  ${p.id === game.winner_id ? 'bg-yellow-500/20 border border-yellow-500/40' : 'bg-white/5'}`}
              >
                <span className="font-medium">{p.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-white/50 text-sm">{p.score} pts</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 3 }, (_, idx) => (
                      <span key={idx} className={`life-dot ${idx < p.lives ? 'active' : 'lost'}`} />
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
        </div>

        <div className="flex gap-3">
          <button className="btn btn-secondary" onClick={onExit}>Menu</button>
          {isLocal && (
            <button
              className="btn btn-primary"
              onClick={() => { store.clearLocalGame(); window.location.href = '/local/setup' }}
            >
              Play Again
            </button>
          )}
        </div>

        <GameLog entries={game.game_log} />
      </div>
    )
  }

  const activeName = game.players[game.current_player_id]?.name ?? '…'
  const phase = game.phase

  return (
    <>
      <div className="min-h-screen flex flex-col gap-3 pb-6">
        {/* Opponents */}
        <div className="pt-4 pb-2 border-b border-white/10">
          <OpponentStrip
            players={game.players}
            currentPlayerId={game.current_player_id}
            myPlayerId={myPlayerId}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4">
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider">
              Round {game.round_number} · {phase === 'final_round' ? '🔴 Final round' : 'Playing'}
            </p>
            <p className="font-semibold text-sm mt-0.5">
              {isMyTurn ? 'Your turn' : `${activeName}'s turn`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isLocal && store.socketConnected && (
              <span className="w-2 h-2 rounded-full bg-green-400" title="Connected" />
            )}
            <TurnTimer
              timeRemaining={game.turn_time_remaining ?? 45}
              isMyTurn={isMyTurn}
              show={!isLocal || store.localUseTimer}
              onExpire={isLocal ? store.localTimeoutTurn : undefined}
            />
            <button className="btn btn-secondary btn-sm" onClick={onExit}>✕</button>
          </div>
        </div>

        {/* Announcement banner */}
        <AnimatePresence>
          {game.recent_message && (
            <motion.div
              key={game.recent_message}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-4 bg-yellow-500/20 border border-yellow-500/30 rounded-xl px-4 py-2 text-sm text-center text-yellow-200"
            >
              {game.recent_message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table */}
        <div className="flex-1 flex items-center justify-center py-4">
          <DiscardPile
            topCard={topDiscard}
            deckSize={game.deck_size}
            discardPileLength={game.discard_pile?.length ?? 0}
            canDraw={canDraw}
            onDrawDeck={handleDrawDeck}
            onDrawDiscard={handleDrawDiscard}
          />
        </div>

        {/* Your hand */}
        <div className="px-4">
          {me && (
            <PlayerHand
              player={me}
              isCurrentPlayer={true}
              isActivePlayer={isMyTurn}
              canInteract={isMyTurn}
              onDiscard={handleDiscard}
              gamePhase={phase}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4">
          <AnimatePresence>
            {canKnock && (
              <motion.button
                className="btn btn-danger flex-1"
                onClick={handleKnock}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                whileTap={{ scale: 0.93 }}
              >
                ✊ Knock
              </motion.button>
            )}
          </AnimatePresence>
          <button className="btn btn-secondary" onClick={() => setShowLog((v) => !v)}>
            {showLog ? 'Hide log' : '📋 Log'}
          </button>
        </div>

        {/* Game log */}
        <AnimatePresence>
          {showLog && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden px-4"
            >
              <GameLog entries={game.game_log} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pass-and-play handoff */}
      <AnimatePresence>
        {handoffName && (
          <PassOverlay
            key="handoff"
            playerName={handoffName}
            onConfirm={() => store.confirmLocalHandoff()}
          />
        )}
      </AnimatePresence>

      {/* 31 celebration */}
      <AnimatePresence>
        {celebrating && (
          <CelebrationOverlay
            key="celebration"
            message={celebrating}
            onDone={() => setCelebrating(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
