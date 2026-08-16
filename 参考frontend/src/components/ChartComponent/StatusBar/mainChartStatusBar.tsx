import { useCallback } from "react";
import SettingsIcon from "@mui/icons-material/Settings";
import { upColor, downColor } from "../../../static";
import type {BasicKlineData} from "../../../../data/type";

type MainOverlayIndicator = {
    id: string,
    name: string,
    chosenDateValue?: Record<string, string | number>,
    defaultDateValue: Record<string, string | number>,
    indicatorColorMap: Record<string, string>,
    indicatorLabelMap: Record<string, string>,
}

const MainChartStatusBar = ({ 
    chosenCandlestick, 
    defaultCandlestick,
    overlayIndicators = [],
    openIndicatorSettings,
}: {
    chosenCandlestick: BasicKlineData,
    defaultCandlestick: BasicKlineData,
    overlayIndicators?: MainOverlayIndicator[],
    openIndicatorSettings?: (instanceId: string) => void,
}) => {
    const displayCandlestick = chosenCandlestick || defaultCandlestick
    const STATUS_BAR_HEIGHT = 24
    const hasOverlayIndicators = overlayIndicators.length > 0
    const ocDiff =
        typeof displayCandlestick?.open === 'number'
        && typeof displayCandlestick?.close === 'number'
        && !Number.isNaN(displayCandlestick.open)
        && !Number.isNaN(displayCandlestick.close)
            ? displayCandlestick.close - displayCandlestick.open
            : null
    const ocColor = ocDiff === null ? 'rgba(240,239,237,0.85)' : (ocDiff >= 0 ? upColor : downColor)

    const formatNumber = useCallback((value: number | null | undefined, digits = 2) => {
        if (value === null || value === undefined || Number.isNaN(value)) return '--';
        return value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    }, []);

    const formatInt = useCallback((value: number | null | undefined) => {
        if (value === null || value === undefined || Number.isNaN(value)) return '--';
        return Math.round(value).toLocaleString();
    }, []);

    return (
        <>
            <div style={{
                width: '100%',
                height: `${hasOverlayIndicators ? STATUS_BAR_HEIGHT * 2 : STATUS_BAR_HEIGHT}px`,
                backgroundColor: 'rgba(0, 0, 0,0)',
                display: 'flex',
                flexDirection: 'column',
                color: 'var(--c-texPri)',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 1000,
                padding: '2px 8px',
                alignItems: 'flex-start',
                gap: 2,
                fontSize: 12,
                lineHeight: '16px',
            }}>
                <div style={{ display: 'flex', backgroundColor: '#000000', gap: 8, fontSize: 14 }}>
                    <div style={{ paddingRight: '5px' }}>
                        {displayCandlestick?.date ?? '--'}
                    </div>
                    <div style={{ color: 'rgba(240,239,237,0.85)' }}>O<span style={{color: ocColor}}>{formatNumber(displayCandlestick?.open, 2)}</span></div>
                    <div style={{ color: 'rgba(240,239,237,0.85)' }}>H<span style={{color: ocColor}}>{formatNumber(displayCandlestick?.high, 2)}</span></div>
                    <div style={{ color: 'rgba(240,239,237,0.85)' }}>L<span style={{color: ocColor}}>{formatNumber(displayCandlestick?.low, 2)}</span></div>
                    <div style={{ color: 'rgba(240,239,237,0.85)' }}>C<span style={{color: ocColor}}>{formatNumber(displayCandlestick?.close, 2)}</span></div>
                    {(() => {
                        const o = displayCandlestick?.open
                        const c = displayCandlestick?.close
                        if (o === undefined || c === undefined || Number.isNaN(o) || Number.isNaN(c)) return null
                        const diff = c - o
                        const pct = o === 0 ? 0 : (diff / o) * 100
                        const color = diff >= 0 ? upColor : downColor
                        const sign = diff >= 0 ? '+' : ''
                        return (
                            <div style={{ color }}>
                                {`${sign}${formatNumber(diff, 2)} (${sign}${formatNumber(pct, 2)}%)`}
                            </div>
                        )
                    })()}
                    <div style={{ color: 'rgba(240,239,237,0.85)' }}>VOL: {formatInt(displayCandlestick?.volume)}</div>
                    <div style={{ color: 'rgba(240,239,237,0.85)' }}>AMT: {formatNumber((displayCandlestick?.amount ?? 0) / 100000, 2)}亿</div>
                </div>
                {hasOverlayIndicators && (
                    <div style={{ display: 'flex', backgroundColor: '#000000', gap: 8, marginTop: '2px'}}>
                        {overlayIndicators.map(indicator => {
                            const hasChosen = indicator.chosenDateValue && Object.keys(indicator.chosenDateValue).length > 0
                            const valueMap = hasChosen ? indicator.chosenDateValue! : indicator.defaultDateValue
                            return (
                                <div key={indicator.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(240,239,237,0.85)' }}>
                                        <span>{indicator.name}</span>
                                        {openIndicatorSettings && (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    e.preventDefault()
                                                    openIndicatorSettings(indicator.id)
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key !== 'Enter' && e.key !== ' ') return
                                                    e.stopPropagation()
                                                    e.preventDefault()
                                                    openIndicatorSettings(indicator.id)
                                                }}
                                            >
                                                <SettingsIcon sx={{ fontSize: 14, color: 'var(--c-sidTexCol)' }} />
                                            </span>
                                        )}
                                    </div>
                                    {Object.keys(indicator.indicatorColorMap).map(key => {
                                        const value = valueMap[key]
                                        return (
                                            <div key={`${indicator.id}-${key}`} style={{ color: indicator.indicatorColorMap[key] }}>
                                                {indicator.indicatorLabelMap[key] || key}: {formatNumber(
                                                    typeof value === 'number' ? value : undefined,
                                                    2,
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </>
    )
}

export default MainChartStatusBar;