import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import Close from '@mui/icons-material/Close'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import { useEffect, useMemo, useState } from 'react'
import {
  CHART_UNIVERSE_ALL,
  CHART_UNIVERSE_DELISTED,
  CHART_UNIVERSE_INDEX_BROAD,
  CHART_UNIVERSE_INDEX_MARKET,
  CHART_UNIVERSE_OPTIONS,
  groupUniverseId,
  industryUniverseId,
  parseGroupId,
  resolveUniverseNavTab
} from '../../../../shared/constants/chartUniverse'
import type { SymbolGroupCategorySummary } from '../../../../shared/types/symbolGroup'
import type { SwIndustryNode } from '../../../../shared/types/swIndustry'
import { CHART_ICON_SX, ChartIconButton } from './ChartIconButton'

interface UniversePickerDialogProps {
  open: boolean
  universeId: string
  onClose: () => void
  onSelect: (universeId: string) => void
}

const DIALOG_WIDTH = 640
const DIALOG_HEIGHT = 480
const NAV_WIDTH = 148

function categoryTabId(categoryId: string): string {
  return `category:${categoryId}`
}

const NAV_TABS: Array<{ id: string; label: string }> = [
  { id: 'index', label: '指数行情' },
  { id: 'constituents', label: '成分股' },
  { id: 'industry', label: '行业' }
]

function childrenOf(
  byParent: Map<string, SwIndustryNode[]>,
  parentCode: string
): SwIndustryNode[] {
  return byParent.get(parentCode) ?? []
}

