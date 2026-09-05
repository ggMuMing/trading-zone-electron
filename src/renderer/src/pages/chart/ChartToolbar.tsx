import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { useState } from 'react'
import type { ChartPeriod } from '../../../../shared/types/chart'
import type { AdjustType } from '../../../../shared/types/market'

const PERIOD_OPTIONS: Array<{ value: ChartPeriod; label: string }> = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'quarter', label: '季' },
  { value: 'year', label: '年' }
]

const ADJUST_OPTIONS: Array<{ value: AdjustType; label: string }> = [
  { value: 'none', label: '未复权' },
  { value: 'qfq', label: '前复权' },
  { value: 'hfq', label: '后复权' }
]

function periodLabel(period: ChartPeriod): string {
  return PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? '日'
}

function adjustLabel(adjust: AdjustType): string {
  return ADJUST_OPTIONS.find((option) => option.value === adjust)?.label ?? '未复权'
}

export interface ChartToolbarProps {
  symbolLabel: string
  period: ChartPeriod
  onPeriodChange: (period: ChartPeriod) => void
  adjust: AdjustType
  onAdjustChange: (adjust: AdjustType) => void
  adjustDisabled?: boolean
  onOpenIndicators: () => void
  indicatorsDisabled?: boolean
}

export function ChartToolbar({
  symbolLabel,
  period,
  onPeriodChange,
  adjust,
  onAdjustChange,
  adjustDisabled = false,
  onOpenIndicators,
  indicatorsDisabled = false
}: ChartToolbarProps): React.JSX.Element {
  const [periodAnchor, setPeriodAnchor] = useState<HTMLElement | null>(null)
  const [adjustAnchor, setAdjustAnchor] = useState<HTMLElement | null>(null)

  return (
    <Stack
      direction="row"
      spacing={0}
      alignItems="center"
      sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', minHeight: 44 }}
    >
      <Typography variant="subtitle2" noWrap sx={{ minWidth: 0, maxWidth: 280, pr: 1 }}>
        {symbolLabel}
      </Typography>
      <Divider orientation="vertical" flexItem />
      <Button size="small" startIcon={<GroupAddIcon />} disabled sx={{ mx: 0.5 }}>
        分组
      </Button>
      <Divider orientation="vertical" flexItem />
      <Button
        size="small"
        startIcon={<CalendarMonthIcon />}
        endIcon={<ArrowDropDownIcon />}
        onClick={(event) => setPeriodAnchor(event.currentTarget)}
        sx={{ mx: 0.5 }}
      >
        {periodLabel(period)}
      </Button>
      <Menu
        anchorEl={periodAnchor}
        open={Boolean(periodAnchor)}
        onClose={() => setPeriodAnchor(null)}
      >
        {PERIOD_OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            disabled={option.value !== 'day'}
            selected={option.value === period}
            onClick={() => {
              onPeriodChange(option.value)
              setPeriodAnchor(null)
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
      <Divider orientation="vertical" flexItem />
      <Button
        size="small"
        endIcon={<ArrowDropDownIcon />}
        disabled={adjustDisabled}
        onClick={(event) => setAdjustAnchor(event.currentTarget)}
        sx={{ mx: 0.5 }}
      >
        {adjustLabel(adjust)}
      </Button>
      <Menu
        anchorEl={adjustAnchor}
        open={Boolean(adjustAnchor)}
        onClose={() => setAdjustAnchor(null)}
      >
        {ADJUST_OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === adjust}
            onClick={() => {
              onAdjustChange(option.value)
              setAdjustAnchor(null)
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
      <Divider orientation="vertical" flexItem />
      <Button
        size="small"
        startIcon={<TrendingUpIcon />}
        onClick={onOpenIndicators}
        disabled={indicatorsDisabled}
        sx={{ mx: 0.5 }}
      >
        指标
      </Button>
    </Stack>
  )
}
