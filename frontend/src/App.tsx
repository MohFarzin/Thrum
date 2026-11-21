import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAdmin, RequireApproved } from './components/RequireAuth'
import { AuthProvider } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { AdminUsers } from './pages/AdminUsers'
import { AlertChannels } from './pages/AlertChannels'
import { AuditLogs } from './pages/AuditLogs'
import { CircuitDetail } from './pages/CircuitDetail'
import { CircuitEdit } from './pages/CircuitEdit'
import { Circuits } from './pages/Circuits'
import { Dashboard } from './pages/Dashboard'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { MonitorDetail } from './pages/MonitorDetail'
import { MonitorForm } from './pages/MonitorForm'
import { MonitorHistory } from './pages/MonitorHistory'
import { PublicCircuit } from './pages/PublicCircuit'
import { PublicStatus } from './pages/PublicStatus'
import { Register } from './pages/Register'
import { WaitingApproval } from './pages/WaitingApproval'
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
              <Route path="waiting" element={<WaitingApproval />} />
              <Route
                path="admin"
                element={
                  <RequireAdmin>
                    <AdminUsers />
                  </RequireAdmin>
                }
              />
              <Route
                path="dashboard"
                element={
                  <RequireApproved>
                    <Dashboard />
                  </RequireApproved>
                }
              />
              <Route path="monitors" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="monitors/new"
                element={
                  <RequireApproved>
                    <MonitorForm />
                  </RequireApproved>
                }
              />
              <Route
                path="monitors/:id/history"
                element={
                  <RequireApproved>
                    <MonitorHistory />
                  </RequireApproved>
                }
              />
              <Route
                path="monitors/:id"
                element={
                  <RequireApproved>
                    <MonitorDetail />
                  </RequireApproved>
                }
              />
              <Route
                path="monitors/:id/edit"
                element={
                  <RequireApproved>
                    <MonitorForm />
                  </RequireApproved>
                }
              />
              <Route
                path="circuits"
                element={
                  <RequireApproved>
                    <Circuits />
                  </RequireApproved>
                }
              />
              <Route
                path="circuits/:id"
                element={
                  <RequireApproved>
                    <CircuitDetail />
                  </RequireApproved>
                }
              />
              <Route
                path="circuits/:id/edit"
                element={
                  <RequireApproved>
                    <CircuitEdit />
                  </RequireApproved>
                }
              />
              <Route
                path="alerts"
                element={
                  <RequireApproved>
                    <AlertChannels />
                  </RequireApproved>
                }
              />
              <Route
                path="logs"
                element={
                  <RequireApproved>
                    <AuditLogs />
                  </RequireApproved>
                }
              />
              <Route path="s/:slug" element={<PublicStatus />} />
              <Route path="c/:slug" element={<PublicCircuit />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
