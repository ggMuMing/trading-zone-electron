import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SCRIPT_TITLE, defaultScriptParams } from '../../../../../shared/chart/indicatorScript'
import type { IndicatorScript, ScriptTryParams, ScriptTryResult } from '../../../../../shared/types/indicatorScript'
import type { MarketQueryParams } from '../../../../../shared/types/market'
import { ScriptSourceEditor } from './ScriptSourceEditor'

export interface ScriptDraft {
  id: string | null
  title: string
  source: string
}

export interface ScriptEditorPanelProps {
  draft: ScriptDraft
  scripts: IndicatorScript[]
  disabled?: boolean
  tryQuery: MarketQueryParams | null
  onDraftChange: (draft: ScriptDraft) => void
  onClose: () => void
  onCreateNew: () => void
  onTry: (params: ScriptTryParams) => Promise<ScriptTryResult>
  onCreate: (title: string, source: string) => Promise<IndicatorScript | null>
  onUpdate: (id: string, patch: { title: string; source: string }) => Promise<void>
  onRename: (id: string, title: string) => Promise<void>
}

type EditorBanner =
  | { type: 'success'; message: string }
  | { type: 'error'; error: string; traceback: string }

const EDITOR_WIDTH_STORAGE_KEY = 'trading-zone.chart.scriptEditorWidth'
const EDITOR_WIDTH_MIN = 320
const EDITOR_WIDTH_DEFAULT = 480

function clampEditorWidth(value: number, maxWidth: number): number {
  const max = Math.max(EDITOR_WIDTH_MIN, maxWidth)
  return Math.min(max, Math.max(EDITOR_WIDTH_MIN, Math.round(value)))
}

function loadEditorWidth(maxWidth: number): number {
  try {
    const raw = localStorage.getItem(EDITOR_WIDTH_STORAGE_KEY)
    if (!raw) {
      return clampEditorWidth(EDITOR_WIDTH_DEFAULT, maxWidth)
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      return clampEditorWidth(EDITOR_WIDTH_DEFAULT, maxWidth)
    }
    return clampEditorWidth(parsed, maxWidth)
  } catch {
    return clampEditorWidth(EDITOR_WIDTH_DEFAULT, maxWidth)
  }
}

