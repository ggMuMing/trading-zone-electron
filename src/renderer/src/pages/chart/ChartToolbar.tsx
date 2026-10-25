import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Popover from '@mui/material/Popover'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import ReplayIcon from '@mui/icons-material/Replay'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SkipNextIcon from '@mui/icons-material/SkipNext'
import StopIcon from '@mui/icons-material/Stop'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { useState } from 'react'
import { ISO_DATE_PATTERN, type ChartPeriod } from '../../../../shared/types/chart'
import type { AdjustType } from '../../../../shared/types/market'
import { ReplayConfigForm, type ReplayStartRequest } from './ReplayPanel'

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
  periodDisabled?: boolean
  adjust: AdjustType
  onAdjustChange: (adjust: AdjustType) => void
  adjustDisabled?: boolean
  onOpenIndicators: () => void
  indicatorsDisabled?: boolean
  onJumpToDate: (isoDate: string) => void
  jumpDisabled?: boolean
  jumpMin?: string
  jumpMax?: string
  replayCanStart?: boolean
  replayActive?: boolean
  replayCanStep?: boolean
  onReplayStart?: (request: ReplayStartRequest) => void
  onReplayBegin?: () => void
  onReplayStop?: () => void
  onReplayNext?: () => void
  /** 为 true 时用开始按钮代替回放配置。 */
  replayDirect?: boolean
  /** 为 false 时不显示直接开始按钮。 */
  replayShowStart?: boolean
  showGroup?: boolean
  showJump?: boolean
  trailing?: ReactNode
}

export function ChartToolbar({
  symbolLabel,
  period,
  onPeriodChange,
  periodDisabled = false,
  adjust,
  onAdjustChange,
  adjustDisabled = false,
  onOpenIndicators,
  indicatorsDisabled = false,
  onJumpToDate,
  jumpDisabled = false,
  jumpMin,
  jumpMax,
  replayCanStart = false,
  replayActive = false,
  replayCanStep = false,
  onReplayStart,
  onReplayBegin,
  onReplayStop,
  onReplayNext,
  replayDirect = false,
  replayShowStart = true,
  showGroup = true,
  showJump = true,
  trailing
}: ChartToolbarProps): React.JSX.Element {
  const [periodAnchor, setPeriodAnchor] = useState<HTMLElement | null>(null)
  const [adjustAnchor, setAdjustAnchor] = useState<HTMLElement | null>(null)
  const [jumpAnchor, setJumpAnchor] = useState<HTMLElement | null>(null)
  const [replayAnchor, setReplayAnchor] = useState<HTMLElement | null>(null)
  const [jumpDate, setJumpDate] = useState('')
  const [jumpError, setJumpError] = useState<string | null>(null)

  const openJump = (anchor: HTMLElement): void => {
    setJumpError(null)
    setJumpDate((current) => {
      if (current && (!jumpMin || current >= jumpMin) && (!jumpMax || current <= jumpMax)) {
        return current
      }
      return jumpMax ?? ''
    })
    setJumpAnchor(anchor)
  }

  const submitJump = (): void => {
    if (!ISO_DATE_PATTERN.test(jumpDate)) {
      setJumpError('请选择日期')
      return
    }
    onJumpToDate(jumpDate)
    setJumpAnchor(null)
    setJumpError(null)
  }

  return (
    <Stack
      direction="row"
      spacing={0}
      alignItems="center"
      sx={{ pl: 1, pr: 2, py: 1, borderBottom: 1, borderColor: 'divider', minHeight: 44 }}
    >
      <Typography variant="subtitle2" noWrap sx={{ minWidth: 0, maxWidth: 280, pr: 1 }}>
        {symbolLabel}
      </Typography>
      <Divider orientation="vertical" flexItem />
      {showGroup ? (
        <Button size="small" startIcon={<GroupAddIcon />} disabled sx={{ mx: 0.5 }}>
          分组
        </Button>
      ) : null}
      {showGroup ? <Divider orientation="vertical" flexItem /> : null}
      <Button
        size="small"
        startIcon={<CalendarMonthIcon />}
        endIcon={<ArrowDropDownIcon />}
        disabled={periodDisabled}
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
      {showJump ? <Divider orientation="vertical" flexItem /> : null}
      {showJump ? (
        <Button
          size="small"
          startIcon={<MyLocationIcon />}
          disabled={jumpDisabled}
          onClick={(event) => openJump(event.currentTarget)}
          sx={{ mx: 0.5 }}
        >
          跳转
        </Button>
      ) : null}
      <Popover
        open={Boolean(jumpAnchor)}
        anchorEl={jumpAnchor}
        onClose={() => setJumpAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { p: 1.5, width: 280 }
          }
        }}
      >
        <Stack spacing={0.75}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              type="date"
              label="日期"
              value={jumpDate}
              onChange={(event) => {
                setJumpDate(event.target.value)
                setJumpError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submitJump()
                }
              }}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: {
                  min: jumpMin,
                  max: jumpMax,
                  'aria-label': '跳转日期'
                }
              }}
              sx={{ flex: 1, minWidth: 0 }}
            />
            <Button size="small" variant="contained" onClick={submitJump}>
              跳转
            </Button>
          </Stack>
          <Typography variant="caption" color={jumpError ? 'error' : 'text.secondary'}>
            {jumpError ?? '非交易日将定位到最近的K线'}
          </Typography>
        </Stack>
      </Popover>
      {onReplayStart || replayDirect ? <Divider orientation="vertical" flexItem /> : null}
      {onReplayStart ? (
        <Button
          size="small"
          startIcon={<ReplayIcon />}
          aria-pressed={replayActive || Boolean(replayAnchor)}
          onClick={(event) => setReplayAnchor(event.currentTarget)}
          sx={{
            mx: 0.5,
            ...(replayActive || replayAnchor
              ? { color: 'primary.main', bgcolor: 'action.selected' }
              : {})
          }}
        >
          回放
        </Button>
      ) : null}
      {replayDirect && replayShowStart && !replayActive ? (
        <Button
          size="small"
          startIcon={<PlayArrowIcon />}
          disabled={!replayCanStart}
          onClick={onReplayBegin}
          sx={{ mx: 0.5 }}
        >
          开始
        </Button>
      ) : null}
      <Popover
        open={Boolean(replayAnchor)}
        anchorEl={replayAnchor}
        onClose={() => setReplayAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { p: 1.5, width: 300 }
          }
        }}
      >
        {onReplayStart ? (
          <ReplayConfigForm
            canStart={replayCanStart}
            active={replayActive}
            onStart={(request) => {
              onReplayStart(request)
              setReplayAnchor(null)
            }}
          />
        ) : null}
      </Popover>
      {replayActive && onReplayStop && !(replayDirect && !replayShowStart) ? (
        <Button size="small" startIcon={<StopIcon />} onClick={onReplayStop} sx={{ mx: 0.5 }}>
          终止
        </Button>
      ) : null}
      {replayActive || replayDirect ? (
        <Button
          size="small"
          startIcon={<SkipNextIcon />}
          disabled={!replayActive || !replayCanStep}
          onClick={onReplayNext}
          sx={{ mx: 0.5 }}
        >
          下一根
        </Button>
      ) : null}
      <Box sx={{ flex: 1, minWidth: 8 }} />
      {trailing}
    </Stack>
  )
}
