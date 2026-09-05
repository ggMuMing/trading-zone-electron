import Box from '@mui/material/Box'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import Delete from '@mui/icons-material/Delete'
import SettingsIcon from '@mui/icons-material/Settings'

const iconSx = { fontSize: 14 }

function ToolbarButton({
  disabled,
  onClick,
  children,
  ariaLabel
}: {
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
  ariaLabel: string
}): React.JSX.Element {
  return (
    <Box
      component="span"
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onClick={(event) => {
        event.stopPropagation()
        event.preventDefault()
        if (!disabled) {
          onClick?.()
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }
        event.stopPropagation()
        event.preventDefault()
        if (!disabled) {
          onClick?.()
        }
      }}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        pointerEvents: 'auto',
        color: 'rgba(0, 0, 0, 0.45)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        borderRadius: '3px',
        lineHeight: 1,
        '&:hover': disabled
          ? undefined
          : {
              color: '#ed6c02'
            }
      }}
    >
      {children}
    </Box>
  )
}

export interface LegendActionButtonsProps {
  onOpenSettings?: () => void
  onRemove?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  disableMoveUp?: boolean
  disableMoveDown?: boolean
}

export function LegendActionButtons({
  onOpenSettings,
  onRemove,
  onMoveUp,
  onMoveDown,
  disableMoveUp = false,
  disableMoveDown = false
}: LegendActionButtonsProps): React.JSX.Element | null {
  if (!onOpenSettings && !onRemove && !onMoveUp && !onMoveDown) {
    return null
  }
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, ml: 0.5, pointerEvents: 'auto' }}>
      {onMoveUp ? (
        <ToolbarButton ariaLabel="上移窗格" disabled={disableMoveUp} onClick={onMoveUp}>
          <ArrowUpward sx={iconSx} />
        </ToolbarButton>
      ) : null}
      {onMoveDown ? (
        <ToolbarButton ariaLabel="下移窗格" disabled={disableMoveDown} onClick={onMoveDown}>
          <ArrowDownward sx={iconSx} />
        </ToolbarButton>
      ) : null}
      {onOpenSettings ? (
        <ToolbarButton ariaLabel="设置指标" onClick={onOpenSettings}>
          <SettingsIcon sx={iconSx} />
        </ToolbarButton>
      ) : null}
      {onRemove ? (
        <ToolbarButton ariaLabel="删除指标" onClick={onRemove}>
          <Delete sx={iconSx} />
        </ToolbarButton>
      ) : null}
    </Box>
  )
}
