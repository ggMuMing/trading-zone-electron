import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import { screenGroupName } from '../../../../shared/symbolGroup/symbolGroup'
import type { SaveSymbolGroupHitsResult, SymbolGroupTree, SymbolRef } from '../../../../shared/types/symbolGroup'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function SaveGroupDialog({
  open,
  signalIso,
  strategyName,
  symbols,
  onClose,
  onSaved
}: {
  open: boolean
  signalIso: string
  strategyName: string
  symbols: SymbolRef[]
  onClose: () => void
  onSaved: (result: SaveSymbolGroupHitsResult) => void
}): React.JSX.Element {
  const [tree, setTree] = useState<SymbolGroupTree | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [makeDefault, setMakeDefault] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const groupName = screenGroupName(signalIso, strategyName)

  useEffect(() => {
    if (!open) {
      return
    }
    let cancelled = false
    setError(null)
    void window.api.symbolGroup
      .tree()
      .then((next) => {
        if (cancelled) {
          return
        }
        const selected = next.defaultCategoryId ?? ''
        setTree(next)
        setCategoryId(selected)
        setMakeDefault(selected === (next.defaultCategoryId ?? ''))
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const chooseCategory = (next: string): void => {
    setCategoryId(next)
    setMakeDefault(next === (tree?.defaultCategoryId ?? ''))
  }

  const save = (): void => {
    if (busy || symbols.length === 0) {
      return
    }
    setBusy(true)
    setError(null)
    void window.api.symbolGroup
      .saveHits({
        name: groupName,
        categoryId: categoryId || null,
        symbols,
        makeDefault
      })
      .then((result) => {
        onSaved(result)
        onClose()
      })
      .catch((err: unknown) => {
        setError(errorMessage(err))
      })
      .finally(() => {
        setBusy(false)
      })
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>保存为分组</DialogTitle>
      <DialogContent>
        <TextField
          size="small"
          fullWidth
          margin="dense"
          label="名称"
          value={groupName}
          slotProps={{ input: { readOnly: true } }}
        />
        <TextField
          select
          size="small"
          fullWidth
          margin="dense"
          label="分类"
          value={categoryId}
          disabled={!tree || busy}
          onChange={(event) => chooseCategory(event.target.value)}
        >
          <MenuItem value="">未分类</MenuItem>
          {tree?.categories.map((category) => (
            <MenuItem key={category.id} value={category.id}>
              {category.isDefault ? `${category.name}（默认）` : category.name}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={makeDefault}
              disabled={busy}
              onChange={(event) => setMakeDefault(event.target.checked)}
            />
          }
          label="设为默认分类"
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {symbols.length} 只标的
        </Typography>
        {error ? (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          取消
        </Button>
        <Button disabled={busy || !tree || symbols.length === 0} onClick={save}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}
