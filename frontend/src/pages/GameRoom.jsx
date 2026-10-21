import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore.js'
import GameBoard from '../components/GameBoard.jsx'
import Spinner from '../components/Spinner.jsx'

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

  // The host started a rematch: the table is back to waiting, so return to
  // the lobby with everyone else.
  useEffect(() => {
    if (table?.status === 'waiting' && !onlineGame) navigate('/online/table', { replace: true })
  }, [table?.status, onlineGame, navigate])

  if (!onlineGame) return <Spinner label={resuming ? 'Rejoining your table…' : 'Waiting for the game…'} />

  return (
    <GameBoard
      mode="online"
      onExit={async () => {
        await leaveTable()
        navigate('/')
      }}
    />
  )
}
