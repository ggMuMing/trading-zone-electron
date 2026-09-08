import Box from '@mui/material/Box'
import type { ReactNode } from 'react'

export const CHART_ICON_SX = { fontSize: 16 }

export function ChartIconButton({
  disabled,
  onClick,
  children,
  ariaLabel,
  title,
  boxed = false,
  roomy = false
}: {
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
  ariaLabel: string
  title?: string
  boxed?: boolean
  roomy?: boolean
}): React.JSX.Element {
  const hint = title ?? ariaLabel
  return (
    <Box
      component="span"
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      title={hint}
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
