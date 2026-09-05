import { APP_FONT_STACK } from '../../theme/lwcFont'
import { LegendNameHoverBox } from './LegendNameHoverBox'

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
  onOpenEditor?: (instanceId: string) => void
  onRemove?: (instanceId: string) => void
}

export function SubpaneLegend({
  panes,
  onOpenSettings,
  onOpenEditor,
  onRemove
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
            fontSize: 15,
            lineHeight: '20px',
            fontFamily: APP_FONT_STACK,
            color: '#333333',
            backgroundColor: 'rgba(255, 255, 255, 0.85)'
          }}
        >
          <LegendNameHoverBox
            name={pane.title}
            onOpenSettings={onOpenSettings ? () => onOpenSettings(pane.instanceId) : undefined}
            onOpenEditor={onOpenEditor ? () => onOpenEditor(pane.instanceId) : undefined}
            onRemove={onRemove ? () => onRemove(pane.instanceId) : undefined}
          />
          {pane.items.map((item) => (
            <span key={item.id} style={{ color: item.color }}>
              {item.label}: {formatNumber(item.value)}
            </span>
          ))}
        </div>
      ))}
    </>
  )
}
