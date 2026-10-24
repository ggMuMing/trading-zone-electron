import { useState } from 'react'
import { useChartChrome } from '../../theme/chartChrome'
import { APP_FONT_STACK } from '../../theme/lwcFont'
import { LegendActionButtons } from './LegendActionButtons'

const BOX_PAD_X = 6
const BOX_PAD_Y = 2

export interface LegendNameHoverBoxProps {
  name: string
  onOpenSettings?: () => void
  onOpenEditor?: () => void
  onRemove?: () => void
}

export function LegendNameHoverBox({
  name,
  onOpenSettings,
  onOpenEditor,
  onRemove
}: LegendNameHoverBoxProps): React.JSX.Element {
  const chrome = useChartChrome()
  const [hovered, setHovered] = useState(false)

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        pointerEvents: 'auto',
        fontFamily: APP_FONT_STACK,
        lineHeight: '20px',
        whiteSpace: 'nowrap'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          position: 'relative',
          zIndex: 5,
          color: chrome.legendLabel
        }}
      >
        {name}
      </span>
      {hovered ? (
        <span
          style={{
            position: 'absolute',
            left: -BOX_PAD_X,
            top: -BOX_PAD_Y,
            bottom: -BOX_PAD_Y,
            zIndex: 4,
            display: 'inline-flex',
            alignItems: 'center',
            paddingLeft: BOX_PAD_X,
            paddingRight: 0,
            borderRadius: 3,
            backgroundColor: chrome.legendHoverBg,
            boxShadow: `0 0 0 1px ${chrome.legendHoverBorder}`,
            pointerEvents: 'auto'
          }}
        >
          <span aria-hidden style={{ visibility: 'hidden' }}>
            {name}
          </span>
          <LegendActionButtons
            roomy
            onOpenSettings={onOpenSettings}
            onOpenEditor={onOpenEditor}
            onRemove={onRemove}
          />
        </span>
      ) : null}
    </span>
  )
}
