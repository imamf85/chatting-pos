import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ActiveLapakProvider } from './hooks/useActiveLapak'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Order from './pages/Order'
import Rekap from './pages/Rekap'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ActiveLapakProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/order"
              element={
                <ProtectedRoute>
                  <Order />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rekap"
              element={
                <ProtectedRoute>
                  <Rekap />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/order" replace />} />
          </Routes>
        </ActiveLapakProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
