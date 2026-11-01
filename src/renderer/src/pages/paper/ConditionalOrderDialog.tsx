import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import Close from '@mui/icons-material/Close'
import { useEffect, useRef, useState } from 'react'
import type { PaperConditionalOrder } from '../../../../shared/paper/paperConditional'
import { CHART_ICON_SX, ChartIconButton } from '../chart/ChartIconButton'
import { paperFieldSx } from './paperFieldSx'

const DIALOG_WIDTH = 720

function statusLabel(status: PaperConditionalOrder['status']): string {
  if (status === 'filled') {
    return '已成交'
  }
  if (status === 'expired') {
    return '已作废'
  }
  return '待成交'
}

function formatLimit(value: number): string {
  return Number(value.toFixed(4)).toString()
}

export function ConditionalOrderDialog({
  open,
  trading,
  hideTime,
  orders,
  showOnChart,
  symbolLabel,
  symbolLabelOf,
  onClose,
  onCreate,
  onShowOnChartChange
}: {
  open: boolean
  trading: boolean
  hideTime: boolean
  orders: readonly PaperConditionalOrder[]
  showOnChart: boolean
  /** 当前条件单所属标的。 */
  symbolLabel: string
  symbolLabelOf: (order: PaperConditionalOrder) => string
  onClose: () => void
  onCreate: (input: {
    side: 'buy' | 'sell'
    limitPrice: number
    shares: number
    duration: number
  }) => string | null
  onShowOnChartChange: (show: boolean) => void
}): React.JSX.Element {
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [limitText, setLimitText] = useState('')
  const [qtyText, setQtyText] = useState('')
  const [durationText, setDurationText] = useState('5')
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    left: number
    top: number
    width: number
  } | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    setSide('buy')
    setLimitText('')
    setQtyText('')
    setDurationText('5')
    setError(null)
  }, [open])

  const submit = (): void => {
    const limitPrice = Number(limitText)
    const shares = Number(qtyText)
    const duration = Number(durationText)
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
      setError('请输入大于 0 的限价')
      return
    }
    if (!Number.isInteger(shares) || shares < 100 || shares % 100 !== 0) {
      setError('数量需为 100 的整数倍')
      return
    }
    if (!Number.isInteger(duration) || duration < 1) {
      setError('持续时间至少 1 根 K 线')
      return
    }
    const message = onCreate({ side, limitPrice, shares, duration })
    if (message) {
      setError(message)
      return
    }
    setLimitText('')
    setQtyText('')
    setError(null)
  }

  const onTitlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) {
      return
    }
    const paper = event.currentTarget.parentElement
    if (!(paper instanceof HTMLElement)) {
      return
    }
    const rect = paper.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
      left: rect.left,
      top: rect.top,
      width: rect.width
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onTitlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }
    let left = drag.left + event.clientX - drag.startX
    let top = drag.top + event.clientY - drag.startY
    left = Math.min(Math.max(left, 48 - drag.width), window.innerWidth - 48)
    top = Math.min(Math.max(top, 8), window.innerHeight - 48)
    setOffset({
      x: drag.originX + (left - drag.left),
      y: drag.originY + (top - drag.top)
    })
  }

  const onTitlePointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      hideBackdrop
      disableEnforceFocus
      disableAutoFocus
      disableScrollLock
      maxWidth={false}
      sx={{ pointerEvents: 'none' }}
      slotProps={{
        paper: {
          sx: {
            width: DIALOG_WIDTH,
            maxWidth: 'calc(100% - 32px)',
            pointerEvents: 'auto',
            position: 'absolute',
            left: '50%',
            top: 48,
            m: 0,
            transform: `translateX(calc(-50% + ${offset.x}px)) translateY(${offset.y}px)`
          }
        }
      }}
    >
      <DialogTitle
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={onTitlePointerUp}
        onPointerCancel={onTitlePointerUp}
        sx={{
          display: 'flex',
          alignItems: 'center',
          py: 1.25,
          pr: 1,
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'none'
        }}
      >
        <Typography component="span" sx={{ fontWeight: 700, pr: 1 }}>
          条件单
        </Typography>
        <Box onPointerDown={(event) => event.stopPropagation()} sx={{ display: 'inline-flex', mr: 'auto' }}>
          <FormControlLabel
            sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: 14 } }}
            control={
              <Switch
                size="small"
                checked={showOnChart}
                onChange={(event) => onShowOnChartChange(event.target.checked)}
              />
            }
            label="显示在图表"
          />
        </Box>
        <Box onPointerDown={(event) => event.stopPropagation()} sx={{ display: 'inline-flex' }}>
          <ChartIconButton ariaLabel="关闭" title="关闭" roomy onClick={onClose}>
            <Close sx={CHART_ICON_SX} />
          </ChartIconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TextField
          size="small"
          label="标的"
          value={symbolLabel}
          slotProps={{ htmlInput: { readOnly: true, 'aria-label': '条件单标的' } }}
          sx={[paperFieldSx, { mx: 0, width: '100%', mb: 1.5 }]}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <RadioGroup
            row
            value={side}
            aria-label="条件单方向"
            onChange={(event) => setSide(event.target.value === 'sell' ? 'sell' : 'buy')}
            sx={{ flexShrink: 0, '& .MuiFormControlLabel-label': { fontSize: 14 } }}
          >
            <FormControlLabel value="buy" control={<Radio size="small" />} label="买入" />
            <FormControlLabel value="sell" control={<Radio size="small" />} label="卖出" sx={{ mr: 0 }} />
          </RadioGroup>
          <TextField
            size="small"
            type="number"
            label="限价"
            value={limitText}
            onChange={(event) => setLimitText(event.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 0.01, 'aria-label': '条件单限价' } }}
            sx={[paperFieldSx, { mx: 0, width: 'auto', flex: 1, minWidth: 0 }]}
          />
          <TextField
            size="small"
            type="number"
            label="数量"
            value={qtyText}
            onChange={(event) => setQtyText(event.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 100, 'aria-label': '条件单数量' } }}
            sx={[paperFieldSx, { mx: 0, width: 'auto', flex: 1, minWidth: 0 }]}
          />
          <TextField
            size="small"
            type="number"
            label="持续时间（根）"
            value={durationText}
            onChange={(event) => setDurationText(event.target.value)}
            slotProps={{ htmlInput: { min: 1, step: 1, 'aria-label': '条件单持续时间' } }}
            sx={[paperFieldSx, { mx: 0, width: 'auto', flex: 1, minWidth: 0 }]}
          />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          从下一根 K 线起，股价到达限价即按限价成交；超过持续时间仍未成交则作废。
        </Typography>
        {error ? (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.75 }}>
            {error}
          </Typography>
        ) : null}
        <Button
          size="small"
          variant="contained"
          disabled={!trading}
          onClick={submit}
          sx={{ mt: 1.5 }}
        >
          创建条件单
        </Button>
        <Table
          size="small"
          sx={{
            mt: 2,
            '& .MuiTableCell-root': {
              px: 0.75,
              py: 0.75,
              fontSize: 12,
              lineHeight: 1.4,
              borderColor: 'divider',
              whiteSpace: 'nowrap'
            },
            '& .MuiTableCell-head': { fontWeight: 700 }
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell>创建时间</TableCell>
              <TableCell>标的</TableCell>
              <TableCell>方向</TableCell>
              <TableCell align="right">限价</TableCell>
              <TableCell align="right">数量</TableCell>
              <TableCell align="right">持续时间</TableCell>
              <TableCell>状态</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                  还没有条件单
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>{hideTime || !order.createdTime ? '—' : order.createdTime}</TableCell>
                  <TableCell>{symbolLabelOf(order)}</TableCell>
                  <TableCell>{order.side === 'buy' ? '买入' : '卖出'}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatLimit(order.limitPrice)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {order.shares}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {order.duration}根
                  </TableCell>
                  <TableCell>{statusLabel(order.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  )
}
