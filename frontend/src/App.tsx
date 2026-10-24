import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthProvider } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { AlertChannels } from './pages/AlertChannels'
import { Dashboard } from './pages/Dashboard'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { MonitorDetail } from './pages/MonitorDetail'
import { MonitorForm } from './pages/MonitorForm'
import { MonitorHistory } from './pages/MonitorHistory'
import { MonitorsList } from './pages/MonitorsList'
import { PublicStatus } from './pages/PublicStatus'
import { Register } from './pages/Register'
import './App.css'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Landing />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="monitors" element={<MonitorsList />} />
              <Route path="monitors/new" element={<MonitorForm />} />
              <Route path="monitors/:id/history" element={<MonitorHistory />} />
              <Route path="monitors/:id" element={<MonitorDetail />} />
              <Route path="monitors/:id/edit" element={<MonitorForm />} />
              <Route path="alerts" element={<AlertChannels />} />
              <Route path="s/:slug" element={<PublicStatus />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
