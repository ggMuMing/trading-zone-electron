import { ArrowDownward, ArrowUpward, Delete } from "@mui/icons-material"
import SettingsIcon from '@mui/icons-material/Settings';
import styled from "@emotion/styled"
import { Box } from "@mui/material"

type IndicatorColorMap = {
    [key: string]: string
}

const ToolbarButton = styled(Box)(() => {
    return {
        color: 'var(--c-sidTexCol)',
        alignItems: 'center',
        height: '16px',
        lineHeight: '16px',
        borderRadius: '4px',
        padding: '0 3px',

        '&:hover': {
            color: 'orange',
            cursor: 'pointer',
        },
    }
})

const IndicatorChartStatusBar = ({
    indicatorName,
    chosenDateValue,
    defaultDateValue,
    indicatorColorMap,
    deleteIndicator,
    openIndicatorSettings,
    moveUp,
    disableMoveUp = false,
    moveDown,
    disableMoveDown = false,
}: {
    chosenDateValue: Record<string, string | number>,
    defaultDateValue: Record<string, string | number>,
    indicatorName: string,
    indicatorColorMap: IndicatorColorMap,
    deleteIndicator: () => void,
    openIndicatorSettings?: () => void,
    moveUp?: () => void,
    disableMoveUp?: boolean,
    moveDown?: () => void,
    disableMoveDown?: boolean,
}) => {
    const hasChosenValues = chosenDateValue && Object.keys(chosenDateValue).length > 0
    const displayDateValue: Record<string, string | number> = hasChosenValues
        ? chosenDateValue
        : (defaultDateValue ?? {})

    const formatIndicatorName = (name: string) => name.toUpperCase()

    const formatValue2dp = (value: string | number | undefined) => {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value.toFixed(2) : String(value)
        }
        if (typeof value === 'string') {
            const n = Number(value)
            return Number.isFinite(n) ? n.toFixed(2) : value
        }
        return ''
    }
    return (
        <div style={{
            width: '100%',
            height: '24px',
            backgroundColor: 'rgba(0, 0, 0,0)',
            display: 'flex',
            justifyContent: 'space-between',
            color: 'var(--c-texPri)',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1000,
            padding: '2px 8px',
            alignItems: 'center',
            fontSize: 12,
            lineHeight: '16px',
        }}>
            <div style={{ display: 'flex', backgroundColor: '#000000', gap: 8 }}>
                <div style={{ paddingRight: '2px' }}>{formatIndicatorName(indicatorName)}</div>
                {
                    Object.keys(indicatorColorMap).map(key => (
                        <div key={key} style={{ color: indicatorColorMap[key] }}>
                            {formatIndicatorName(key)}: {formatValue2dp(displayDateValue[key])}
                        </div>
                    ))
                }
            </div>

            <div style={{ width: '20%', display: 'flex', justifyContent: 'flex-end' }}>
                {moveUp && (
                    <ToolbarButton
                        sx={disableMoveUp ? { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' } : undefined}
                        onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            if (!disableMoveUp) moveUp()
                        }}
                    >
                        <ArrowUpward sx={{ fontSize: 16 }} />
                    </ToolbarButton>
                )}
                {moveDown && (
                    <ToolbarButton
                        sx={disableMoveDown ? { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' } : undefined}
                        onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            if (!disableMoveDown) moveDown()
                        }}
                    >
                        <ArrowDownward sx={{ fontSize: 16 }} />
                    </ToolbarButton>
                )}
                {openIndicatorSettings && (
                    <ToolbarButton onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        openIndicatorSettings()
                    }}>
                        <SettingsIcon sx={{ fontSize: 16 }} />
                    </ToolbarButton>
                )}
                <ToolbarButton onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    deleteIndicator()
                }}>
                    <Delete sx={{ fontSize: 16 }} />
                </ToolbarButton>
            </div>
        </div>
    )
}

export default IndicatorChartStatusBar;
export {
    type IndicatorColorMap
}