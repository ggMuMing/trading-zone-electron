import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CreateNewFolderOutlined from '@mui/icons-material/CreateNewFolderOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import DriveFileRenameOutline from '@mui/icons-material/DriveFileRenameOutline'
import FolderOutlined from '@mui/icons-material/FolderOutlined'
import GroupAddOutlined from '@mui/icons-material/GroupAddOutlined'
import LabelOutlined from '@mui/icons-material/LabelOutlined'
import SelectAll from '@mui/icons-material/SelectAll'
import { useEffect, useMemo, useState } from 'react'
import { symbolGroupNameError } from '../../../../shared/symbolGroup/symbolGroup'
import type {
  SymbolGroupCategorySummary,
  SymbolGroupMember,
  SymbolGroupSummary,
  SymbolGroupTree
} from '../../../../shared/types/symbolGroup'
import type { Stock } from '../../../../shared/types/stock'
import { matchesStockQuery, pinyinInitials } from '../stockMatch'

type ActionNode =
  | { kind: 'uncategorized' }
  | { kind: 'category'; id: string }
  | { kind: 'group'; id: string }

type NamePrompt =
  | { mode: 'createCategory' }
  | { mode: 'createGroup' }
  | { mode: 'renameCategory'; id: string; initial: string }
  | { mode: 'renameGroup'; id: string; initial: string }

type DeletePrompt =
  | { kind: 'category'; id: string; name: string }
  | { kind: 'group'; id: string; name: string }

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function findCategory(tree: SymbolGroupTree, id: string): SymbolGroupCategorySummary | null {
  return tree.categories.find((item) => item.id === id) ?? null
}

function findGroup(tree: SymbolGroupTree, id: string): SymbolGroupSummary | null {
  for (const group of tree.uncategorized) {
    if (group.id === id) {
      return group
    }
  }
  for (const category of tree.categories) {
    const group = category.groups.find((item) => item.id === id)
    if (group) {
      return group
    }
  }
  return null
}

function parentCategoryId(tree: SymbolGroupTree, action: ActionNode | null): string | null {
  if (!action || action.kind === 'uncategorized') {
    return null
  }
  if (action.kind === 'category') {
    return action.id
  }
  return findGroup(tree, action.id)?.categoryId ?? null
}

const TREE_ICON_SX = { fontSize: 20 } as const

