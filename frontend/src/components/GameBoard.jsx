/**
 * GameBoard — the in-game screen.
 *
 * mode="local"  → reads/writes useGameStore local* slice (REST)
 * mode="online" → reads/writes useGameStore online* slice (WebSocket)
 *
 * Overlays (round summary, celebration, pass-and-play, game over, dialogs)
 * and the toast live in their own components; this file owns layout, action
 * wiring, and derived turn state.
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
import RoundSummary from './RoundSummary.jsx'
import RulesModal from './RulesModal.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import Toast from './Toast.jsx'

const FULL_HAND = 4 // holding 4 cards means you have drawn and must discard
const TURN_SECONDS = 45

export default function GameBoard({ mode, onExit }) {
  const navigate = useNavigate()
  const store = useGameStore()
  const [showLog, setShowLog] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [celebrating, setCelebrating] = useState(null)
  const [roundSummary, setRoundSummary] = useState(null)

  const isLocal = mode === 'local'
  const game = isLocal ? store.localGame : store.onlineGame
  const myPlayerId = isLocal ? store.localPlayerId : store.onlineGamePlayerId

  // ── Round transitions ───────────────────────────────────────────────────────
  // The server redeals as soon as a round ends, so the only trace of the
  // result is `last_round`. Show it when a new one arrives. Seeded with the
  // value at mount so rejoining mid-game doesn't replay an old round.
  //
  // This also drives the 31 celebration. It used to watch `recent_message`
  // for "31", but the redeal clears that message in the same update, so the
  // celebration could never fire.
  const lastRound = game?.last_round ?? null
  const seenRoundRef = useRef(lastRound?.round_number ?? null)
  useEffect(() => {
    if (!lastRound || lastRound.round_number === seenRoundRef.current) return
    seenRoundRef.current = lastRound.round_number
    if (game.phase !== 'finished') setRoundSummary(lastRound)
    const winnerId = lastRound.instant_winner_id
    if (winnerId) {
      const who = winnerId === myPlayerId ? 'You' : game.players[winnerId]?.name ?? 'Someone'
      setCelebrating(`${who} hit 31!`)
    }
  }, [lastRound?.round_number]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const isFinalRound = game.phase === 'final_round'
  const canDraw = isMyTurn && !hasDrawn && !isFinished
  const canKnock = isMyTurn && !hasDrawn && me && !me.has_knocked && !isFinalRound && !isFinished
  const topDiscard = game.discard_pile?.[0] ?? null
  const handoffPlayerId = isLocal ? store.localHandoffPlayerId : null
  const handoffName = handoffPlayerId ? game.players[handoffPlayerId]?.name : null
  // Pass-and-play: "you" is just whoever holds the device right now
  const sharedDevice = isLocal && Object.values(game.players).filter((p) => !p.is_ai).length > 1

  // ── Actions ─────────────────────────────────────────────────────────────────
  const act = (localFn, onlineAction, params) =>
    isLocal ? localFn() : store.sendGameAction(onlineAction, params)

  const handleDrawDeck = () => act(() => store.localDraw(false), 'draw', { from_discard: false })
  const handleDrawDiscard = () => act(() => store.localDraw(true), 'draw', { from_discard: true })
  const handleDiscard = (cardIndex) =>
    act(() => store.localDiscard(cardIndex), 'discard', { card_index: cardIndex })
  const handleKnock = () => act(() => store.localKnock(), 'knock')

  // ── Toast: errors take priority over informational notices ──────────────────
  // Local-mode errors used to be rendered only on the setup page, so a failed
  // move mid-game did nothing visible at all.
  const error = isLocal ? store.localError : store.onlineError
  const clearError = isLocal ? store.clearLocalError : store.clearOnlineError
  const toast = error
    ? { message: error, tone: 'error', dismiss: clearError }
    : store.notice
      ? { message: store.notice, tone: 'info', dismiss: store.clearNotice }
      : null

  const overlays = (
    <>
      <AnimatePresence>
        {celebrating && (
          <CelebrationOverlay key="celebration" message={celebrating} onDone={stopCelebrating} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <Toast key={toast.message} message={toast.message} tone={toast.tone} onDismiss={toast.dismiss} />
        )}
      </AnimatePresence>
    </>
  )

  if (isFinished) {
    const isHost = !isLocal && store.table?.host_id === store.playerId
    return (
      <>
        <GameOverScreen
          game={game}
          myPlayerId={myPlayerId}
          isLocal={isLocal}
          onExit={onExit}
          onPlayAgain={isLocal ? handlePlayAgain : isHost ? store.restartOnlineGame : undefined}
          playAgainLabel={isLocal ? 'Play again' : 'Rematch'}
          busy={!isLocal && store.onlineLoading}
        />
        {overlays}
      </>
    )
  }

  const activeName = game.players[game.current_player_id]?.name ?? '…'
  const hint = isMyTurn
    ? canKnock ? 'Draw a card, or knock to end the round' : 'Draw from the deck or the discard pile'
    : `Waiting for ${activeName}…`
  const showTimer = !isLocal || store.localUseTimer

  return (
    <>
      <div className="flex-1 w-full max-w-2xl mx-auto flex flex-col gap-3 pb-4">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 px-4 pt-3">
          <div className="min-w-0">
            <p className="text-white/60 text-xs uppercase tracking-wider">
              Round {game.round_number}
              {isFinalRound && <span className="text-orange-300"> · Final round</span>}
            </p>
            <p className="font-semibold text-sm mt-0.5 truncate" aria-live="polite">
              {isMyTurn ? 'Your turn' : `${activeName}'s turn`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isLocal && !store.socketConnected && (
              <span className="badge bg-red-500/20 text-red-300 animate-pulse" role="status">
                Reconnecting…
              </span>
            )}
            {showTimer && (
              <TurnTimer
                key={`${game.round_number}:${game.current_player_id}`}
                // Local play is timed entirely on the client (the timeout
                // endpoint ignores the server clock), so start every turn
                // fresh and pause it while the device is being passed or the
                // round summary is up. Online follows the server's clock.
                timeRemaining={isLocal ? TURN_SECONDS : game.turn_time_remaining ?? TURN_SECONDS}
                running={isLocal ? isMyTurn && !handoffName && !roundSummary : true}
                isMyTurn={isMyTurn}
                onExpire={isLocal ? store.localTimeoutTurn : undefined}
              />
            )}
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => setShowRules(true)}
              aria-label="How to play"
              title="How to play"
            >
              ?
            </button>
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => setConfirmLeave(true)}
              aria-label="Leave game"
              title="Leave game"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Opponents */}
        <OpponentStrip
          players={game.players}
          currentPlayerId={game.current_player_id}
          myPlayerId={myPlayerId}
        />

        {/* Table. The announcement lives inside this flex-1 area, which
            absorbs its height, so a server message never pushes the hand or
            action row around — without reserving an empty slot all game for
            what is in practice only the knock announcement. */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-2">
          <div role="status" aria-live="polite" className="px-4">
            {game.recent_message && (
              <p className="bg-gold/15 border border-gold/30 rounded-full px-4 py-1.5 text-sm text-center text-gold-light">
                {game.recent_message}
              </p>
            )}
          </div>
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
          {me ? (
            <PlayerHand
              player={me}
              isActivePlayer={isMyTurn}
              canInteract={isMyTurn}
              onDiscard={handleDiscard}
              gamePhase={game.phase}
              hint={me.is_eliminated ? "You're out — watching the rest of the game" : hint}
            />
          ) : (
            <p className="text-center text-white/60 text-sm">Spectating</p>
          )}
        </div>

        {/* Actions. Knock is always rendered, disabled when unavailable, so
            the row keeps its shape and shows the action exists before it
            first becomes legal. */}
        <div className="flex gap-2 px-4">
          <button
            className="btn btn-danger flex-1"
            onClick={handleKnock}
            disabled={!canKnock}
            title={canKnock ? 'End the round — everyone else gets one last turn' : 'You can only knock on your turn, before drawing'}
          >
            <span aria-hidden="true">✊</span> Knock
          </button>
          <button
            className="btn btn-secondary w-28"
            onClick={() => setShowLog((v) => !v)}
            aria-expanded={showLog}
            aria-controls="game-log"
          >
            {showLog ? 'Hide log' : 'Game log'}
          </button>
        </div>

        {showLog && (
          <div className="px-4" id="game-log">
            <GameLog entries={game.game_log} />
          </div>
        )}
      </div>

      <AnimatePresence>
        {handoffName && !roundSummary && (
          <PassOverlay
            key="handoff"
            playerName={handoffName}
            onConfirm={store.confirmLocalHandoff}
          />
        )}
      </AnimatePresence>

      {roundSummary && (
        <RoundSummary
          round={roundSummary}
          players={game.players}
          myPlayerId={sharedDevice ? null : myPlayerId}
          onClose={() => setRoundSummary(null)}
        />
      )}

      <RulesModal open={showRules} onClose={() => setShowRules(false)} />

      <ConfirmDialog
        open={confirmLeave}
        title="Leave this game?"
        message={isLocal
          ? 'The game will end and your progress will be lost.'
          : "You'll give up your seat and can't rejoin this game."}
        confirmLabel="Leave"
        cancelLabel="Keep playing"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => { setConfirmLeave(false); onExit() }}
      />

      {overlays}
    </>
  )
}
