import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type ThemeMode = 'light' | 'dark'

type ThemeContextValue = {
  theme: ThemeMode
  /** true when following OS preference (no manual override) */
  followsSystem: boolean
  setTheme: (mode: ThemeMode) => void
  clearOverride: () => void
  toggle: () => void
}

const STORAGE_KEY = 'thrum-theme'
const ThemeContext = createContext<ThemeContextValue | null>(null)

function systemTheme(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStored(): ThemeMode | null {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' ? v : null
}

function applyDom(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<ThemeMode | null>(() =>
    typeof window === 'undefined' ? null : readStored(),
  )
  const [system, setSystem] = useState<ThemeMode>(() =>
    typeof window === 'undefined' ? 'dark' : systemTheme(),
  )

  const theme = override ?? system

  useEffect(() => {
    applyDom(theme)
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setTheme = useCallback((mode: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, mode)
    setOverride(mode)
  }, [])

  const clearOverride = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setOverride(null)
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        followsSystem: override === null,
        setTheme,
        clearOverride,
        toggle,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme requires ThemeProvider')
  return ctx
}
