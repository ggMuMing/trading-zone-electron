import {
  Box,
  Checkbox,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Stock, StockGroup } from '../../api/apiType'
import {
  addStocksToStockGroup,
  getStockGroupMembership,
  getStockGroups,
  removeStockFromStockGroup,
} from '../../api/api'
import { StyledButton, StyledDialog } from '../styled'

type AddToStockGroupDialogProps = {
  open: boolean
  onClose: () => void
  stock: Stock | null
  onAdded?: () => void
}

export default function AddToStockGroupDialog(props: AddToStockGroupDialogProps) {
  const { open, onClose, stock, onAdded } = props
  const [groups, setGroups] = useState<StockGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [initialGroupIds, setInitialGroupIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const initialGroupIdsRef = useRef<string[]>([])

  const customGroups = useMemo(
    () => groups.filter((group) => !group.is_system),
    [groups],
  )

  const hasChanges = useMemo(() => {
    const initial = new Set(initialGroupIds)
    const selected = new Set(selectedGroupIds)
    if (initial.size !== selected.size) return true
    return [...initial].some((id) => !selected.has(id))
  }, [initialGroupIds, selectedGroupIds])

  useEffect(() => {
    if (!open) return
    setSelectedGroupIds([])
    setInitialGroupIds([])
    initialGroupIdsRef.current = []
    setError('')

    if (!stock?.symbol) {
      setGroups([])
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [nextGroups, memberGroupIds] = await Promise.all([
        getStockGroups(),
        getStockGroupMembership(stock.symbol),
      ])
      if (cancelled) return
      setGroups(nextGroups)
      setInitialGroupIds(memberGroupIds)
      setSelectedGroupIds(memberGroupIds)
      initialGroupIdsRef.current = memberGroupIds
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, stock?.symbol])

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((current) => (
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    ))
  }

  const handleConfirm = async () => {
    if (!stock?.symbol || !hasChanges) return
    setSaving(true)
    setError('')

    const initial = new Set(initialGroupIdsRef.current)
    const selected = new Set(selectedGroupIds)
    const toAdd = [...selected].filter((id) => !initial.has(id))
    const toRemove = [...initial].filter((id) => !selected.has(id))
    const payload = [{ symbol: stock.symbol, name: stock.name ?? '' }]

    const [addResults, removeResults] = await Promise.all([
      Promise.all(toAdd.map((groupId) => addStocksToStockGroup(groupId, payload))),
      Promise.all(toRemove.map((groupId) => removeStockFromStockGroup(groupId, stock.symbol))),
    ])

    setSaving(false)

    const addOk = toAdd.length === 0 || addResults.every((items) => items.length > 0)
    const removeOk = toRemove.length === 0 || removeResults.every(Boolean)
    const totalOps = toAdd.length + toRemove.length
    const successOps = (
      addResults.filter((items) => items.length > 0).length
      + removeResults.filter(Boolean).length
    )

    if (addOk && removeOk) {
      onAdded?.()
      onClose()
      return
    }
    if (successOps > 0) {
      onAdded?.()
      const refreshed = await getStockGroupMembership(stock.symbol)
      setInitialGroupIds(refreshed)
      setSelectedGroupIds(refreshed)
      initialGroupIdsRef.current = refreshed
      setError(`部分操作失败（${successOps}/${totalOps} 成功）`)
      return
    }
    setError('保存失败，请重试')
  }

  const stockLabel = stock
    ? `${stock.symbol}${stock.name ? ` · ${stock.name}` : ''}`
    : ''

  return (
    <StyledDialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>管理分组</DialogTitle>
      <DialogContent>
        {stockLabel ? (
          <Typography variant="body2" sx={{ mb: 1.5, opacity: 0.85 }}>
            当前股票：{stockLabel}
          </Typography>
        ) : (
          <Typography variant="body2" color="error" sx={{ mb: 1.5 }}>
            请先选择股票
          </Typography>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={22} />
          </Box>
        ) : customGroups.length === 0 ? (
          <Typography variant="body2" sx={{ opacity: 0.65 }}>
            暂无自定义分组，请先在左侧新建分组
          </Typography>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 320, overflow: 'auto' }}>
            {customGroups.map((group) => (
              <ListItem key={group.group_id} disablePadding>
                <FormControlLabel
                  sx={{ width: '100%', mx: 0 }}
                  control={(
                    <Checkbox
                      size="small"
                      checked={selectedGroupIds.includes(group.group_id)}
                      onChange={() => toggleGroup(group.group_id)}
                      disabled={!stock?.symbol || saving}
                    />
                  )}
                  label={group.name}
                />
              </ListItem>
            ))}
          </List>
        )}

        {error ? (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
            {error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <StyledButton onClick={onClose} disabled={saving}>取消</StyledButton>
        <StyledButton
          onClick={() => void handleConfirm()}
          disabled={
            saving
            || !stock?.symbol
            || !hasChanges
            || customGroups.length === 0
          }
        >
          {saving ? '保存中…' : '确定'}
        </StyledButton>
      </DialogActions>
    </StyledDialog>
  )
}