function TreeIcon({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>{children}</ListItemIcon>
}

function categoryRowSx(active: boolean): Record<string, unknown> {
  return {
    borderLeft: 3,
    borderColor: active ? 'text.secondary' : 'transparent',
    bgcolor: active ? 'action.hover' : 'transparent',
    pl: '6px',
    pr: 1
  }
}

export function GroupManagerDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const [tree, setTree] = useState<SymbolGroupTree | null>(null)
  const [stocks, setStocks] = useState<Stock[]>([])
  const [action, setAction] = useState<ActionNode | null>(null)
  const [contentGroupId, setContentGroupId] = useState<string | null>(null)
  const [members, setMembers] = useState<SymbolGroupMember[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [namePrompt, setNamePrompt] = useState<NamePrompt | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [deletePrompt, setDeletePrompt] = useState<DeletePrompt | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void Promise.all([window.api.symbolGroup.tree(), window.api.stocks.list()])
      .then(([nextTree, listed]) => {
        if (cancelled) {
          return
        }
        setTree(nextTree)
        setStocks(listed)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || !contentGroupId) {
      setMembers([])
      setChecked(new Set())
      return
    }
    let cancelled = false
    void window.api.symbolGroup
      .members({ groupId: contentGroupId })
      .then((rows) => {
        if (!cancelled) {
          setMembers(rows)
          setChecked(new Set())
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err))
          setMembers([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, contentGroupId])

  const initials = useMemo(() => {
    const map = new Map<string, string>()
    for (const stock of stocks) {
      map.set(stock.ts_code, pinyinInitials(stock.name))
    }
    return map
  }, [stocks])

  const matches = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) {
      return []
    }
    return stocks
      .filter((stock) => matchesStockQuery(stock, text, initials.get(stock.ts_code) ?? ''))
      .slice(0, 8)
  }, [stocks, query, initials])

  const contentGroup = tree && contentGroupId ? findGroup(tree, contentGroupId) : null
  const canRename = action?.kind === 'category' || action?.kind === 'group'
  const canDelete = canRename
  const allChecked = members.length > 0 && members.every((member) => checked.has(member.tsCode))

  const reloadTree = async (): Promise<SymbolGroupTree> => {
    const next = await window.api.symbolGroup.tree()
    setTree(next)
    if (contentGroupId && !findGroup(next, contentGroupId)) {
      setContentGroupId(null)
    }
    if (action?.kind === 'category' && !findCategory(next, action.id)) {
      setAction(null)
    }
    if (action?.kind === 'group' && !findGroup(next, action.id)) {
      setAction(null)
    }
    return next
  }

  const openName = (prompt: NamePrompt): void => {
    setNameDraft(prompt.mode === 'renameCategory' || prompt.mode === 'renameGroup' ? prompt.initial : '')
    setNameError(null)
    setNamePrompt(prompt)
  }

  const submitName = (): void => {
    if (!namePrompt || !tree || busy) {
      return
    }
    const kind = namePrompt.mode === 'createCategory' || namePrompt.mode === 'renameCategory' ? 'category' : 'group'
    const invalid = symbolGroupNameError(nameDraft, kind)
    if (invalid) {
      setNameError(invalid)
      return
    }
    setBusy(true)
    setError(null)
    setNameError(null)
    const task = (async (): Promise<void> => {
      if (namePrompt.mode === 'createCategory') {
        const created = await window.api.symbolGroup.createCategory({ name: nameDraft })
        await reloadTree()
        setAction({ kind: 'category', id: created.id })
        setContentGroupId(null)
      } else if (namePrompt.mode === 'createGroup') {
        const created = await window.api.symbolGroup.createGroup({
          categoryId: parentCategoryId(tree, action),
          name: nameDraft
        })
        await reloadTree()
        setAction({ kind: 'group', id: created.id })
        setContentGroupId(created.id)
      } else if (namePrompt.mode === 'renameCategory') {
        await window.api.symbolGroup.renameCategory({ id: namePrompt.id, name: nameDraft })
        await reloadTree()
      } else {
        await window.api.symbolGroup.renameGroup({ id: namePrompt.id, name: nameDraft })
        await reloadTree()
      }
      setNamePrompt(null)
    })()
    void task
      .catch((err: unknown) => {
        setNameError(errorMessage(err))
      })
      .finally(() => {
        setBusy(false)
      })
  }

  const submitDelete = (): void => {
    if (!deletePrompt || busy) {
      return
    }
    setBusy(true)
    setError(null)
    const task =
      deletePrompt.kind === 'category'
        ? window.api.symbolGroup.deleteCategory({ id: deletePrompt.id })
        : window.api.symbolGroup.deleteGroup({ id: deletePrompt.id })
    void task
      .then(async () => {
        setDeletePrompt(null)
        await reloadTree()
        setAction({ kind: 'uncategorized' })
        setContentGroupId(null)
      })
      .catch((err: unknown) => {
        setError(errorMessage(err))
      })
      .finally(() => {
        setBusy(false)
      })
  }

  const addStock = (stock: Stock): void => {
    if (!contentGroupId || busy) {
      return
    }
    if (members.some((member) => member.tsCode === stock.ts_code)) {
      setError('已在分组中')
      return
    }
    setBusy(true)
    setError(null)
    void window.api.symbolGroup
      .addMembers({
        groupId: contentGroupId,
        symbols: [{ tsCode: stock.ts_code, name: stock.name || stock.ts_code }]
      })
      .then(async () => {
        const rows = await window.api.symbolGroup.members({ groupId: contentGroupId })
        setMembers(rows)
        setQuery('')
        await reloadTree()
      })
      .catch((err: unknown) => {
        setError(errorMessage(err))
      })
      .finally(() => {
        setBusy(false)
      })
  }

  const removeChecked = (): void => {
    if (!contentGroupId || checked.size === 0 || busy) {
      return
    }
    setBusy(true)
    setError(null)
    void window.api.symbolGroup
      .removeMembers({ groupId: contentGroupId, tsCodes: [...checked] })
      .then(async () => {
        const rows = await window.api.symbolGroup.members({ groupId: contentGroupId })
        setMembers(rows)
        setChecked(new Set())
        await reloadTree()
      })
      .catch((err: unknown) => {
        setError(errorMessage(err))
      })
      .finally(() => {
        setBusy(false)
      })
  }

  const toggleChecked = (tsCode: string): void => {
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(tsCode)) {
        next.delete(tsCode)
      } else {
        next.add(tsCode)
      }
      return next
    })
  }

  const toggleAll = (): void => {
    setChecked(allChecked ? new Set() : new Set(members.map((member) => member.tsCode)))
  }

  const startRename = (): void => {
    if (!tree || !action) {
      return
    }
    if (action.kind === 'category') {
      const category = findCategory(tree, action.id)
      if (category) {
        openName({ mode: 'renameCategory', id: category.id, initial: category.name })
      }
      return
    }
    if (action.kind === 'group') {
      const group = findGroup(tree, action.id)
      if (group) {
        openName({ mode: 'renameGroup', id: group.id, initial: group.name })
      }
    }
  }

  const startDelete = (): void => {
    if (!tree || !action) {
      return
    }
    if (action.kind === 'category') {
      const category = findCategory(tree, action.id)
      if (category) {
        setDeletePrompt({ kind: 'category', id: category.id, name: category.name })
      }
      return
    }
    if (action.kind === 'group') {
      const group = findGroup(tree, action.id)
      if (group) {
        setDeletePrompt({ kind: 'group', id: group.id, name: group.name })
      }
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={busy ? undefined : onClose}
        maxWidth={false}
        slotProps={{
          paper: {
            sx: {
              width: 480,
              height: 560,
              maxWidth: 480,
              display: 'flex',
              flexDirection: 'column'
            }
          }
        }}
      >
        <DialogTitle sx={{ py: 1.25 }}>分类管理</DialogTitle>
        <DialogContent dividers sx={{ p: 0, display: 'flex', flex: 1, minHeight: 0 }}>
          <Box
            sx={{
              width: 220,
              flexShrink: 0,
              borderRight: 1,
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
              <Tooltip title="创建分类">
                <span>
                  <IconButton
                    size="small"
                    aria-label="创建分类"
                    disabled={busy}
                    onClick={() => openName({ mode: 'createCategory' })}
                  >
                    <CreateNewFolderOutlined fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="创建分组">
                <span>
                  <IconButton
                    size="small"
                    aria-label="创建分组"
                    disabled={busy || !tree}
                    onClick={() => openName({ mode: 'createGroup' })}
                  >
                    <GroupAddOutlined fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="修改名称">
                <span>
                  <IconButton size="small" aria-label="修改名称" disabled={busy || !canRename} onClick={startRename}>
                    <DriveFileRenameOutline fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="删除">
                <span>
                  <IconButton
                    size="small"
                    aria-label="删除"
                    color="error"
                    disabled={busy || !canDelete}
                    onClick={startDelete}
                  >
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {loading ? (
                <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
                  正在加载…
                </Typography>
              ) : (
                <List dense disablePadding>
                  <ListItemButton
                    selected={false}
                    disableGutters
                    sx={categoryRowSx(action?.kind === 'uncategorized')}
                    onClick={() => {
                      setAction({ kind: 'uncategorized' })
                      setContentGroupId(null)
                    }}
                  >
                    <TreeIcon>
                      <FolderOutlined sx={TREE_ICON_SX} />
                    </TreeIcon>
                    <ListItemText primary="未分类" primaryTypographyProps={{ noWrap: true }} />
                  </ListItemButton>
                  {tree?.uncategorized.map((group) => (
                    <ListItemButton
                      key={group.id}
                      selected={contentGroupId === group.id}
                      disableGutters
                      sx={{ pl: '28px', pr: 1 }}
                      onClick={() => {
                        setAction({ kind: 'group', id: group.id })
                        setContentGroupId(group.id)
                      }}
                    >
                      <TreeIcon>
                        <LabelOutlined sx={TREE_ICON_SX} />
                      </TreeIcon>
                      <ListItemText primary={group.name} primaryTypographyProps={{ noWrap: true }} />
                    </ListItemButton>
                  ))}
                  {tree?.categories.map((category) => (
                    <Box key={category.id}>
                      <ListItemButton
                        disableGutters
                        sx={categoryRowSx(action?.kind === 'category' && action.id === category.id)}
                        onClick={() => {
                          setAction({ kind: 'category', id: category.id })
                          setContentGroupId(null)
                        }}
                      >
                        <TreeIcon>
                          <FolderOutlined sx={TREE_ICON_SX} />
                        </TreeIcon>
                        <ListItemText
                          primary={category.isDefault ? `${category.name}（默认）` : category.name}
                          primaryTypographyProps={{ noWrap: true }}
                        />
                      </ListItemButton>
                      {category.groups.map((group) => (
                        <ListItemButton
                          key={group.id}
                          selected={contentGroupId === group.id}
                          disableGutters
                          sx={{ pl: '28px', pr: 1 }}
                          onClick={() => {
                            setAction({ kind: 'group', id: group.id })
                            setContentGroupId(group.id)
                          }}
                        >
                          <TreeIcon>
                            <LabelOutlined sx={TREE_ICON_SX} />
                          </TreeIcon>
                          <ListItemText primary={group.name} primaryTypographyProps={{ noWrap: true }} />
                        </ListItemButton>
                      ))}
                    </Box>
                  ))}
                </List>
              )}
            </Box>
          </Box>
          <Box
            sx={{
              width: 248,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0
            }}
          >
            {error ? (
              <Alert severity="error" sx={{ m: 1 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            ) : null}
            {contentGroup ? (
              <>
                <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center', px: 1, py: 0.75 }}>
                  <Autocomplete
                    size="small"
                    sx={{ width: 140 }}
                    options={matches}
                    value={null}
                    inputValue={query}
                    disabled={busy}
                    open={query.trim().length > 0}
                    forcePopupIcon={false}
                    clearOnBlur={false}
                    filterOptions={(options) => options}
                    getOptionLabel={(stock) => stock.name || stock.ts_code}
                    isOptionEqualToValue={(left, right) => left.ts_code === right.ts_code}
                    noOptionsText="无匹配标的"
                    onInputChange={(_event, value, reason) => {
                      if (reason === 'reset') {
                        setQuery('')
                        return
                      }
                      setQuery(value)
                    }}
                    onChange={(_event, stock) => {
                      if (stock) {
                        addStock(stock)
                        setQuery('')
                      }
                    }}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="搜索标的" />
                    )}
                    renderOption={(props, stock) => {
                      const { key, ...rest } = props
                      return (
                        <li key={key} {...rest}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" noWrap>
                              {stock.name || stock.ts_code}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {stock.ts_code}
                            </Typography>
                          </Box>
                        </li>
                      )
                    }}
                  />
                  <Tooltip title={allChecked ? '取消全选' : '全选'}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={allChecked ? '取消全选' : '全选'}
                        disabled={busy || members.length === 0}
                        onClick={toggleAll}
                      >
                        <SelectAll fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="删除">
                    <span>
                      <IconButton
                        size="small"
                        aria-label="删除"
                        color="error"
                        disabled={busy || checked.size === 0}
                        onClick={removeChecked}
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
                <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  {members.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
                      该分组还没有标的
                    </Typography>
                  ) : (
                    <List dense disablePadding>
                      {members.map((member) => (
                        <ListItemButton key={member.tsCode} onClick={() => toggleChecked(member.tsCode)}>
                          <Checkbox
                            size="small"
                            edge="start"
                            checked={checked.has(member.tsCode)}
                            tabIndex={-1}
                            disableRipple
                          />
                          <ListItemText primary={member.name} primaryTypographyProps={{ noWrap: true }} />
                        </ListItemButton>
                      ))}
                    </List>
                  )}
                </Box>
              </>
            ) : (
              <Box sx={{ px: 2, py: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {action?.kind === 'category'
                    ? '分类只在左侧改名或删除。点选其下的分组后，可以在这里管理标的。'
                    : action?.kind === 'uncategorized'
                      ? '这些分组还没有分类。点选分组后，可以在这里管理标的。'
                      : '请在左侧选择一个分组。'}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
      </Dialog>
      <Dialog open={namePrompt !== null} onClose={busy ? undefined : () => setNamePrompt(null)}>
        <DialogTitle>
          {namePrompt?.mode === 'createCategory'
            ? '创建分类'
            : namePrompt?.mode === 'createGroup'
              ? '创建分组'
              : '修改名称'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            margin="dense"
            label="名称"
            value={nameDraft}
            disabled={busy}
            onChange={(event) => {
              setNameDraft(event.target.value)
              setNameError(null)
            }}
            error={Boolean(nameError)}
            helperText={nameError ?? ' '}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submitName()
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setNamePrompt(null)}>
            取消
          </Button>
          <Button disabled={busy} onClick={submitName}>
            确定
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={deletePrompt !== null} onClose={busy ? undefined : () => setDeletePrompt(null)}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {deletePrompt?.kind === 'category'
              ? `删除分类「${deletePrompt.name}」后，其下分组将变为未分类。`
              : `删除分组「${deletePrompt?.name ?? ''}」后，其中的标的一并删除。`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setDeletePrompt(null)}>
            取消
          </Button>
          <Button color="error" disabled={busy} onClick={submitDelete}>
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
