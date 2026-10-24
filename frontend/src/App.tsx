import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthProvider } from './hooks/useAuth'
import { Dashboard } from './pages/Dashboard'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { MonitorDetail } from './pages/MonitorDetail'
import { MonitorForm } from './pages/MonitorForm'
import { MonitorsList } from './pages/MonitorsList'
import { Register } from './pages/Register'
import './App.css'

export default function App() {
  return (
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
            <Route path="monitors/:id" element={<MonitorDetail />} />
            <Route path="monitors/:id/edit" element={<MonitorForm />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
