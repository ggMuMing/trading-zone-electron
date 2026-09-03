import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import {
  normalizeParams,
  defaultScriptParams,
  DEFAULT_SCRIPT_TITLE,
  formatIndicatorCaption,
  scriptDisplayKey
} from '../../../../shared/chart/indicatorScript'
import type { ChartLayout, ChartLayoutItem, LayoutItemParams } from '../../../../shared/types/chartLayout'
import type {
  IndicatorManifest,
  IndicatorScript,
  ParamField,
  ScriptTryParams,
  ScriptTryResult
} from '../../../../shared/types/indicatorScript'
import type { MarketQueryParams } from '../../../../shared/types/market'
import { ManifestFieldsForm } from './ManifestFieldsForm'
import { ScriptSourceEditor } from './scriptEditor/ScriptSourceEditor'

export interface IndicatorDialogProps {
  open: boolean
  exampleSource: string
  layout: ChartLayout | null
  scripts: IndicatorScript[]
  disabled?: boolean
  onClose: () => void
  onAdd: (ref: string) => void
  onRemove: (id: string) => void
  onUpdate: (id: string, params: LayoutItemParams) => void
  onCreateScript: (title: string, source: string) => void
  onUpdateScript: (id: string, patch: { title: string; source: string }) => void
  onRemoveScript: (id: string) => void
  tryQuery: MarketQueryParams | null
  onTry: (params: ScriptTryParams) => Promise<ScriptTryResult>
}

function paramsSummary(item: ChartLayoutItem, fields: ParamField[]): string {
  const numeric = fields.filter((field) => field.widget === 'int' || field.widget === 'float')
  if (numeric.length === 0) {
    return '用户脚本'
  }
  return numeric
    .map((field) => `${field.title} ${String(item.params.inputs[field.name] ?? '')}`)
    .join(' · ')
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString()
}

interface ScriptDraft {
  id: string | null
  title: string
  source: string
}

