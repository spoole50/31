import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore.js'
import GameBoard from '../components/GameBoard.jsx'

export default function GameRoom() {
  const navigate = useNavigate()
  const { onlineGame, table, resuming, resumeTable, leaveTable } = useGameStore()

  // After a refresh, try to get back into the saved table before giving up
  useEffect(() => {
    if (!table) resumeTable()
  }, [])

  useEffect(() => {
    if (!table && !resuming) navigate('/online', { replace: true })
  }, [table, resuming, navigate])

  if (!onlineGame) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/50">Waiting for game state…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <GameBoard
        mode="online"
        onExit={async () => {
          await leaveTable()
          navigate('/')
        }}
      />
    </div>
  )
}
