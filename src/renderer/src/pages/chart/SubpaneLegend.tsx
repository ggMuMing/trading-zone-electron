import { APP_FONT_STACK } from '../../theme/lwcFont'
import { LegendActionButtons } from './LegendActionButtons'

const LABEL_COLOR = 'rgba(0, 0, 0, 0.55)'

export interface SubpaneLegendItem {
  id: string
  label: string
  color: string
  value: number | null
}

export interface SubpaneLegendPane {
  pane: string
  instanceId: string
  title: string
  top: number
  items: SubpaneLegendItem[]
  disableMoveUp: boolean
  disableMoveDown: boolean
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--'
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

interface SubpaneLegendProps {
  panes: SubpaneLegendPane[]
  onOpenSettings?: (instanceId: string) => void
  onRemove?: (instanceId: string) => void
  onMovePane?: (instanceId: string, direction: 'up' | 'down') => void
}

export function SubpaneLegend({
  panes,
  onOpenSettings,
  onRemove,
  onMovePane
}: SubpaneLegendProps): React.JSX.Element | null {
  if (panes.length === 0) {
    return null
  }

  return (
    <>
      {panes.map((pane) => (
        <div
          key={pane.pane}
          style={{
            position: 'absolute',
            top: pane.top,
            left: 0,
            zIndex: 2,
            pointerEvents: 'none',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            padding: '4px 8px',
            fontSize: 13,
            lineHeight: '18px',
            fontFamily: APP_FONT_STACK,
            color: '#333333',
            backgroundColor: 'rgba(255, 255, 255, 0.85)'
          }}
        >
          <span style={{ color: LABEL_COLOR }}>{pane.title}</span>
          {pane.items.map((item) => (
            <span key={item.id} style={{ color: item.color }}>
              {item.label}: {formatNumber(item.value)}
            </span>
          ))}
          <LegendActionButtons
            onMoveUp={onMovePane ? () => onMovePane(pane.instanceId, 'up') : undefined}
            onMoveDown={onMovePane ? () => onMovePane(pane.instanceId, 'down') : undefined}
            disableMoveUp={pane.disableMoveUp}
            disableMoveDown={pane.disableMoveDown}
            onOpenSettings={onOpenSettings ? () => onOpenSettings(pane.instanceId) : undefined}
            onRemove={onRemove ? () => onRemove(pane.instanceId) : undefined}
          />
        </div>
      ))}
    </>
  )
}
