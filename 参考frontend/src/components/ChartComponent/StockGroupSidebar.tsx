import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import SearchIcon from '@mui/icons-material/Search'
import {
  Box,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Stock, StockGroup } from '../../api/apiType'
import {
  addStocksToStockGroup,
  createStockGroup,
  deleteStockGroup,
  getStockGroupStocks,
  getStockGroups,
  removeStockFromStockGroup,
  reorderStockGroupStocks,
  updateStockGroup,
} from '../../api/api'
import type { SymbolSelectionSource } from '../../state/globalSymbolSearchState'
import { StyledButton, StyledDialog, StyledTextField } from '../styled'
import SymbolSearchDialog from './SymbolSearchDialog'

const ALL_GROUP_ID = '__all__'

const toListSymbolKey = (symbol: string) => {
  const base = symbol.split('.')[0]
  return base || symbol
}

const isElementFullyVisibleInContainer = (element: HTMLElement, container: HTMLElement) => {
  const elementRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  return (
    elementRect.top >= containerRect.top
    && elementRect.bottom <= containerRect.bottom
  )
}

const scrollElementToContainerCenter = (element: HTMLElement, container: HTMLElement) => {
  const nextTop = element.offsetTop - (container.clientHeight / 2) + (element.offsetHeight / 2)
  container.scrollTop = Math.max(0, nextTop)
}

type StockGroupSidebarProps = {
  selectedSymbol: string
  selectionSource: SymbolSelectionSource | null
  onSelectStock: (stock: Stock | null) => void
  /** 外部修改分组成员后递增，用于刷新当前列表 */
  stocksRefreshKey?: number
}

type GroupNameDialogMode = 'create' | 'rename' | null

