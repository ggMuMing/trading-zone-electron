import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import Typography from '@mui/material/Typography'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import { useEffect, useMemo, useState } from 'react'
import {
  CHART_UNIVERSE_ALL,
  CHART_UNIVERSE_INDEX_BROAD,
  CHART_UNIVERSE_INDEX_MARKET,
  CHART_UNIVERSE_OPTIONS,
  industryUniverseId
} from '../../../../shared/constants/chartUniverse'
import type { SwIndustryNode } from '../../../../shared/types/swIndustry'

interface UniversePickerDialogProps {
  open: boolean
  universeId: string
  onClose: () => void
  onSelect: (universeId: string) => void
}

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
  const [tree, setTree] = useState<SwIndustryNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void window.api.industry
      .tree()
      .then((rows) => {
        if (!cancelled) {
          setTree(rows)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setTree([])
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

  const handleSelect = (nextId: string): void => {
    onSelect(nextId)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>选择标的范围</DialogTitle>
      <DialogContent dividers sx={{ p: 0, maxHeight: 480 }}>
        <List dense disablePadding>
          <ListItemButton
            selected={universeId === CHART_UNIVERSE_ALL}
            onClick={() => handleSelect(CHART_UNIVERSE_ALL)}
          >
            <ListItemText primary="全市场" />
          </ListItemButton>
          <ListSubheader disableSticky>指数行情</ListSubheader>
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
          <ListSubheader disableSticky>成分股</ListSubheader>
          {constituents.map((item) => (
            <ListItemButton
              key={item.id}
              selected={universeId === item.id}
              onClick={() => handleSelect(item.id)}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
          <ListSubheader disableSticky>行业</ListSubheader>
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
      </DialogContent>
    </Dialog>
  )
}
