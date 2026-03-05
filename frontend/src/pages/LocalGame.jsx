import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore.js'
import GameBoard from '../components/GameBoard.jsx'

export default function LocalGame() {
  const navigate = useNavigate()
  const { localGame, localPlayerId, clearLocalGame } = useGameStore()

  // Redirect to setup if no game (e.g. page refresh)
  useEffect(() => {
    if (!localGame) navigate('/local/setup', { replace: true })
  }, [localGame, navigate])

  if (!localGame) return null

  return (
    <div className="min-h-screen">
      <GameBoard
        mode="local"
        onExit={() => { clearLocalGame(); navigate('/') }}
      />
    </div>
  )
}
