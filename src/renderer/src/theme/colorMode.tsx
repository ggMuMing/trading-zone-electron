import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { APP_FONT_STACK } from './lwcFont'

export type ColorMode = 'light' | 'dark'

const STORAGE_KEY = 'tz.colorMode'

function readMode(): ColorMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function buildTheme(mode: ColorMode) {
  const dark = mode === 'dark'
  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? '#64b5f6' : '#1565c0' },
      background: {
        default: dark ? '#121417' : '#f5f7fa',
        paper: dark ? '#1c1f24' : '#ffffff'
      },
      ...(dark
        ? {
            text: { primary: '#e8e6e3', secondary: '#a39e96' },
            error: { main: '#ef5350' },
            success: { main: '#26a69a' }
          }
        : {})
    },
    typography: {
      fontFamily: APP_FONT_STACK
    }
  })
}

interface ColorModeContextValue {
  mode: ColorMode
  setMode: (mode: ColorMode) => void
}

const ColorModeContext = createContext<ColorModeContextValue | null>(null)

export function ColorModeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [mode, setModeState] = useState<ColorMode>(readMode)
  const setMode = useCallback((next: ColorMode) => {
    setModeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 隐私模式等无法写入时，本次会话仍切换。
    }
  }, [])
  const theme = useMemo(() => buildTheme(mode), [mode])
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode])
  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}

export function useColorMode(): ColorModeContextValue {
  const value = useContext(ColorModeContext)
  if (!value) {
    throw new Error('useColorMode must be used within ColorModeProvider')
  }
  return value
}
