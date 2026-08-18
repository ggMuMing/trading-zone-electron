import { APP_FONT_STACK } from '../../theme/lwcFont'

const LABEL_COLOR = 'rgba(0, 0, 0, 0.55)'

export interface SubpaneLegendItem {
  id: string
  label: string
  color: string
  value: number | null
}

export interface SubpaneLegendPane {
  pane: string
  title: string
  top: number
  items: SubpaneLegendItem[]
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
}

export function SubpaneLegend({ panes }: SubpaneLegendProps): React.JSX.Element | null {
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
        </div>
      ))}
    </>
  )
}