export function IndicatorDialog({
  open,
  exampleSource,
  layout,
  scripts,
  disabled = false,
  onClose,
  onAdd,
  onRemove,
  onUpdate,
  onCreateScript,
  onUpdateScript,
  onRemoveScript,
  tryQuery,
  onTry
}: IndicatorDialogProps): React.JSX.Element {
  const titleOf = (item: ChartLayoutItem): string => {
    const script = scripts.find((entry) => entry.id === item.ref)
    if (!script) {
      return '用户脚本'
    }
    return formatIndicatorCaption(scriptDisplayKey(script), script.title)
  }
  const referencedScripts = new Set((layout?.items ?? []).map((item) => item.ref))
  const [editing, setEditing] = useState<ChartLayoutItem | null>(null)
  const [draft, setDraft] = useState<LayoutItemParams | null>(null)
  const [scriptDraft, setScriptDraft] = useState<ScriptDraft | null>(null)
  const [tryResult, setTryResult] = useState<ScriptTryResult | null>(null)
  const [tryBusy, setTryBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setEditing(null)
      setDraft(null)
      setScriptDraft(null)
      setTryResult(null)
      setTryBusy(false)
    }
  }, [open])

  const resolveManifest = (item: ChartLayoutItem): IndicatorManifest | null => {
    return scripts.find((script) => script.id === item.ref)?.manifest ?? null
  }

  const fieldsOf = (item: ChartLayoutItem): ParamField[] => {
    return resolveManifest(item)?.fields ?? []
  }

  const openSettings = (item: ChartLayoutItem): void => {
    const manifest = resolveManifest(item)
    if (!manifest) {
      return
    }
    setEditing(item)
    setDraft(normalizeParams(manifest, item.params))
  }

  const closeSettings = (): void => {
    setEditing(null)
    setDraft(null)
  }

  const handleSave = (): void => {
    if (!editing || !draft) {
      return
    }
    onUpdate(editing.id, draft)
    closeSettings()
  }

  const openNewScript = (): void => {
    setTryResult(null)
    setScriptDraft({
      id: null,
      title: DEFAULT_SCRIPT_TITLE,
      source: exampleSource
    })
  }

  const openEditScript = (script: IndicatorScript): void => {
    setTryResult(null)
    setScriptDraft({ id: script.id, title: script.title, source: script.source })
  }

  const closeScriptEditor = (): void => {
    setScriptDraft(null)
    setTryResult(null)
    setTryBusy(false)
  }

  const handleSaveScript = async (): Promise<void> => {
    if (!scriptDraft || !scriptDraft.title.trim()) {
      return
    }
    setTryBusy(true)
    try {
      const result = await onTry({ source: scriptDraft.source })
      setTryResult(result)
      if (!result.ok) {
        return
      }
      if (scriptDraft.id === null) {
        onCreateScript(scriptDraft.title, scriptDraft.source)
      } else {
        onUpdateScript(scriptDraft.id, { title: scriptDraft.title, source: scriptDraft.source })
      }
      closeScriptEditor()
    } catch (err: unknown) {
      setTryResult({
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

  const handleRunOnce = async (): Promise<void> => {
    if (!scriptDraft || !tryQuery) {
      return
    }
    setTryBusy(true)
    try {
      const loaded = await onTry({ source: scriptDraft.source })
      if (!loaded.ok) {
        setTryResult(loaded)
        return
      }
      const result = await onTry({
        source: scriptDraft.source,
        params: loaded.manifest ? defaultScriptParams(loaded.manifest) : { inputs: {}, styles: {} },
        query: tryQuery
      })
      setTryResult(result)
    } catch (err: unknown) {
      setTryResult({
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

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>指标</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <div>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="subtitle2">用户脚本</Typography>
                <Button size="small" disabled={disabled || !exampleSource} onClick={openNewScript}>
                  新建
                </Button>
              </Stack>
              {scripts.length > 0 ? (
                <List dense disablePadding>
                  {scripts.map((script) => (
                    <ListItem
                      key={script.id}
                      disablePadding
                      secondaryAction={
                        <Stack direction="row" spacing={0.5}>
                          <Button
                            size="small"
                            disabled={disabled}
                            onClick={() => onAdd(script.id)}
                          >
                            添加
                          </Button>
                          <Button size="small" disabled={disabled} onClick={() => openEditScript(script)}>
                            编辑
                          </Button>
                          <Button
                            size="small"
                            color="inherit"
                            disabled={disabled || referencedScripts.has(script.id)}
                            onClick={() => onRemoveScript(script.id)}
                          >
                            删除
                          </Button>
                        </Stack>
                      }
                      sx={{ pr: 26 }}
                    >
                      <ListItemText
                        primary={formatIndicatorCaption(scriptDisplayKey(script), script.title)}
                        secondary={formatUpdatedAt(script.updatedAt)}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  还没有用户脚本
                </Typography>
              )}
            </div>
            <div>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                当前布局
              </Typography>
              {layout && layout.items.length > 0 ? (
                <List dense disablePadding>
                  {layout.items.map((item) => (
                    <ListItem
                      key={item.id}
                      disablePadding
                      secondaryAction={
                        <Stack direction="row" spacing={0.5}>
                          <Button size="small" disabled={disabled} onClick={() => openSettings(item)}>
                            设置
                          </Button>
                          <Button
                            size="small"
                            color="inherit"
                            disabled={disabled}
                            onClick={() => onRemove(item.id)}
                          >
                            删除
                          </Button>
                        </Stack>
                      }
                      sx={{ pr: 18 }}
                    >
                      <ListItemText primary={titleOf(item)} secondary={paramsSummary(item, fieldsOf(item))} />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  未添加指标，仅显示 K 线与成交量
                </Typography>
              )}
            </div>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>关闭</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(editing && draft)} onClose={closeSettings} fullWidth maxWidth="sm">
        <DialogTitle>设置 {editing ? titleOf(editing) : ''}</DialogTitle>
        <DialogContent dividers>
          {editing && draft && resolveManifest(editing) ? (
            <ManifestFieldsForm
              manifest={resolveManifest(editing)!}
              value={draft}
              onChange={(next) => setDraft(next)}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSettings}>取消</Button>
          <Button variant="contained" disabled={disabled} onClick={handleSave}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(scriptDraft)}
        onClose={tryBusy ? undefined : closeScriptEditor}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{scriptDraft?.id ? '编辑脚本' : '新建脚本'}</DialogTitle>
        <DialogContent dividers>
          {scriptDraft ? (
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              <TextField
                size="small"
                label="显示名"
                value={scriptDraft.title}
                onChange={(event) => setScriptDraft({ ...scriptDraft, title: event.target.value })}
                disabled={tryBusy}
              />
              <ScriptSourceEditor
                value={scriptDraft.source}
                onChange={(source) => {
                  setTryResult(null)
                  setScriptDraft({ ...scriptDraft, source })
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
              />
              {tryResult?.ok ? (
                <Alert severity="success">通过</Alert>
              ) : null}
              {tryResult && !tryResult.ok ? (
                <Alert severity="error" sx={{ whiteSpace: 'pre-wrap' }}>
                  {tryResult.error || '脚本失败'}
                  {tryResult.traceback ? `\n${tryResult.traceback}` : ''}
                </Alert>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeScriptEditor} disabled={tryBusy}>
            取消
          </Button>
          <Button
            disabled={disabled || tryBusy || !tryQuery}
            onClick={() => void handleRunOnce()}
          >
            跑一次
          </Button>
          <Button
            variant="contained"
            disabled={disabled || tryBusy || !scriptDraft?.title.trim()}
            onClick={() => void handleSaveScript()}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
