import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import MainMenu from './pages/MainMenu.jsx'
import LocalSetup from './pages/LocalSetup.jsx'
import LocalGame from './pages/LocalGame.jsx'
import OnlineLobby from './pages/OnlineLobby.jsx'
import TableLobby from './pages/TableLobby.jsx'
import GameRoom from './pages/GameRoom.jsx'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/local/setup" element={<LocalSetup />} />
        <Route path="/local/game" element={<LocalGame />} />
        <Route path="/online" element={<OnlineLobby />} />
        <Route path="/online/table" element={<TableLobby />} />
        <Route path="/online/game" element={<GameRoom />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}
