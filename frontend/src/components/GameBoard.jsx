/**
 * GameBoard — the in-game screen.
 *
 * mode="local"  → reads/writes useGameStore local* slice (REST)
 * mode="online" → reads/writes useGameStore online* slice (WebSocket)
 *
 * Overlays (celebration, pass-and-play, game over) and the toast live in their
 * own components; this file owns layout, action wiring, and derived turn state.
 */

import { AnimatePresence } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore.js'
import OpponentStrip from './OpponentStrip.jsx'
import DiscardPile from './DiscardPile.jsx'
import PlayerHand from './PlayerHand.jsx'
import TurnTimer from './TurnTimer.jsx'
import GameLog from './GameLog.jsx'
import CelebrationOverlay from './CelebrationOverlay.jsx'
import PassOverlay from './PassOverlay.jsx'
import GameOverScreen from './GameOverScreen.jsx'
import Toast from './Toast.jsx'

const FULL_HAND = 4 // holding 4 cards means you have drawn and must discard

export default function GameBoard({ mode, onExit }) {
  const navigate = useNavigate()
  const store = useGameStore()
  const [showLog, setShowLog] = useState(false)
  const [celebrating, setCelebrating] = useState(null)
  const lastMessageRef = useRef(null)

  const isLocal = mode === 'local'
  const game = isLocal ? store.localGame : store.onlineGame
  const myPlayerId = isLocal ? store.localPlayerId : store.onlineGamePlayerId

  const { onlineError, clearOnlineError, notice, clearNotice } = store

  // Watch for 31 / instant-win messages
  useEffect(() => {
    if (!game?.recent_message) return
    const msg = game.recent_message
    if (msg === lastMessageRef.current) return
    lastMessageRef.current = msg
    if (msg.includes('31') || msg.toLowerCase().includes('instant win')) {
      setCelebrating(msg)
    }
  }, [game?.recent_message])

  const stopCelebrating = useCallback(() => setCelebrating(null), [])

  const handlePlayAgain = useCallback(() => {
    store.clearLocalGame()
    navigate('/local/setup', { replace: true })
  }, [store, navigate])

  if (!game) return null

  const me = game.players[myPlayerId]
  const isMyTurn = game.current_player_id === myPlayerId
  const hasDrawn = me?.hand?.length === FULL_HAND
  const isFinished = game.phase === 'finished'
  const canDraw = isMyTurn && !hasDrawn && !isFinished
  const canKnock =
    isMyTurn && !hasDrawn && me && !me.has_knocked &&
    game.phase !== 'final_round' && !isFinished
  const topDiscard = game.discard_pile?.[0] ?? null

  // ── Actions ─────────────────────────────────────────────────────────────────
  const act = (localFn, onlineAction, params) =>
    isLocal ? localFn() : store.sendGameAction(onlineAction, params)

  const handleDrawDeck = () => act(() => store.localDraw(false), 'draw', { from_discard: false })
  const handleDrawDiscard = () => act(() => store.localDraw(true), 'draw', { from_discard: true })
  const handleDiscard = (cardIndex) =>
    act(() => store.localDiscard(cardIndex), 'discard', { card_index: cardIndex })
  const handleKnock = () => act(() => store.localKnock(), 'knock')

  // ── Toast: socket errors take priority over informational notices ───────────
  const toast = onlineError
    ? { message: onlineError, tone: 'error', dismiss: clearOnlineError }
    : notice
      ? { message: notice, tone: 'info', dismiss: clearNotice }
      : null

  const toastNode = (
    <AnimatePresence>
      {toast && (
        <Toast
          key={toast.message}
          message={toast.message}
          tone={toast.tone}
          onDismiss={toast.dismiss}
        />
      )}
    </AnimatePresence>
  )

  if (isFinished) {
    return (
      <>
        <GameOverScreen
          game={game}
          myPlayerId={myPlayerId}
          isLocal={isLocal}
          onExit={onExit}
          onPlayAgain={handlePlayAgain}
        />
        {toastNode}
      </>
    )
  }

  const activeName = game.players[game.current_player_id]?.name ?? '…'
  const handoffPlayerId = isLocal ? store.localHandoffPlayerId : null
  const handoffName = handoffPlayerId ? game.players[handoffPlayerId]?.name : null

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
              Round {game.round_number} ·{' '}
              {game.phase === 'final_round' ? '🔴 Final round' : 'Playing'}
            </p>
            <p className="font-semibold text-sm mt-0.5">
              {isMyTurn ? 'Your turn' : `${activeName}'s turn`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isLocal && (
              <span
                className={`w-2 h-2 rounded-full ${
                  store.socketConnected ? 'bg-green-400' : 'bg-red-500 animate-pulse'
                }`}
                title={store.socketConnected ? 'Connected' : 'Reconnecting…'}
                role="status"
                aria-label={store.socketConnected ? 'Connected' : 'Reconnecting'}
              />
            )}
            <TurnTimer
              timeRemaining={game.turn_time_remaining ?? 45}
              isMyTurn={isMyTurn}
              show={!isLocal || store.localUseTimer}
              onExpire={isLocal ? store.localTimeoutTurn : undefined}
            />
            {/* btn-sm is 2rem tall — under the 44px WCAG target size, and this
                is the one destructive control on the screen. */}
            <button
              className="btn btn-secondary w-11 h-11 p-0"
              onClick={onExit}
              aria-label="Leave game"
              title="Leave game"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Announcement banner.
            The slot is always in the tree at a fixed height: mounting and
            unmounting it pushed the table, hand and action row down and back
            up every time the server sent a message. */}
        <div className="mx-4 min-h-[2.25rem]" role="status" aria-live="polite">
          {game.recent_message && (
            <div className="bg-gold/20 border border-gold/30 rounded-xl px-4 py-2 text-sm text-center text-gold-light">
              {game.recent_message}
            </div>
          )}
        </div>

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
              gamePhase={game.phase}
            />
          )}
        </div>

        {/* Actions.
            Knock is always rendered, disabled when unavailable, so the row
            keeps its shape — previously it appeared and vanished each turn and
            shunted the log button sideways. Keeping it visible also shows the
            action exists before it first becomes legal. */}
        <div className="flex gap-2 px-4">
          <button
            className="btn btn-danger flex-1"
            onClick={handleKnock}
            disabled={!canKnock}
            title={canKnock ? 'End the round — everyone else gets one last turn' : 'You can only knock on your turn, before drawing'}
          >
            ✊ Knock
          </button>
          <button
            className="btn btn-secondary w-24"
            onClick={() => setShowLog((v) => !v)}
            aria-expanded={showLog}
          >
            {showLog ? 'Hide' : '📋 Log'}
          </button>
        </div>

        {/* Game log */}
        {showLog && (
          <div className="px-4">
            <GameLog entries={game.game_log} />
          </div>
        )}
      </div>

      <AnimatePresence>
        {handoffName && (
          <PassOverlay
            key="handoff"
            playerName={handoffName}
            onConfirm={store.confirmLocalHandoff}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {celebrating && (
          <CelebrationOverlay
            key="celebration"
            message={celebrating}
            onDone={stopCelebrating}
          />
        )}
      </AnimatePresence>

      {toastNode}
    </>
  )
}