function IndustryNodeRow({
  node,
  byParent,
  selectedId,
  onSelect
}: {
  node: SwIndustryNode
  byParent: Map<string, SwIndustryNode[]>
  selectedId: string
  onSelect: (universeId: string) => void
}): React.JSX.Element {
  const kids = childrenOf(byParent, node.industry_code)
  const [open, setOpen] = useState(false)
  const optionId = industryUniverseId(node.index_code)
  const selected = selectedId === optionId
  const indent = node.level === 'L1' ? 0 : node.level === 'L2' ? 2 : 4

  return (
    <>
      <ListItemButton
        dense
        selected={selected}
        onClick={() => onSelect(optionId)}
        sx={{ pl: 1.5 + indent }}
      >
        {kids.length > 0 ? (
          <IconButton
            size="small"
            edge="start"
            onClick={(event) => {
              event.stopPropagation()
              setOpen((prev) => !prev)
            }}
            sx={{ mr: 0.5 }}
          >
            {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
        ) : (
          <Box sx={{ width: 34 }} />
        )}
        <ListItemText
          primary={node.name}
          primaryTypographyProps={{ variant: 'body2', noWrap: true }}
        />
      </ListItemButton>
      {kids.length > 0 ? (
        <Collapse in={open} timeout="auto" unmountOnExit>
          {kids.map((child) => (
            <IndustryNodeRow
              key={child.index_code}
              node={child}
              byParent={byParent}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </Collapse>
      ) : null}
    </>
  )
}

export function UniversePickerDialog({
  open,
  universeId,
  onClose,
  onSelect
}: UniversePickerDialogProps): React.JSX.Element {
  const [tab, setTab] = useState<string>(() => resolveUniverseNavTab(universeId))
  const [tree, setTree] = useState<SwIndustryNode[]>([])
  const [categories, setCategories] = useState<SymbolGroupCategorySummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const groupId = parseGroupId(universeId)
    if (!groupId) {
      setTab(resolveUniverseNavTab(universeId))
      return
    }
    const category = categories.find((item) => item.groups.some((group) => group.id === groupId))
    setTab(category ? categoryTabId(category.id) : resolveUniverseNavTab(universeId))
  }, [open, universeId, categories])

  useEffect(() => {
    if (!open) {
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void Promise.all([window.api.industry.tree(), window.api.symbolGroup.tree()])
      .then(([rows, groups]) => {
        if (!cancelled) {
          setTree(rows)
          setCategories(groups.categories)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setTree([])
          setCategories([])
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

  const byParent = useMemo(() => {
    const map = new Map<string, SwIndustryNode[]>()
    for (const node of tree) {
      const list = map.get(node.parent_code) ?? []
      list.push(node)
      map.set(node.parent_code, list)
    }
    return map
  }, [tree])

  const roots = childrenOf(byParent, '0')
  const constituents = CHART_UNIVERSE_OPTIONS.filter((item) => item.kind === 'constituents')
  const navTabs: Array<{ id: string; label: string }> = [
    ...NAV_TABS,
    ...categories.map((category) => ({ id: categoryTabId(category.id), label: category.name }))
  ]
  const activeCategoryId = tab.startsWith('category:') ? tab.slice('category:'.length) : null
  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? null

  const handleSelect = (nextId: string): void => {
    onSelect(nextId)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        paper: {
          sx: {
            width: DIALOG_WIDTH,
            height: DIALOG_HEIGHT,
            maxWidth: DIALOG_WIDTH,
            display: 'flex',
            flexDirection: 'column'
          }
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 1.25, pr: 1 }}>
        <Typography component="span" sx={{ fontWeight: 700 }}>
          选择标的范围
        </Typography>
        <Box sx={{ flex: 1 }} />
        <ChartIconButton ariaLabel="关闭" title="关闭" roomy onClick={onClose}>
          <Close sx={CHART_ICON_SX} />
        </ChartIconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{ p: 0, display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}
      >
        <Box
          sx={{
            width: NAV_WIDTH,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            py: 0.5,
            minHeight: 0,
            overflow: 'auto'
          }}
        >
          <List dense disablePadding sx={{ overflow: 'auto', height: '100%' }}>
            {navTabs.map((item) => (
              <ListItemButton
                key={item.id}
                selected={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                <ListItemText primary={item.label} primaryTypographyProps={{ noWrap: true }} />
              </ListItemButton>
            ))}
          </List>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          {tab === 'index' ? (
            <List dense disablePadding>
              <ListItemButton
                selected={universeId === CHART_UNIVERSE_ALL}
                onClick={() => handleSelect(CHART_UNIVERSE_ALL)}
              >
                <ListItemText primary="全市场" />
              </ListItemButton>
              <ListItemButton
                selected={universeId === CHART_UNIVERSE_DELISTED}
                onClick={() => handleSelect(CHART_UNIVERSE_DELISTED)}
              >
                <ListItemText primary="退市股票" />
              </ListItemButton>
              <ListItemButton
                selected={universeId === CHART_UNIVERSE_INDEX_MARKET}
                onClick={() => handleSelect(CHART_UNIVERSE_INDEX_MARKET)}
              >
                <ListItemText primary="大盘指数" />
              </ListItemButton>
              <ListItemButton
                selected={universeId === CHART_UNIVERSE_INDEX_BROAD}
                onClick={() => handleSelect(CHART_UNIVERSE_INDEX_BROAD)}
              >
                <ListItemText primary="宽基指数" />
              </ListItemButton>
            </List>
          ) : null}
          {tab === 'constituents' ? (
            <List dense disablePadding>
              {constituents.map((item) => (
                <ListItemButton
                  key={item.id}
                  selected={universeId === item.id}
                  onClick={() => handleSelect(item.id)}
                >
                  <ListItemText primary={item.label} />
                </ListItemButton>
              ))}
            </List>
          ) : null}
          {tab === 'industry' ? (
            <List dense disablePadding>
              {loading ? (
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    加载行业分类…
                  </Typography>
                </Box>
              ) : null}
              {error ? (
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="body2" color="error">
                    {error}
                  </Typography>
                </Box>
              ) : null}
              {!loading && !error && roots.length === 0 ? (
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    尚无行业数据，请到配置页更新行业分类
                  </Typography>
                </Box>
              ) : null}
              {roots.map((node) => (
                <IndustryNodeRow
                  key={node.index_code}
                  node={node}
                  byParent={byParent}
                  selectedId={universeId}
                  onSelect={handleSelect}
                />
              ))}
            </List>
          ) : null}
          {activeCategory ? (
            <List dense disablePadding>
              {activeCategory.groups.length === 0 ? (
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    该分类还没有分组
                  </Typography>
                </Box>
              ) : (
                activeCategory.groups.map((group) => (
                  <ListItemButton
                    key={group.id}
                    selected={universeId === groupUniverseId(group.id)}
                    onClick={() => handleSelect(groupUniverseId(group.id))}
                  >
                    <ListItemText primary={group.name} primaryTypographyProps={{ noWrap: true }} />
                  </ListItemButton>
                ))
              )}
            </List>
          ) : null}
        </Box>
      </DialogContent>
    </Dialog>
  )
}
