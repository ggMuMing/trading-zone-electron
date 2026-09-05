import { APP_FONT_STACK } from '../../theme/lwcFont'
import { LegendActionButtons } from './LegendActionButtons'

const UP_COLOR = '#ef5350'
const DOWN_COLOR = '#26a69a'
const LABEL_COLOR = 'rgba(0, 0, 0, 0.55)'

export interface PriceLegendBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  vol: number | null
  amount: number | null
}

export interface PriceLegendOverlay {
  id: string
  label: string
  color: string
  value: number | null
}

export interface PriceLegendOverlayGroup {
  instanceId: string
  title: string
  items: PriceLegendOverlay[]
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

function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--'
  }
  return Math.round(value).toLocaleString()
}

interface PriceLegendProps {
  bar: PriceLegendBar | null
  overlays?: PriceLegendOverlayGroup[]
  onOpenSettings?: (instanceId: string) => void
  onRemove?: (instanceId: string) => void
}

export function PriceLegend({
  bar,
  overlays = [],
  onOpenSettings,
  onRemove
}: PriceLegendProps): React.JSX.Element | null {
  if (!bar) {
    return null
  }

  const diff = bar.close - bar.open
  const pct = bar.open === 0 ? 0 : (diff / bar.open) * 100
  const ocColor = diff >= 0 ? UP_COLOR : DOWN_COLOR
  const sign = diff >= 0 ? '+' : ''

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 2,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        padding: '4px 8px',
        fontSize: 13,
        lineHeight: '18px',
        fontFamily: APP_FONT_STACK,
        color: '#333333',
        backgroundColor: 'rgba(255, 255, 255, 0.85)'
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span>{bar.date}</span>
        <span style={{ color: LABEL_COLOR }}>
          O<span style={{ color: ocColor }}>{formatNumber(bar.open)}</span>
        </span>
        <span style={{ color: LABEL_COLOR }}>
          H<span style={{ color: ocColor }}>{formatNumber(bar.high)}</span>
        </span>
        <span style={{ color: LABEL_COLOR }}>
          L<span style={{ color: ocColor }}>{formatNumber(bar.low)}</span>
        </span>
        <span style={{ color: LABEL_COLOR }}>
          C<span style={{ color: ocColor }}>{formatNumber(bar.close)}</span>
        </span>
        <span style={{ color: ocColor }}>
          {`${sign}${formatNumber(diff)} (${sign}${formatNumber(pct)}%)`}
        </span>
        <span style={{ color: LABEL_COLOR }}>VOL: {formatInt(bar.vol)}</span>
        <span style={{ color: LABEL_COLOR }}>
          AMT: {formatNumber((bar.amount ?? 0) / 100000)}亿
        </span>
      </div>
      {overlays.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {overlays.map((group) => (
            <span key={group.instanceId} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: LABEL_COLOR }}>{group.title}</span>
              {group.items.map((item) => (
                <span key={item.id} style={{ color: item.color }}>
                  {item.label}: {formatNumber(item.value)}
                </span>
              ))}
              <LegendActionButtons
                onOpenSettings={onOpenSettings ? () => onOpenSettings(group.instanceId) : undefined}
                onRemove={onRemove ? () => onRemove(group.instanceId) : undefined}
              />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
