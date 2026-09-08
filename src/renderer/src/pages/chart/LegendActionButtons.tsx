import Box from '@mui/material/Box'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import Code from '@mui/icons-material/Code'
import Delete from '@mui/icons-material/Delete'
import SettingsIcon from '@mui/icons-material/Settings'
import { CHART_ICON_SX, ChartIconButton } from './ChartIconButton'

export interface LegendActionButtonsProps {
  onOpenSettings?: () => void
  onOpenEditor?: () => void
  onRemove?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  disableMoveUp?: boolean
  disableMoveDown?: boolean
  boxed?: boolean
  roomy?: boolean
}

export function LegendActionButtons({
  onOpenSettings,
  onOpenEditor,
  onRemove,
  onMoveUp,
  onMoveDown,
  disableMoveUp = false,
  disableMoveDown = false,
  boxed = false,
  roomy = false
}: LegendActionButtonsProps): React.JSX.Element | null {
  if (!onOpenSettings && !onOpenEditor && !onRemove && !onMoveUp && !onMoveDown) {
    return null
  }
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: boxed ? 0.5 : roomy ? 1 : 0.25,
        ml: boxed ? 0 : roomy ? 1 : 0.5,
        pointerEvents: 'auto'
      }}
    >
      {onMoveUp ? (
        <ChartIconButton
          ariaLabel="上移窗格"
          disabled={disableMoveUp}
          onClick={onMoveUp}
          boxed={boxed}
          roomy={roomy}
        >
          <ArrowUpward sx={CHART_ICON_SX} />
        </ChartIconButton>
      ) : null}
      {onMoveDown ? (
        <ChartIconButton
          ariaLabel="下移窗格"
          disabled={disableMoveDown}
          onClick={onMoveDown}
          boxed={boxed}
          roomy={roomy}
        >
          <ArrowDownward sx={CHART_ICON_SX} />
        </ChartIconButton>
      ) : null}
      {onOpenSettings ? (
        <ChartIconButton ariaLabel="设置指标" onClick={onOpenSettings} boxed={boxed} roomy={roomy}>
          <SettingsIcon sx={CHART_ICON_SX} />
        </ChartIconButton>
      ) : null}
      {onOpenEditor ? (
        <ChartIconButton ariaLabel="打开脚本编辑器" onClick={onOpenEditor} boxed={boxed} roomy={roomy}>
          <Code sx={CHART_ICON_SX} />
        </ChartIconButton>
      ) : null}
      {onRemove ? (
        <ChartIconButton ariaLabel="删除指标" onClick={onRemove} boxed={boxed} roomy={roomy}>
          <Delete sx={CHART_ICON_SX} />
        </ChartIconButton>
      ) : null}
    </Box>
  )
}
