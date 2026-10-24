import { useChartChrome } from '../../theme/chartChrome'
import { APP_FONT_STACK } from '../../theme/lwcFont'
import { DOWN_COLOR, UP_COLOR } from '../dashboard/format'
import { LegendNameHoverBox } from './LegendNameHoverBox'

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
  onOpenEditor?: (instanceId: string) => void
  onRemove?: (instanceId: string) => void
}

export function PriceLegend({
  bar,
  overlays = [],
  onOpenSettings,
  onOpenEditor,
  onRemove
}: PriceLegendProps): React.JSX.Element | null {
  const chrome = useChartChrome()
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
        fontSize: 15,
        lineHeight: '20px',
        fontFamily: APP_FONT_STACK,
        color: chrome.text,
        backgroundColor: chrome.legendBg
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span>{bar.date}</span>
        <span style={{ color: chrome.legendLabel }}>
          O<span style={{ color: ocColor }}>{formatNumber(bar.open)}</span>
        </span>
        <span style={{ color: chrome.legendLabel }}>
          H<span style={{ color: ocColor }}>{formatNumber(bar.high)}</span>
        </span>
        <span style={{ color: chrome.legendLabel }}>
          L<span style={{ color: ocColor }}>{formatNumber(bar.low)}</span>
        </span>
        <span style={{ color: chrome.legendLabel }}>
          C<span style={{ color: ocColor }}>{formatNumber(bar.close)}</span>
        </span>
        <span style={{ color: ocColor }}>
          {`${sign}${formatNumber(diff)} (${sign}${formatNumber(pct)}%)`}
        </span>
        <span style={{ color: chrome.legendLabel }}>VOL: {formatInt(bar.vol)}</span>
        <span style={{ color: chrome.legendLabel }}>
          AMT: {formatNumber((bar.amount ?? 0) / 100000)}亿
        </span>
      </div>
      {overlays.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {overlays.map((group) => (
            <span key={group.instanceId} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <LegendNameHoverBox
                name={group.title}
                onOpenSettings={onOpenSettings ? () => onOpenSettings(group.instanceId) : undefined}
                onOpenEditor={onOpenEditor ? () => onOpenEditor(group.instanceId) : undefined}
                onRemove={onRemove ? () => onRemove(group.instanceId) : undefined}
              />
              {group.items.map((item) => (
                <span key={item.id} style={{ color: item.color }}>
                  {item.label}: {formatNumber(item.value)}
                </span>
              ))}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
