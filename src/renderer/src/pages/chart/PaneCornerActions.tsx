import Box from '@mui/material/Box'
import { LegendActionButtons } from './LegendActionButtons'

const PLOT_EDGE_GAP = 6

export interface PaneCornerActionsProps {
  visible: boolean
  onRemove?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  disableMoveUp?: boolean
  disableMoveDown?: boolean
}

export function PaneCornerActions({
  visible,
  onRemove,
  onMoveUp,
  onMoveDown,
  disableMoveUp = false,
  disableMoveDown = false
}: PaneCornerActionsProps): React.JSX.Element | null {
  if (!visible || (!onRemove && !onMoveUp && !onMoveDown)) {
    return null
  }

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 4,
        right: PLOT_EDGE_GAP,
        zIndex: 3,
        display: 'inline-flex',
        alignItems: 'center',
        pointerEvents: 'auto'
      }}
    >
      <LegendActionButtons
        boxed
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        disableMoveUp={disableMoveUp}
        disableMoveDown={disableMoveDown}
        onRemove={onRemove}
      />
    </Box>
  )
}
