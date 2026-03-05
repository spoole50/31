import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore.js'
import GameBoard from '../components/GameBoard.jsx'

export default function GameRoom() {
  const navigate = useNavigate()
  const { onlineGame, table, leaveTable } = useGameStore()

  useEffect(() => {
    if (!table) navigate('/online', { replace: true })
  }, [table, navigate])

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
