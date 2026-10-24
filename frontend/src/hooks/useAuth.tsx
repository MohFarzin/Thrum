import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api, ensureCsrf } from '../api/client'
import type { User } from '../api/types'

type AuthState = {
  user: User | null
  loading: boolean
  refresh: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, email?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      await ensureCsrf()
      const me = await api<User>('/api/auth/me/')
      setUser(me)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const login = async (username: string, password: string) => {
    await ensureCsrf()
    const me = await api<User>('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setUser(me)
  }

  const register = async (username: string, password: string, email = '') => {
    await ensureCsrf()
    const me = await api<User>('/api/auth/register/', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    })
    setUser(me)
  }

  const logout = async () => {
    await api('/api/auth/logout/', { method: 'POST' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, refresh, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth requires AuthProvider')
  return ctx
}
