import Box from '@mui/material/Box'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import Code from '@mui/icons-material/Code'
import Delete from '@mui/icons-material/Delete'
import SettingsIcon from '@mui/icons-material/Settings'

const iconSx = { fontSize: 16 }

function ToolbarButton({
  disabled,
  onClick,
  children,
  ariaLabel,
  boxed = false,
  roomy = false
}: {
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
  ariaLabel: string
  boxed?: boolean
  roomy?: boolean
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
        justifyContent: 'center',
        pointerEvents: 'auto',
        color: 'rgba(0, 0, 0, 0.45)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        borderRadius: '3px',
        lineHeight: 1,
        boxShadow: 'none',
        ...(boxed
          ? {
              width: 22,
              height: 22,
              bgcolor: 'rgba(255, 255, 255, 0.92)',
              border: '1px solid rgba(0, 0, 0, 0.22)'
            }
          : roomy
            ? {
                width: 24,
                height: 24
              }
            : {}),
        '&:hover': disabled
          ? undefined
          : {
              color: '#ed6c02',
              bgcolor: 'rgba(0, 0, 0, 0.06)',
              boxShadow: 'none',
              ...(boxed ? { borderColor: '#ed6c02' } : {})
            }
      }}
    >
      {children}
    </Box>
  )
}

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
        <ToolbarButton
          ariaLabel="上移窗格"
          disabled={disableMoveUp}
          onClick={onMoveUp}
          boxed={boxed}
          roomy={roomy}
        >
          <ArrowUpward sx={iconSx} />
        </ToolbarButton>
      ) : null}
      {onMoveDown ? (
        <ToolbarButton
          ariaLabel="下移窗格"
          disabled={disableMoveDown}
          onClick={onMoveDown}
          boxed={boxed}
          roomy={roomy}
        >
          <ArrowDownward sx={iconSx} />
        </ToolbarButton>
      ) : null}
      {onOpenSettings ? (
        <ToolbarButton ariaLabel="设置指标" onClick={onOpenSettings} boxed={boxed} roomy={roomy}>
          <SettingsIcon sx={iconSx} />
        </ToolbarButton>
      ) : null}
      {onOpenEditor ? (
        <ToolbarButton ariaLabel="打开脚本编辑器" onClick={onOpenEditor} boxed={boxed} roomy={roomy}>
          <Code sx={iconSx} />
        </ToolbarButton>
      ) : null}
      {onRemove ? (
        <ToolbarButton ariaLabel="删除指标" onClick={onRemove} boxed={boxed} roomy={roomy}>
          <Delete sx={iconSx} />
        </ToolbarButton>
      ) : null}
    </Box>
  )
}
