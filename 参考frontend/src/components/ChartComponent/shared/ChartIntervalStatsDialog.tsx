import { useRef } from 'react'
import { Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Paper, Typography } from '@mui/material'
import type { PaperProps } from '@mui/material/Paper'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import Draggable from 'react-draggable'
import { downColor, upColor } from '../../../static'
import type { IntervalStats, SelectionRange } from './chartTypes'

type StatItem = {
    label: string,
    value: string,
    color?: string,
}

type ChartIntervalStatsDialogProps = {
    open: boolean,
    intervalStats: IntervalStats | null,
    selectionRange: SelectionRange | null,
    chartDataLength: number,
    onClose: () => void,
    onChangeRangeBoundary: (boundary: 'start' | 'end', delta: number) => void,
}

function DraggablePaper(props: PaperProps) {
    const nodeRef = useRef<HTMLDivElement>(null)

    return (
        <Draggable
            nodeRef={nodeRef}
            handle="#kline-stat-dialog-title"
            cancel={'[class*="MuiDialogContent-root"]'}
        >
            <Paper ref={nodeRef} {...props} />
        </Draggable>
    )
}

function formatDate(date: string) {
    if (date.length !== 8) return date
    return `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)}`
}

function formatNumber(value: number, digits = 2) {
    return Number.isFinite(value) ? value.toFixed(digits) : '-'
}

function formatVolume(value: number) {
    if (!Number.isFinite(value)) return '-'
    if (Math.abs(value) >= 100000000) return `${(value / 100000000).toFixed(1)}亿`
    if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`
    return value.toFixed(0)
}

const statTextColor = (value: number) => value > 0 ? upColor : value < 0 ? downColor : '#f0efed'

function renderStatRows(items: StatItem[]) {
    return items.map(item => (
        <Box
            key={item.label}
            sx={{
                display: 'grid',
                gridTemplateColumns: '70px 1fr',
                alignItems: 'center',
                py: 0.35,
                columnGap: 1,
            }}
        >
            <Typography sx={{ color: '#d8d8d8', fontSize: 14 }}>{item.label}</Typography>
            <Typography sx={{ color: item.color || '#f0efed', fontSize: 14, textAlign: 'right' }}>
                {item.value}
            </Typography>
        </Box>
    ))
}

export default function ChartIntervalStatsDialog(props: ChartIntervalStatsDialogProps) {
    const {
        open,
        intervalStats,
        selectionRange,
        chartDataLength,
        onClose,
        onChangeRangeBoundary,
    } = props

    const leftStats = intervalStats ? [
        { label: '起始', value: formatNumber(intervalStats.startPrice) },
        { label: '最高', value: formatNumber(intervalStats.highest), color: upColor },
        { label: '涨幅', value: `${formatNumber(intervalStats.changePercent)}%`, color: statTextColor(intervalStats.changePercent) },
        { label: '均价', value: formatNumber(intervalStats.averagePrice) },
        { label: '总量', value: formatVolume(intervalStats.totalVolume) },
        { label: '上涨', value: `${intervalStats.upCount}根`, color: upColor },
        { label: '持平', value: `${intervalStats.flatCount}根` },
        { label: '阳线', value: `${intervalStats.upCount}根`, color: upColor },
        { label: '阳量', value: formatVolume(intervalStats.upVolume), color: upColor },
        { label: '最大量', value: formatVolume(intervalStats.maxVolume) },
    ] : []

    const rightStats = intervalStats ? [
        { label: '终止', value: formatNumber(intervalStats.endPrice), color: statTextColor(intervalStats.changeAmount) },
        { label: '最低', value: formatNumber(intervalStats.lowest), color: downColor },
        { label: '涨跌', value: formatNumber(intervalStats.changeAmount), color: statTextColor(intervalStats.changeAmount) },
        { label: '振幅', value: `${formatNumber(intervalStats.lowest === 0 ? 0 : (intervalStats.highest - intervalStats.lowest) / intervalStats.lowest * 100)}%` },
        { label: '总额', value: formatVolume(intervalStats.totalAmount) },
        { label: '下跌', value: `${intervalStats.downCount}根`, color: downColor },
        { label: '平线', value: `${intervalStats.flatCount}根` },
        { label: '阴线', value: `${intervalStats.downCount}根`, color: downColor },
        { label: '阴量', value: formatVolume(intervalStats.downVolume), color: downColor },
        { label: '最小量', value: formatVolume(intervalStats.minVolume) },
    ] : []

    return (
        <Dialog
            open={open && Boolean(intervalStats)}
            onClose={onClose}
            PaperComponent={DraggablePaper}
            aria-labelledby="kline-stat-dialog-title"
            hideBackdrop={false}
            PaperProps={{
                sx: {
                    width: 520,
                    maxWidth: 'calc(100vw - 48px)',
                    bgcolor: '#202020',
                    color: '#f0efed',
                    border: '1px solid rgba(255, 114, 86, 0.8)',
                    backgroundImage: 'none',
                },
            }}
        >
            <DialogTitle
                id="kline-stat-dialog-title"
                sx={{
                    cursor: 'move',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 1.25,
                    fontSize: 16,
                }}
            >
                <span>区间统计-统计个数: {intervalStats?.count ?? 0}</span>
                <IconButton
                    size="small"
                    onClick={onClose}
                    sx={{ color: '#f0efed' }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ px: 2, pb: 2, pt: 1 }}>
                {intervalStats && selectionRange && (
                    <>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 2,
                                mb: 1.5,
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography sx={{ color: '#d8d8d8', fontSize: 14 }}>起始时间:</Typography>
                                <IconButton
                                    size="small"
                                    disabled={selectionRange.startIndex <= 0}
                                    onClick={() => onChangeRangeBoundary('start', -1)}
                                    sx={{ color: '#f0efed', p: 0.25 }}
                                >
                                    <KeyboardArrowLeftIcon fontSize="small" />
                                </IconButton>
                                <Typography sx={{ flex: 1, textAlign: 'center', fontSize: 14 }}>
                                    {formatDate(intervalStats.startDate)}
                                </Typography>
                                <IconButton
                                    size="small"
                                    disabled={selectionRange.startIndex >= selectionRange.endIndex}
                                    onClick={() => onChangeRangeBoundary('start', 1)}
                                    sx={{ color: '#f0efed', p: 0.25 }}
                                >
                                    <KeyboardArrowRightIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography sx={{ color: '#d8d8d8', fontSize: 14 }}>终止时间:</Typography>
                                <IconButton
                                    size="small"
                                    disabled={selectionRange.endIndex <= selectionRange.startIndex}
                                    onClick={() => onChangeRangeBoundary('end', -1)}
                                    sx={{ color: '#f0efed', p: 0.25 }}
                                >
                                    <KeyboardArrowLeftIcon fontSize="small" />
                                </IconButton>
                                <Typography sx={{ flex: 1, textAlign: 'center', fontSize: 14 }}>
                                    {formatDate(intervalStats.endDate)}
                                </Typography>
                                <IconButton
                                    size="small"
                                    disabled={selectionRange.endIndex >= chartDataLength - 1}
                                    onClick={() => onChangeRangeBoundary('end', 1)}
                                    sx={{ color: '#f0efed', p: 0.25 }}
                                >
                                    <KeyboardArrowRightIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Box>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1px 1fr',
                                columnGap: 2,
                            }}
                        >
                            <Box>{renderStatRows(leftStats)}</Box>
                            <Box sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
                            <Box>{renderStatRows(rightStats)}</Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
                            <Button size="small" onClick={onClose}>
                                关闭
                            </Button>
                        </Box>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
