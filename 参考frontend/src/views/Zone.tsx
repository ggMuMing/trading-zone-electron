import { useState, useRef, useEffect } from 'react'
import { Box, Paper } from '@mui/material'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSnapshot } from 'valtio'
import navState, { setIsCreateAccountDialogOpen } from './Nav/NavState'
import CreateAccountDialog from './Nav/CreateAccountDialog'
import Snackbar from '@mui/material/Snackbar'
import Nav from './Nav'
import type { NavRef } from './Nav/index'
import SymbolSearchDialog from '../components/ChartComponent/SymbolSearchDialog'
import globalSymbolSearchState, {
  closeSymbolSearch,
  openSymbolSearch,
  setGlobalSelectedStock,
} from '../state/globalSymbolSearchState'

function shouldIgnoreSymbolSearchHotkey(e: KeyboardEvent): boolean {
  const editorRootSelector = '.monaco-editor, .cm-editor, .CodeMirror'
  const formControlSelector = 'input, textarea, select, [contenteditable="true"]'

  const hitEditorOrForm = (el: Element | null) => {
    if (!el) return false
    return Boolean(el.closest(`${formControlSelector}, ${editorRootSelector}`))
  }

  for (const node of e.composedPath()) {
    if (node instanceof Element && hitEditorOrForm(node)) return true
  }

  const ae = document.activeElement
  if (ae instanceof Element && hitEditorOrForm(ae)) return true

  return false
}

interface State {
  open: boolean,
  message: string,
  severity: 'success' | 'error' | 'warning' | 'info'
}

function Zone() {
  const location = useLocation()
  const navigate = useNavigate()
  const symbolSearchSnap = useSnapshot(globalSymbolSearchState)
  const [theme] = useState('dark')
  const navRef = useRef<NavRef | null>(null)
  const snackbarLayout = {
    vertical: 'bottom' as const,
    horizontal: 'right' as const,
  }
  const [snackbarState, setSnackbarState] = useState<State>({
    open: false,
    message: 'Hello, world!',
    severity: 'success',
  } as State)
  const navStateSnapshot = useSnapshot(navState)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return
      if (symbolSearchSnap.symbolSearchOpen) return
      if (shouldIgnoreSymbolSearchHotkey(e)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.isComposing || e.repeat) return
      if (e.key.length !== 1) return
      e.preventDefault()
      openSymbolSearch({ seed: e.key })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [symbolSearchSnap.symbolSearchOpen])

  return (
    <Box id='trading-zone'>
      <Box sx={{ height: '100vh', overflow: 'hidden' }} className={theme === 'dark' ? 'dark-theme' : 'light-theme'}>
        <Box sx={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
          <Box
            sx={{
              flexShrink: 0,
              height: '100%',
              overflow: 'hidden',
            }}
          >
            <Nav ref={navRef} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
            <Paper elevation={1} sx={{
              height: '100%',
              borderRadius: 0,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--c-bacPri)',
              color: 'var(--c-texPri)'
            }}>
              <Box sx={{ height: '100%', overflow: 'hidden' }}>
                <Outlet />
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>

      <CreateAccountDialog isOpen={navStateSnapshot.isCreateAccountDialogOpen}
        onClose={(isSuccess: boolean): void => {
          setIsCreateAccountDialogOpen(false)
          if (isSuccess) {
            setSnackbarState({
              open: true,
              message: '账户创建成功',
              severity: 'success' as const
            })
            navRef.current?.refresh()
          } else {
            // setSnackbarState({ ...snackbarState, open: true, message: '账户创建失败', severity: 'error' as const })
          }
        }} />
      <Snackbar
        open={snackbarState.open}
        anchorOrigin={{ vertical: snackbarLayout.vertical, horizontal: snackbarLayout.horizontal }}
        autoHideDuration={3000}
        message={snackbarState.message}
        onClose={() => setSnackbarState({
          open: false,
          message: '',
          severity: 'success' as const
        })} />
      <SymbolSearchDialog
        open={symbolSearchSnap.symbolSearchOpen}
        onClose={() => closeSymbolSearch()}
        initialQuery={symbolSearchSnap.symbolSearchSeed}
        onSelect={(item) => {
          setGlobalSelectedStock(
            { symbol: item.symbol, name: item.name ?? '' },
            location.pathname === '/chart' ? 'chart-search' : 'global-search',
          )
          if (location.pathname !== '/chart') {
            navigate('/chart')
          }
        }}
      />
    </Box>
  )
}

export default Zone