export default function StockGroupSidebar(props: StockGroupSidebarProps) {
  const { selectedSymbol, selectionSource, onSelectStock, stocksRefreshKey = 0 } = props
  const [groups, setGroups] = useState<StockGroup[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string>(ALL_GROUP_ID)
  const [stocks, setStocks] = useState<Stock[]>([])
  const [filterQuery, setFilterQuery] = useState('')
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [loadingStocks, setLoadingStocks] = useState(false)
  const [stocksLoaded, setStocksLoaded] = useState(false)
  const [groupDialogMode, setGroupDialogMode] = useState<GroupNameDialogMode>(null)
  const [groupNameInput, setGroupNameInput] = useState('')
  const [addStockOpen, setAddStockOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const listScrollRef = useRef<HTMLDivElement | null>(null)
  const prevFilterQueryRef = useRef(filterQuery)
  const initializedDefaultSelectionRef = useRef(false)
  const selectFirstStockOnGroupChangeRef = useRef(false)
  const pendingScrollModeRef = useRef<'top' | 'center' | null>(null)
  const handledSearchKeyRef = useRef('')

  const activeGroup = useMemo(
    () => groups.find((group) => group.group_id === activeGroupId) ?? null,
    [groups, activeGroupId],
  )

  const isSystemGroup = activeGroup?.is_system ?? activeGroupId === ALL_GROUP_ID
  const canReorderStocks = !isSystemGroup && !filterQuery.trim()

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true)
    const next = await getStockGroups()
    setGroups(next)
    setLoadingGroups(false)
    return next
  }, [])

  const loadStocks = useCallback(async (
    focusSymbol?: string,
    options?: { showLoading?: boolean },
  ) => {
    if (!activeGroupId) return []
    const showLoading = options?.showLoading ?? true
    if (showLoading) setLoadingStocks(true)
    setStocksLoaded(false)
    const shouldFocus = Boolean(focusSymbol) && !filterQuery.trim()
    const next = await getStockGroupStocks(
      activeGroupId,
      filterQuery.trim(),
      isSystemGroup ? 200 : 500,
      shouldFocus ? focusSymbol : undefined,
    )
    setStocks(next)
    setStocksLoaded(true)
    if (showLoading) setLoadingStocks(false)
    return next
  }, [activeGroupId, filterQuery, isSystemGroup])

  const scrollSelectedToCenterIfNeeded = useCallback((symbol: string) => {
    const selectedKey = toListSymbolKey(symbol)
    const tryScroll = (attempt: number) => {
      window.requestAnimationFrame(() => {
        const el = itemRefs.current.get(selectedKey)
        const container = listScrollRef.current
        if ((!el || !container) && attempt < 4) {
          tryScroll(attempt + 1)
          return
        }
        if (el && container && !isElementFullyVisibleInContainer(el, container)) {
          scrollElementToContainerCenter(el, container)
        }
      })
    }
    tryScroll(0)
  }, [])

  const scrollListToTop = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (listScrollRef.current) listScrollRef.current.scrollTop = 0
    })
  }, [])

  useEffect(() => {
    void (async () => {
      const next = await loadGroups()
      if (next.length > 0) {
        setActiveGroupId((current) => (
          next.some((group) => group.group_id === current) ? current : next[0].group_id
        ))
      }
    })()
  }, [loadGroups])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStocks()
    }, 200)
    return () => window.clearTimeout(timer)
  }, [loadStocks])

  useEffect(() => {
    if (!stocksRefreshKey) return
    const timer = window.setTimeout(() => {
      void loadStocks(selectedSymbol || undefined, { showLoading: false })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [stocksRefreshKey, selectedSymbol, loadStocks])

  useEffect(() => {
    if (prevFilterQueryRef.current === filterQuery) return
    prevFilterQueryRef.current = filterQuery
    pendingScrollModeRef.current = null
    handledSearchKeyRef.current = ''
  }, [filterQuery])

  const handleSelectFromList = (stock: Stock) => {
    pendingScrollModeRef.current = null
    onSelectStock(stock)
  }

  const handleActiveGroupChange = (groupId: string) => {
    if (groupId === activeGroupId) return
    selectFirstStockOnGroupChangeRef.current = true
    pendingScrollModeRef.current = 'top'
    handledSearchKeyRef.current = ''
    setFilterQuery('')
    setActiveGroupId(groupId)
  }

  useEffect(() => {
    if (!selectFirstStockOnGroupChangeRef.current || loadingStocks || !stocksLoaded) return
    selectFirstStockOnGroupChangeRef.current = false
    if (stocks.length === 0) {
      onSelectStock(null)
      scrollListToTop()
      return
    }
    onSelectStock(stocks[0])
    scrollListToTop()
  }, [loadingStocks, stocksLoaded, stocks, onSelectStock, scrollListToTop])

  useEffect(() => {
    if (loadingStocks || !stocksLoaded || selectFirstStockOnGroupChangeRef.current) return
    if (initializedDefaultSelectionRef.current) return
    if (selectionSource === 'global-search') return
    initializedDefaultSelectionRef.current = true
    pendingScrollModeRef.current = 'top'
    if (stocks.length === 0) {
      onSelectStock(null)
      scrollListToTop()
      return
    }
    onSelectStock(stocks[0])
    scrollListToTop()
  }, [loadingStocks, stocksLoaded, stocks, selectionSource, onSelectStock, scrollListToTop])

  useEffect(() => {
    const mode = pendingScrollModeRef.current
    if (!mode || loadingStocks || !stocksLoaded) return
    if (mode === 'top') {
      pendingScrollModeRef.current = null
      scrollListToTop()
      return
    }
    if (selectedSymbol) {
      pendingScrollModeRef.current = null
      scrollSelectedToCenterIfNeeded(selectedSymbol)
    }
  }, [loadingStocks, stocksLoaded, stocks, selectedSymbol, scrollListToTop, scrollSelectedToCenterIfNeeded])

  useEffect(() => {
    if (loadingStocks || !stocksLoaded || !selectedSymbol) return
    if (selectFirstStockOnGroupChangeRef.current) return
    if (selectionSource !== 'global-search' && selectionSource !== 'chart-search') return

    const selectedKey = toListSymbolKey(selectedSymbol)
    const searchKey = `${selectionSource}:${selectedKey}:${activeGroupId}:${filterQuery}`
    if (handledSearchKeyRef.current === searchKey) return

    if (selectionSource === 'global-search' && activeGroupId !== ALL_GROUP_ID) {
      pendingScrollModeRef.current = 'center'
      window.setTimeout(() => {
        setFilterQuery('')
        setActiveGroupId(ALL_GROUP_ID)
      }, 0)
      return
    }

    if (filterQuery.trim()) {
      pendingScrollModeRef.current = 'center'
      window.setTimeout(() => setFilterQuery(''), 0)
      return
    }

    const inList = stocks.some((stock) => toListSymbolKey(stock.symbol) === selectedKey)

    if (inList) {
      handledSearchKeyRef.current = searchKey
      pendingScrollModeRef.current = null
      scrollSelectedToCenterIfNeeded(selectedSymbol)
      return
    }

    if (selectionSource === 'chart-search' && !isSystemGroup) {
      pendingScrollModeRef.current = 'center'
      window.setTimeout(() => {
        setFilterQuery('')
        setActiveGroupId(ALL_GROUP_ID)
      }, 0)
      return
    }

    pendingScrollModeRef.current = 'center'
    void (async () => {
      const next = await loadStocks(selectedSymbol, { showLoading: false })
      if (!next.some((stock) => toListSymbolKey(stock.symbol) === selectedKey)) {
        handledSearchKeyRef.current = searchKey
      }
    })()
  }, [
    loadingStocks,
    stocksLoaded,
    stocks,
    selectedSymbol,
    selectionSource,
    activeGroupId,
    filterQuery,
    loadStocks,
    isSystemGroup,
    scrollSelectedToCenterIfNeeded,
  ])

  const openCreateGroupDialog = () => {
    setGroupNameInput('')
    setGroupDialogMode('create')
  }

  const openRenameGroupDialog = () => {
    if (!activeGroup || isSystemGroup) return
    setGroupNameInput(activeGroup.name)
    setGroupDialogMode('rename')
  }

  const handleSaveGroupName = async () => {
    const name = groupNameInput.trim()
    if (!name) return

    if (groupDialogMode === 'create') {
      const created = await createStockGroup(name)
      if (created) {
        await loadGroups()
        handleActiveGroupChange(created.group_id)
      }
    } else if (groupDialogMode === 'rename' && activeGroup) {
      const updated = await updateStockGroup(activeGroup.group_id, name)
      if (updated) await loadGroups()
    }

    setGroupDialogMode(null)
    setGroupNameInput('')
  }

  const handleDeleteGroup = async () => {
    if (!activeGroup || isSystemGroup) return
    const ok = await deleteStockGroup(activeGroup.group_id)
    if (!ok) return
    handleActiveGroupChange(ALL_GROUP_ID)
    await loadGroups()
  }

  const handleRemoveStock = async (symbol: string) => {
    if (!activeGroupId || isSystemGroup) return
    pendingScrollModeRef.current = null
    const removeKey = toListSymbolKey(symbol)
    const selectedKey = toListSymbolKey(selectedSymbol)
    const removeIndex = stocks.findIndex((stock) => toListSymbolKey(stock.symbol) === removeKey)
    const shouldMoveSelection = removeIndex >= 0 && removeKey === selectedKey
    const fallbackStock = shouldMoveSelection
      ? (stocks[removeIndex + 1] ?? stocks[removeIndex - 1] ?? null)
      : null
    const ok = await removeStockFromStockGroup(activeGroupId, symbol)
    if (!ok) return
    const next = await loadStocks()
    if (!shouldMoveSelection) return
    if (!fallbackStock) {
      onSelectStock(null)
      return
    }
    const fallbackKey = toListSymbolKey(fallbackStock.symbol)
    onSelectStock(next.find((stock) => toListSymbolKey(stock.symbol) === fallbackKey) ?? fallbackStock)
  }

  const handleAddStock = async (item: { symbol: string; name: string }) => {
    if (!activeGroupId || isSystemGroup) return
    pendingScrollModeRef.current = null
    await addStocksToStockGroup(activeGroupId, [{ symbol: item.symbol, name: item.name ?? '' }])
    setAddStockOpen(false)
    await loadStocks()
  }

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    if (!canReorderStocks || reordering) return
    pendingScrollModeRef.current = null
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    if (!canReorderStocks || dragIndex === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIndex !== index) setDragOverIndex(index)
  }

  const handleDrop = (index: number) => async (e: React.DragEvent) => {
    e.preventDefault()
    if (!canReorderStocks || dragIndex === null || dragIndex === index || !activeGroupId) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }

    const fromIndex = dragIndex
    setDragIndex(null)
    setDragOverIndex(null)
    pendingScrollModeRef.current = null

    const reordered = [...stocks]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(index, 0, moved)

    const previous = stocks
    setStocks(reordered)
    setReordering(true)
    const result = await reorderStockGroupStocks(
      activeGroupId,
      reordered.map((stock) => stock.symbol),
    )
    setReordering(false)
    if (result.length > 0) {
      setStocks(result)
    } else {
      setStocks(previous)
      await loadStocks()
    }
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <>
      <Box
        sx={{
          width: 260,
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--c-borPri)',
          backgroundColor: 'var(--c-bacEle)',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ px: 1.25, py: 1, borderBottom: '1px solid var(--c-borPri)' }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <FormControl size="small" fullWidth>
              <Select
                value={activeGroupId}
                onChange={(e) => handleActiveGroupChange(e.target.value)}
                disabled={loadingGroups || groups.length === 0}
                sx={{
                  height: 32,
                  fontSize: 14,
                  '& .MuiSelect-select': { py: 0.5 },
                }}
              >
                {groups.map((group) => (
                  <MenuItem key={group.group_id} value={group.group_id}>
                    {group.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="新建分组">
              <IconButton size="small" onClick={openCreateGroupDialog}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="重命名">
              <span>
                <IconButton size="small" onClick={openRenameGroupDialog} disabled={isSystemGroup}>
                  <DriveFileRenameOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="删除分组">
              <span>
                <IconButton size="small" onClick={() => void handleDeleteGroup()} disabled={isSystemGroup}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>

        <Box sx={{ px: 1.25, py: 1, borderBottom: '1px solid var(--c-borPri)' }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <TextField
              size="small"
              fullWidth
              placeholder={isSystemGroup ? '搜索全部股票…' : '筛选分组内股票…'}
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ fontSize: 18, mr: 0.5, opacity: 0.6 }} />,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  height: 32,
                  fontSize: 13,
                  color: 'var(--c-texPri)',
                  backgroundColor: 'var(--ca-inpBac)',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'var(--c-borPri)',
                },
              }}
            />
            <Tooltip title={isSystemGroup ? 'All 分组不可添加' : '添加股票'}>
              <span>
                <IconButton
                  size="small"
                  disabled={isSystemGroup}
                  onClick={() => setAddStockOpen(true)}
                >
                  <PersonAddAltIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          {isSystemGroup && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.75, opacity: 0.65 }}>
              All 显示全市场股票（支持搜索筛选）
            </Typography>
          )}
        </Box>

        <Box ref={listScrollRef} sx={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}>
          {loadingStocks && stocks.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={22} />
            </Box>
          ) : stocks.length === 0 ? (
            <Box sx={{ px: 1.5, py: 2 }}>
              <Typography variant="body2" sx={{ opacity: 0.65 }}>
                {filterQuery.trim() ? '无匹配股票' : '暂无股票'}
              </Typography>
            </Box>
          ) : (
            <List dense disablePadding>
              {stocks.map((stock, index) => {
                const symbolKey = toListSymbolKey(stock.symbol)
                const selected = symbolKey === toListSymbolKey(selectedSymbol)
                const isDragging = dragIndex === index
                const isDragOver = dragOverIndex === index && dragIndex !== null && dragIndex !== index
                return (
                  <ListItemButton
                    key={stock.symbol}
                    selected={selected}
                    draggable={canReorderStocks && !reordering}
                    onDragStart={handleDragStart(index)}
                    onDragOver={handleDragOver(index)}
                    onDrop={(e) => void handleDrop(index)(e)}
                    onDragEnd={handleDragEnd}
                    ref={(el) => {
                      if (el) itemRefs.current.set(symbolKey, el)
                      else itemRefs.current.delete(symbolKey)
                    }}
                    onClick={() => handleSelectFromList(stock)}
                    sx={{
                      py: 0.75,
                      opacity: isDragging ? 0.45 : 1,
                      borderTop: isDragOver ? '2px solid var(--c-accPri, #90caf9)' : '2px solid transparent',
                      cursor: canReorderStocks ? 'grab' : 'pointer',
                      '&.Mui-selected': {
                        backgroundColor: 'var(--ca-sidIteSelBac)',
                      },
                      '&:active': {
                        cursor: canReorderStocks ? 'grabbing' : 'pointer',
                      },
                    }}
                  >
                    <ListItemText
                      primary={stock.symbol}
                      secondary={stock.name || '—'}
                      primaryTypographyProps={{ fontSize: 13, fontWeight: selected ? 700 : 500 }}
                      secondaryTypographyProps={{ fontSize: 12, noWrap: true }}
                    />
                    {!isSystemGroup && (
                      <IconButton
                        size="small"
                        edge="end"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleRemoveStock(stock.symbol)
                        }}
                      >
                        <RemoveCircleOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </ListItemButton>
                )
              })}
            </List>
          )}
          {loadingStocks && stocks.length > 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                pointerEvents: 'none',
              }}
            >
              <CircularProgress size={16} />
            </Box>
          )}
        </Box>
      </Box>

      <StyledDialog open={groupDialogMode !== null} onClose={() => setGroupDialogMode(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{groupDialogMode === 'create' ? '新建分组' : '重命名分组'}</DialogTitle>
        <DialogContent>
          <StyledTextField
            autoFocus
            fullWidth
            label="分组名称"
            value={groupNameInput}
            onChange={(e) => setGroupNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSaveGroupName()
            }}
          />
        </DialogContent>
        <DialogActions>
          <StyledButton onClick={() => setGroupDialogMode(null)}>取消</StyledButton>
          <StyledButton onClick={() => void handleSaveGroupName()}>保存</StyledButton>
        </DialogActions>
      </StyledDialog>

      <SymbolSearchDialog
        open={addStockOpen}
        onClose={() => setAddStockOpen(false)}
        onSelect={(item) => {
          void handleAddStock(item)
        }}
      />
    </>
  )
}