export function ScriptEditorPanel({
  draft,
  scripts,
  disabled = false,
  tryQuery,
  onDraftChange,
  onClose,
  onCreateNew,
  onTry,
  onCreate,
  onUpdate,
  onRename
}: ScriptEditorPanelProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef(EDITOR_WIDTH_DEFAULT)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const keepResultForIdRef = useRef<string | null>(null)
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? EDITOR_WIDTH_DEFAULT : loadEditorWidth(window.innerWidth)
  )
  const [resizing, setResizing] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [customMenuAnchor, setCustomMenuAnchor] = useState<HTMLElement | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(draft.title)
  const [tryResult, setTryResult] = useState<ScriptTryResult | null>(null)
  const [banner, setBanner] = useState<EditorBanner | null>(null)
  const [tryBusy, setTryBusy] = useState(false)
  widthRef.current = width

  const applyTryResult = (result: ScriptTryResult, successMessage = '测试通过'): void => {
    setTryResult(result)
    if (result.ok) {
      setBanner({ type: 'success', message: successMessage })
      return
    }
    setBanner({
      type: 'error',
      error: result.error || '脚本失败',
      traceback: result.traceback ?? ''
    })
  }

  const closeMenus = (): void => {
    setMenuAnchor(null)
    setCustomMenuAnchor(null)
  }

  useEffect(() => {
    // Keep the publish feedback when a new script just got its id.
    if (keepResultForIdRef.current !== null && keepResultForIdRef.current === draft.id) {
      keepResultForIdRef.current = null
      return
    }
    keepResultForIdRef.current = null
    setTryResult(null)
    setBanner(null)
    setTryBusy(false)
  }, [draft.id])

  useEffect(() => {
    if (!resizing) {
      return
    }
    const previousCursor = document.body.style.cursor
    const previousSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelect
    }
  }, [resizing])

  const persistWidth = (value: number): void => {
    localStorage.setItem(EDITOR_WIDTH_STORAGE_KEY, String(value))
  }

  const maxWidthOf = (): number => hostRef.current?.parentElement?.clientWidth ?? window.innerWidth

  const handleSplitterPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = { startX: event.clientX, startWidth: width }
    setResizing(true)
  }

  const handleSplitterPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = resizeRef.current
    if (!drag) {
      return
    }
    setWidth(clampEditorWidth(drag.startWidth + (drag.startX - event.clientX), maxWidthOf()))
  }

  const handleSplitterPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!resizeRef.current) {
      return
    }
    resizeRef.current = null
    setResizing(false)
    persistWidth(widthRef.current)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleExecute = async (): Promise<void> => {
    if (!tryQuery) {
      return
    }
    setTryBusy(true)
    try {
      const loaded = await onTry({ source: draft.source })
      if (!loaded.ok) {
        applyTryResult(loaded)
        return
      }
      const result = await onTry({
        source: draft.source,
        params: loaded.manifest ? defaultScriptParams(loaded.manifest) : { inputs: {}, styles: {} },
        query: tryQuery
      })
      applyTryResult(result)
    } catch (err: unknown) {
      applyTryResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        traceback: '',
        line: null,
        column: null
      })
    } finally {
      setTryBusy(false)
    }
  }

  const handlePublish = async (): Promise<void> => {
    if (!draft.title.trim()) {
      return
    }
    setTryBusy(true)
    try {
      const result = await onTry({ source: draft.source })
      if (!result.ok) {
        applyTryResult(result)
        return
      }
      if (draft.id === null) {
        const created = await onCreate(draft.title, draft.source)
        if (created) {
          keepResultForIdRef.current = created.id
          applyTryResult(result, `新脚本${created.title}创建成功`)
          onDraftChange({ id: created.id, title: created.title, source: created.source })
        }
      } else {
        await onUpdate(draft.id, { title: draft.title, source: draft.source })
        applyTryResult(result)
      }
    } catch (err: unknown) {
      applyTryResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        traceback: '',
        line: null,
        column: null
      })
    } finally {
      setTryBusy(false)
    }
  }

  const handleSaveRename = async (): Promise<void> => {
    const nextTitle = renameValue.trim() || DEFAULT_SCRIPT_TITLE
    onDraftChange({ ...draft, title: nextTitle })
    if (draft.id) {
      await onRename(draft.id, nextTitle)
    }
    setRenameOpen(false)
  }

  return (
    <Box
      ref={hostRef}
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width,
        zIndex: 20,
        display: 'flex',
        bgcolor: 'background.paper',
        borderLeft: 1,
        borderColor: 'divider',
        boxShadow: 6
      }}
    >
      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label="调整脚本编辑器宽度"
        onPointerDown={handleSplitterPointerDown}
        onPointerMove={handleSplitterPointerMove}
        onPointerUp={handleSplitterPointerUp}
        onPointerCancel={handleSplitterPointerUp}
        sx={{
          width: 8,
          flexShrink: 0,
          cursor: 'col-resize',
          touchAction: 'none',
          '&::after': {
            content: '""',
            display: 'block',
            width: 2,
            height: '100%',
            mx: 'auto',
            bgcolor: resizing ? 'primary.main' : 'divider'
          },
          '&:hover::after': {
            bgcolor: 'primary.main'
          }
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography variant="subtitle2">脚本编辑器</Typography>
          <IconButton aria-label="关闭脚本编辑器" size="small" onClick={onClose} disabled={tryBusy}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
          sx={{ px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider' }}
        >
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
            <Button
              size="small"
              endIcon={<ArrowDropDownIcon />}
              disabled={tryBusy}
              onClick={(event) => setMenuAnchor(event.currentTarget)}
              sx={{ minWidth: 0, maxWidth: 220 }}
            >
              <Typography variant="body2" noWrap>
                {draft.title || DEFAULT_SCRIPT_TITLE}
              </Typography>
            </Button>
            <IconButton
              aria-label="执行脚本"
              size="small"
              disabled={disabled || tryBusy || !tryQuery}
              onClick={() => void handleExecute()}
            >
              <PlayArrowIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Button
            size="small"
            variant="contained"
            disabled={disabled || tryBusy || !draft.title.trim()}
            onClick={() => void handlePublish()}
          >
            发布脚本
          </Button>
        </Stack>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={closeMenus}
        >
          <MenuItem
            onClick={() => {
              setRenameValue(draft.title)
              setRenameOpen(true)
              closeMenus()
            }}
          >
            修改脚本名称
          </MenuItem>
          <MenuItem
            onClick={() => {
              closeMenus()
              setBanner(null)
              setTryResult(null)
              onCreateNew()
            }}
          >
            创建新指标
          </MenuItem>
          <MenuItem
            onClick={(event) => setCustomMenuAnchor(event.currentTarget)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 2 }}>
              自定义指标
              <ChevronRightIcon fontSize="small" />
            </Box>
          </MenuItem>
        </Menu>
        <Menu
          anchorEl={customMenuAnchor}
          open={Boolean(customMenuAnchor)}
          onClose={() => setCustomMenuAnchor(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          {scripts.length > 0 ? (
            scripts.map((script) => (
              <MenuItem
                key={script.id}
                selected={script.id === draft.id}
                onClick={() => {
                  onDraftChange({ id: script.id, title: script.title, source: script.source })
                  closeMenus()
                }}
              >
                {script.title}
              </MenuItem>
            ))
          ) : (
            <MenuItem disabled>还没有已创建的指标</MenuItem>
          )}
        </Menu>
        <ScriptSourceEditor
          value={draft.source}
          onChange={(source) => {
            setTryResult(null)
            setBanner(null)
            onDraftChange({ ...draft, source })
          }}
          diagnostic={
            tryResult && !tryResult.ok
              ? {
                  line: tryResult.line ?? null,
                  column: tryResult.column ?? null,
                  message: tryResult.error || '脚本失败'
                }
              : null
          }
          readOnly={tryBusy}
          sx={{ height: 'auto', flex: 1, minHeight: 0, border: 0, borderRadius: 0 }}
        />
        {banner?.type === 'success' ? (
          <Alert severity="success" sx={{ borderRadius: 0 }} onClose={() => setBanner(null)}>
            {banner.message}
          </Alert>
        ) : null}
        {banner?.type === 'error' ? (
          <Alert
            severity="error"
            sx={{ borderRadius: 0, whiteSpace: 'pre-wrap' }}
            onClose={() => {
              setBanner(null)
              setTryResult(null)
            }}
          >
            {banner.error}
            {banner.traceback ? `\n${banner.traceback}` : ''}
          </Alert>
        ) : null}
      </Box>
      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>修改脚本名称</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="脚本名称"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>取消</Button>
          <Button variant="contained" onClick={() => void handleSaveRename()}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
