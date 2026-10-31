import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect, useMemo, useState } from 'react'
import type { SymbolGroupSummary, SymbolGroupTree } from '../../../../shared/types/symbolGroup'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false
  }
  const ids = new Set(right)
  return left.every((id) => ids.has(id))
}

export function AssignGroupDialog({
  open,
  tsCode,
  name,
  onClose
}: {
  open: boolean
  tsCode: string
  name: string
  onClose: () => void
}): React.JSX.Element {
  const [tree, setTree] = useState<SymbolGroupTree | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [initial, setInitial] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    let cancelled = false
    setFilter('')
    setError(null)
    setConfirming(false)
    void Promise.all([window.api.symbolGroup.tree(), window.api.symbolGroup.membership({ tsCode })])
      .then(([nextTree, groupIds]) => {
        if (cancelled) {
          return
        }
        setTree(nextTree)
        setChecked(groupIds)
        setInitial(groupIds)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, tsCode])

  const groupsById = useMemo(() => {
    const map = new Map<string, SymbolGroupSummary>()
    if (!tree) {
      return map
    }
    for (const group of tree.uncategorized) {
      map.set(group.id, group)
    }
    for (const category of tree.categories) {
      for (const group of category.groups) {
        map.set(group.id, group)
      }
    }
    return map
  }, [tree])

  const query = filter.trim().toLowerCase()
  const sections = useMemo(() => {
    if (!tree) {
      return []
    }
    const blocks: Array<{ id: string; label: string; groups: SymbolGroupSummary[] }> = [
      { id: 'uncategorized', label: '未分类', groups: tree.uncategorized },
      ...tree.categories.map((category) => ({
        id: category.id,
        label: category.name,
        groups: category.groups
      }))
    ]
    if (!query) {
      return blocks.filter((block) => block.groups.length > 0)
    }
    return blocks
      .map((block) => {
        if (block.label.toLowerCase().includes(query)) {
          return block
        }
        return {
          ...block,
          groups: block.groups.filter((group) => group.name.toLowerCase().includes(query))
        }
      })
      .filter((block) => block.groups.length > 0)
  }, [tree, query])

  const toggle = (groupId: string): void => {
    setChecked((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]
    )
  }

  const checkedNames = checked
    .map((id) => groupsById.get(id)?.name)
    .filter((item): item is string => Boolean(item))
  const removedNames = initial
    .filter((id) => !checked.includes(id))
    .map((id) => groupsById.get(id)?.name)
    .filter((item): item is string => Boolean(item))

  const confirmText =
    checkedNames.length === 0
      ? `将把「${name}」从已有分组移出。`
      : removedNames.length > 0
        ? `将把「${name}」放入：${checkedNames.join('、')}。并从：${removedNames.join('、')} 移出。`
        : `将把「${name}」放入：${checkedNames.join('、')}。`

  const save = (): void => {
    if (busy) {
      return
    }
    setBusy(true)
    setError(null)
    void window.api.symbolGroup
      .setSymbolGroups({ tsCode, name, groupIds: checked })
      .then(() => {
        setConfirming(false)
        onClose()
      })
      .catch((err: unknown) => {
        setError(errorMessage(err))
        setConfirming(false)
      })
      .finally(() => {
        setBusy(false)
      })
  }

  return (
    <>
      <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
        <DialogTitle>加入分组</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {name}
          </Typography>
          <TextField
            size="small"
            fullWidth
            placeholder="按分组名称过滤"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          {error ? (
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              {error}
            </Typography>
          ) : null}
          <Box sx={{ mt: 1, maxHeight: 320, overflow: 'auto' }}>
            {sections.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {tree ? '没有匹配的分组' : '正在加载…'}
              </Typography>
            ) : (
              sections.map((section) => (
                <Box key={section.id}>
                  <Typography variant="caption" color="text.secondary" sx={{ px: 1, pt: 1, display: 'block' }}>
                    {section.label}
                  </Typography>
                  <List dense disablePadding>
                    {section.groups.map((group) => (
                      <ListItemButton key={group.id} onClick={() => toggle(group.id)}>
                        <Checkbox
                          size="small"
                          edge="start"
                          checked={checked.includes(group.id)}
                          tabIndex={-1}
                          disableRipple
                        />
                        <ListItemText primary={group.name} primaryTypographyProps={{ noWrap: true }} />
                      </ListItemButton>
                    ))}
                  </List>
                </Box>
              ))
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={busy || !tree || sameIds(checked, initial)}
            onClick={() => setConfirming(true)}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirming} onClose={busy ? undefined : () => setConfirming(false)}>
        <DialogTitle>确认分组</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{confirmText}</Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirming(false)}>
            取消
          </Button>
          <Button disabled={busy} onClick={save}>
            确定
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
