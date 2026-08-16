import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createChart, CandlestickSeries, HistogramSeries, AreaSeries, LineSeries, CrosshairMode, createSeriesMarkers, type IChartApi } from 'lightweight-charts';
import type { ISeriesApi, ISeriesMarkersPluginApi, SeriesType, Time } from "lightweight-charts";
import { useSnapshot } from "valtio";
import { Box } from "@mui/material";
import type { ChartIndicatorSeriesSpec, ChartLayout, ChartLayoutIndicatorInstance, StockDailyData } from "../../api/apiType";
import { calculateChartIndicator, deleteChartLayoutIndicator, getStrategyBuyPoints, moveChartPanelDown, moveChartPanelUp } from "../../api/api";
import { upColor, downColor } from "../../static";
import MainChartStatusBar from "./StatusBar/mainChartStatusBar";
import IndicatorChartStatusBar from "./StatusBar/indicatorChartStatusBar";
import type { BasicKlineData } from "../../../data/type";
import type { IndicatorColorMap } from "./StatusBar/indicatorChartStatusBar";
import { findTargetPaneTd } from "./ChartService";
import ChartComponentProxy, { syncChartLayout } from "./ChartComponentProxy";
import type { ChartStatRange, ChartTradeMarker, IntervalStats, SelectionRange, SelectionRect } from "./shared/chartTypes";
import { applyPaneStretchLayout, filterIndicatorRowsToChartData, getIndicatorTargetPaneIndex, mapRowsToSeriesData, normalizeChartDisplayDate, TIME_SCALE_RIGHT_OFFSET_BARS } from "./shared/chartUtils";
import ChartIntervalStatsDialog from "./shared/ChartIntervalStatsDialog";

type IndicatorPane = {
    id: string,
    name: string,
    paneIndex: number,
    container: HTMLElement,
    indicatorColorMap: IndicatorColorMap,
    defaultDateValue: Record<string, string | number>
}

type MainOverlayIndicatorStatus = {
    id: string,
    name: string,
    indicatorColorMap: IndicatorColorMap,
    indicatorLabelMap: Record<string, string>,
    defaultDateValue: Record<string, string | number>
}

type ChartComponentProps = {
    chartData: StockDailyData[],
    stockCode: string,
    adjust: 'qfq' | 'hfq' | 'standard',
    openIndicatorsConfig?: (instanceId: string) => void,
    tradeMarkers?: ChartTradeMarker[],
    statRange?: ChartStatRange | null,
    enableStrategyMarkers?: boolean,
    /** 模拟盘等场景：chartData 变长时不重建图表，仅更新 K 线/成交量/指标展示 */
    incrementalChartUpdate?: boolean,
    /** 指标一次性全量计算，但 series 只展示与 chartData 日期对齐的部分 */
    clipIndicatorToChartData?: boolean,
}

const ChartComponent = (props: ChartComponentProps) => {
    const {
        chartData = [],
        stockCode,
        adjust,
        openIndicatorsConfig,
        tradeMarkers,
        statRange,
        enableStrategyMarkers = true,
        incrementalChartUpdate = false,
        clipIndicatorToChartData = false,
    } = props;
    const chartState = useSnapshot(ChartComponentProxy)
    const layout = chartState.layout as ChartLayout | null
    const chartDataRef = useRef<StockDailyData[]>(chartData)
    const layoutRef = useRef<ChartLayout | null>(layout)
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
    const strategyMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)

    const [chosenCandlestick, setChosenCandlestick] = useState<BasicKlineData | null>(null)

    const [mainPane, setMainPane] = useState<HTMLElement | null>(null)
    const [indicatorPanes, setIndicatorPanes] = useState<IndicatorPane[]>([])
    const [mainOverlayIndicators, setMainOverlayIndicators] = useState<MainOverlayIndicatorStatus[]>([])
    const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null)
    const [isSelectionFinished, setIsSelectionFinished] = useState(false)
    const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null)
    const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false)

    //指标引用映射
    const [chosenIndicatorValueMap, setChosenIndicatorValueMap] = useState<Record<string, Record<string, string | number>>>({})
    const indicatorSeriesMapRef = useRef<Record<string, Record<string, ISeriesApi<SeriesType>>>>({})
    const indicatorDataRowsRef = useRef<Record<string, Record<string, string | number | null>[]>>({})
    const appliedInstanceIdsRef = useRef<Set<string>>(new Set())
    const appliedPaneIndexMapRef = useRef<Record<string, number>>({})
    const appliedIndicatorConfigKeyMapRef = useRef<Record<string, string>>({})
    /** 与 layout 中指标集合一致时才跳过 stretch，避免覆盖用户拖拽分隔条后的比例 */
    const lastLayoutStretchKeyRef = useRef<string | null>(null)
    const isCrosshairVisibleRef = useRef(false)
    const pinnedCrosshairIndexRef = useRef<number | null>(null)

    // 图表生命周期 → layout diff 的就绪信号；图表每次重建后自增
    const [chartGenKey, setChartGenKey] = useState<number>(0)
    const selectedStrategyKey = enableStrategyMarkers ? chartState.selectedStrategies.join('|') : ''

    useLayoutEffect(() => {
        chartDataRef.current = chartData
        layoutRef.current = layout
    }, [chartData, layout])

    const firstSubPaneIndex = indicatorPanes.length > 0
        ? Math.min(...indicatorPanes.map(item => item.paneIndex))
        : Number.POSITIVE_INFINITY
    const lastSubPaneIndex = indicatorPanes.length > 0
        ? Math.max(...indicatorPanes.map(item => item.paneIndex))
        : Number.NEGATIVE_INFINITY

    function formatIndicatorTitle(indicator: ChartLayoutIndicatorInstance) {
        const baseName = indicator.name || indicator.indicator_id
        const params = indicator.params ?? {}
        const keys = Object.keys(params)
        if (keys.length === 0) return baseName

        const preferredOrders: Record<string, string[]> = {
            kdj: ['n', 'k_smooth', 'd_smooth'],
            ma: ['period1', 'period2', 'period3', 'period4', 'period5'],
            macd: ['fast', 'slow', 'signal'],
        }

        const preferred = preferredOrders[indicator.indicator_id] ?? []
        const orderedKeys = [
            ...preferred.filter(k => k in params),
            ...keys.filter(k => !preferred.includes(k)).sort(),
        ]

        const values = orderedKeys
            .map(k => params[k])
            .filter(v => {
                if (indicator.indicator_id !== 'ma') {
                    return v === null || ['string', 'number', 'boolean'].includes(typeof v)
                }
                const period = typeof v === 'number' || typeof v === 'string' ? Number(v) : 0
                return Number.isInteger(period) && period > 0
            })
            .map(v => String(v))

        if (values.length === 0) return baseName
        return `${baseName}(${values.join(',')})`
    }

    function getIndicatorConfigKey(indicator: ChartLayoutIndicatorInstance) {
        return JSON.stringify({
            params: indicator.params || {},
            series: indicator.series || [],
        })
    }

    function getMaPeriod(indicator: ChartLayoutIndicatorInstance, seriesKey: string) {
        const match = /^ma([1-5])$/.exec(seriesKey)
        if (!match) return null

        const raw = indicator.params?.[`period${match[1]}`]
        const period = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : 0
        return Number.isInteger(period) && period > 0 ? period : null
    }

    function getActiveIndicatorSeries(indicator: ChartLayoutIndicatorInstance) {
        const series = indicator.series || []
        if (indicator.indicator_id !== 'ma') return series

        const activeSeries: ChartIndicatorSeriesSpec[] = []
        series.forEach(item => {
            const period = getMaPeriod(indicator, item.key)
            if (!period) return
            activeSeries.push({
                ...item,
                label: `MA${period}`,
                overlay: true,
                panel_index: 0,
            })
        })
        return activeSeries
    }

    async function recordTargetPaneTd(
        id: string,
        indicatorName: string,
        paneIndex: number,
        indicatorColorMap: IndicatorColorMap,
        defaultDateValue: Record<string, string | number>,
        shouldRecord: () => boolean,
    ) {
        const targetTd = await findTargetPaneTd(chartContainerRef.current, paneIndex)
        if (targetTd && shouldRecord()) {
            setIndicatorPanes(prev => {
                const nextPane = {
                    id,
                    name: indicatorName,
                    paneIndex,
                    container: targetTd,
                    indicatorColorMap: indicatorColorMap,
                    defaultDateValue,
                }
                const existingIndex = prev.findIndex(item => item.id === id)
                if (existingIndex === -1) return [...prev, nextPane]

                const next = [...prev]
                next[existingIndex] = nextPane
                return next
            })
        }
    }

    function upsertMainOverlayIndicatorStatus(
        indicator: ChartLayoutIndicatorInstance,
        displayRows: Record<string, string | number | null>[],
    ) {
        const seriesSpecs = getActiveIndicatorSeries(indicator)
        const nextStatus = {
            id: indicator.instance_id,
            name: formatIndicatorTitle(indicator),
            indicatorColorMap: getIndicatorColorMap(seriesSpecs),
            indicatorLabelMap: getIndicatorLabelMap(seriesSpecs),
            defaultDateValue: getDefaultIndicatorValue(displayRows, seriesSpecs),
        }
        setMainOverlayIndicators(prev => {
            const existingIndex = prev.findIndex(item => item.id === indicator.instance_id)
            if (existingIndex === -1) return [...prev, nextStatus]
            const next = [...prev]
            next[existingIndex] = nextStatus
            return next
        })
    }

    async function syncIndicatorStatusBars(
        desired: Array<{ panelIndex: number, indicator: ChartLayoutIndicatorInstance }>,
        shouldApply: () => boolean,
    ) {
        for (const { panelIndex, indicator } of desired) {
            if (!shouldApply()) return
            if (!indicatorSeriesMapRef.current[indicator.instance_id]) continue

            const rows = indicatorDataRowsRef.current[indicator.instance_id]
            if (!rows) continue

            const displayRows = getIndicatorDisplayRows(rows)
            const targetPaneIndex = getIndicatorTargetPaneIndex(panelIndex, indicator)
            const seriesSpecs = getActiveIndicatorSeries(indicator)

            if (targetPaneIndex > 0) {
                await recordTargetPaneTd(
                    indicator.instance_id,
                    formatIndicatorTitle(indicator),
                    targetPaneIndex,
                    getIndicatorColorMap(seriesSpecs),
                    getDefaultIndicatorValue(displayRows, seriesSpecs),
                    shouldApply,
                )
                continue
            }

            upsertMainOverlayIndicatorStatus(indicator, displayRows)
        }
    }

    function generateCrosshairOptions(isCrosshairVisible: boolean) {
        const crosshairColor = isCrosshairVisible ? '#9B7DFF' : 'rgba(0, 0, 0, 0)';
        return {
            mode: CrosshairMode.Normal,
            vertLine: {
                color: crosshairColor,
                labelBackgroundColor: '#9B7DFF',
            },
            horzLine: {
                color: crosshairColor,
                labelBackgroundColor: '#9B7DFF',
            },
        }
    }

    function getChartOptions(isCrosshairVisible: boolean) {
        return {
            width: chartContainerRef.current?.clientWidth || 800,
            height: chartContainerRef.current?.clientHeight || 600,
            layout: {
                background: {
                    color: '#000000',
                },
                textColor: '#f0efed',
                panes: {
                    separatorColor: '#f22c3d',
                    separatorHoverColor: 'rgba(255,0,0,0.2)',
                    enableResize: true
                }
            },
            grid: {
                vertLines: {
                    color: 'rgba(197, 203, 206, 0.1)',
                },
                horzLines: {
                    color: 'rgba(197, 203, 206, 0.1)',
                },
            },
            crosshair: generateCrosshairOptions(isCrosshairVisible),
            timeScale: {
                rightOffset: TIME_SCALE_RIGHT_OFFSET_BARS,
            },
        }
    }

    function applyKlineVolumeData(data: StockDailyData[]) {
        candlestickSeriesRef.current?.setData(data.map(item => ({
            time: item.trade_date,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
        })))
        volumeSeriesRef.current?.setData(data.map((item, index) => ({
            time: item.trade_date,
            value: item.vol,
            color: item.close < data[index - 1]?.close ? downColor : upColor,
            amount: item.amount,
        })))
    }

    function findLayoutIndicator(instanceId: string): ChartLayoutIndicatorInstance | null {
        const currentLayout = layoutRef.current
        if (!currentLayout) return null
        for (const panel of currentLayout.panels || []) {
            const hit = (panel.indicators || []).find(item => item.instance_id === instanceId)
            if (hit) return hit
        }
        return null
    }

    function getIndicatorDisplayRows(rows: Record<string, string | number | null>[]) {
        if (!clipIndicatorToChartData) return rows
        return filterIndicatorRowsToChartData(rows, chartDataRef.current)
    }

    function applyIndicatorSeriesData(
        indicator: ChartLayoutIndicatorInstance,
        rows: Record<string, string | number | null>[],
    ) {
        const seriesMap = indicatorSeriesMapRef.current[indicator.instance_id]
        if (!seriesMap) return
        const displayRows = getIndicatorDisplayRows(rows)
        const seriesSpecs = getActiveIndicatorSeries(indicator)
        seriesSpecs.forEach(seriesSpec => {
            const series = seriesMap[seriesSpec.key]
            if (!series) return
            series.setData(mapRowsToSeriesData(displayRows, seriesSpec, indicator) as never)
        })
    }

    function refreshClippedIndicatorSeries() {
        Object.keys(indicatorSeriesMapRef.current).forEach(instanceId => {
            const rows = indicatorDataRowsRef.current[instanceId]
            const indicator = findLayoutIndicator(instanceId)
            if (!rows || !indicator) return
            applyIndicatorSeriesData(indicator, rows)
        })
    }

    function createBaseChart(chart: IChartApi, data: StockDailyData[]) {
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: upColor,
            downColor: downColor,
            wickUpColor: upColor,
            wickDownColor: downColor,
            borderVisible: false,
        })
        candlestickSeriesRef.current = candlestickSeries
        strategyMarkersRef.current = createSeriesMarkers(candlestickSeries, [])

        // 根据涨跌幅调整成交量颜色
        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: '#d27b2d',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: 'volume',
        })
        volumeSeriesRef.current = volumeSeries

        candlestickSeries.priceScale().applyOptions({
            scaleMargins: {
                top: 0.1,
                bottom: 0.35,
            },
        })

        volumeSeries.priceScale().applyOptions({
            scaleMargins: {
                top: 0.75,
                bottom: 0,
            },
        })

        applyKlineVolumeData(data)
    }

    function addIndicatorSeries(
        chart: IChartApi,
        seriesSpec: ChartIndicatorSeriesSpec,
        paneIndex: number,
    ) {
        const color = seriesSpec.color || '#2962FF'
        const indicatorAxisLabelOptions = {
            // 移除指标在右侧价格轴上的“最后值标签/价格线”，只保留K线与成交额的标签
            lastValueVisible: false,
            priceLineVisible: false,
        } as const

        if (seriesSpec.plot_type === 'histogram') {
            return chart.addSeries(HistogramSeries, { color, ...indicatorAxisLabelOptions }, paneIndex)
        }

        if (seriesSpec.plot_type === 'area') {
            return chart.addSeries(AreaSeries, {
                topColor: color,
                bottomColor: `${color}44`,
                lineColor: color,
                lineWidth: 2,
                ...indicatorAxisLabelOptions,
            }, paneIndex)
        }

        if (seriesSpec.plot_type === 'candlestick') {
            return chart.addSeries(CandlestickSeries, {
                upColor,
                downColor,
                borderUpColor: upColor,
                borderDownColor: downColor,
                wickUpColor: upColor,
                wickDownColor: downColor,
                ...indicatorAxisLabelOptions,
            }, paneIndex)
        }

        return chart.addSeries(LineSeries, {
            color,
            lineWidth: 2,
            ...indicatorAxisLabelOptions,
        }, paneIndex)
    }

    function getDefaultIndicatorValue(
        rows: Record<string, string | number | null>[],
        seriesSpecs: ChartIndicatorSeriesSpec[],
    ) {
        const lastRow = rows[rows.length - 1] || {}
        return seriesSpecs.reduce<Record<string, string | number>>((acc, item) => {
            const value = lastRow[item.key]
            acc[item.key] = typeof value === 'number' || typeof value === 'string' ? value : '-'
            return acc
        }, {})
    }

    function findBarIndexByTime(time: string | number): number {
        const normalized = normalizeChartDisplayDate(String(time))
        return chartDataRef.current.findIndex(item => normalizeChartDisplayDate(item.trade_date) === normalized)
    }

    function buildIndicatorValueMapFromRow(
        row: Record<string, string | number | null> | undefined,
        seriesSpecs: ChartIndicatorSeriesSpec[],
    ): Record<string, string | number> {
        if (!row) return {}
        return seriesSpecs.reduce<Record<string, string | number>>((acc, spec) => {
            const value = row[spec.key]
            if (typeof value === 'number' || typeof value === 'string') {
                acc[spec.key] = value
            }
            return acc
        }, {})
    }

    function getIndicatorDefaultValuesForInstance(instanceId: string): Record<string, string | number> {
        const indicator = findLayoutIndicator(instanceId)
        const rows = indicatorDataRowsRef.current[instanceId]
        if (!indicator || !rows) return {}
        const displayRows = getIndicatorDisplayRows(rows)
        const seriesSpecs = getActiveIndicatorSeries(indicator)
        return getDefaultIndicatorValue(displayRows, seriesSpecs)
    }

    function refreshIndicatorLegendDefaults() {
        setMainOverlayIndicators(prev => prev.map(item => ({
            ...item,
            defaultDateValue: getIndicatorDefaultValuesForInstance(item.id),
        })))
        setIndicatorPanes(prev => prev.map(pane => ({
            ...pane,
            defaultDateValue: getIndicatorDefaultValuesForInstance(pane.id),
        })))
    }

    function applyIndicatorValuesAtIndex(index: number) {
        const currentChartData = chartDataRef.current
        const chosenData = currentChartData[index]
        if (!chosenData) return

        const date = normalizeChartDisplayDate(chosenData.trade_date)
        setChosenCandlestick({
            date: String(chosenData.trade_date),
            open: Number(chosenData.open),
            close: Number(chosenData.close),
            high: Number(chosenData.high),
            low: Number(chosenData.low),
            volume: chosenData.vol,
            amount: chosenData.amount,
        } as BasicKlineData)

        const nextMap: Record<string, Record<string, string | number>> = {}
        Object.keys(indicatorSeriesMapRef.current).forEach(indicatorId => {
            const indicator = findLayoutIndicator(indicatorId)
            const seriesSpecs = indicator ? getActiveIndicatorSeries(indicator) : []
            const rows = indicatorDataRowsRef.current[indicatorId]
            const row = rows?.find(item => normalizeChartDisplayDate(String(item.date)) === date)
            nextMap[indicatorId] = buildIndicatorValueMapFromRow(row, seriesSpecs)
        })
        setChosenIndicatorValueMap(nextMap)
    }

    function syncLegendAfterChartDataChange() {
        const currentChartData = chartDataRef.current
        refreshIndicatorLegendDefaults()
        if (!isCrosshairVisibleRef.current) {
            setChosenIndicatorValueMap({})
            setChosenCandlestick(null)
            return
        }
        const pinnedIndex = pinnedCrosshairIndexRef.current
        if (pinnedIndex !== null && pinnedIndex >= currentChartData.length - 2) {
            const nextIndex = currentChartData.length - 1
            applyIndicatorValuesAtIndex(nextIndex)
            pinnedCrosshairIndexRef.current = nextIndex
        }
    }

    function getIndicatorColorMap(seriesSpecs: ChartIndicatorSeriesSpec[]) {
        return seriesSpecs.reduce<IndicatorColorMap>((acc, item) => {
            acc[item.key] = item.color || '#2962FF'
            return acc
        }, {})
    }

    function getIndicatorLabelMap(seriesSpecs: ChartIndicatorSeriesSpec[]) {
        return seriesSpecs.reduce<Record<string, string>>((acc, item) => {
            acc[item.key] = item.label || item.key
            return acc
        }, {})
    }

    function removeIndicatorInstance(chart: IChartApi, instanceId: string, preserveCalculatedRows: boolean = false) {
        const seriesMap = indicatorSeriesMapRef.current[instanceId]
        if (seriesMap) {
            Object.values(seriesMap).forEach(series => {
                try { chart.removeSeries(series) } catch { /* 图表已销毁等场景静默忽略 */ }
            })
            delete indicatorSeriesMapRef.current[instanceId]
        }
        if (!preserveCalculatedRows) {
            delete indicatorDataRowsRef.current[instanceId]
        }
        appliedInstanceIdsRef.current.delete(instanceId)
        delete appliedPaneIndexMapRef.current[instanceId]
        delete appliedIndicatorConfigKeyMapRef.current[instanceId]
        setIndicatorPanes(prev => prev.filter(p => p.id !== instanceId))
        setMainOverlayIndicators(prev => prev.filter(p => p.id !== instanceId))
        setChosenIndicatorValueMap(prev => {
            if (!(instanceId in prev)) return prev
            const next = { ...prev }
            delete next[instanceId]
            return next
        })
    }

    async function addIndicatorWithRows(
        chart: IChartApi,
        panelIndex: number,
        indicator: ChartLayoutIndicatorInstance,
        rows: Record<string, string | number | null>[],
        shouldApply: () => boolean,
    ) {
        if (!shouldApply()) return

        const displayRows = getIndicatorDisplayRows(rows)
        const seriesSpecs = getActiveIndicatorSeries(indicator)
        const targetPaneIndex = getIndicatorTargetPaneIndex(panelIndex, indicator)
        const instanceSeriesMap: Record<string, ISeriesApi<SeriesType>> = {}
        seriesSpecs.forEach(seriesSpec => {
            const isOverlaySeries = targetPaneIndex === 0 && seriesSpec.overlay === true
            const paneIndex = isOverlaySeries ? 0 : targetPaneIndex
            const newSeries = addIndicatorSeries(chart, seriesSpec, paneIndex)
            newSeries.setData(mapRowsToSeriesData(displayRows, seriesSpec, indicator) as never)

            if (paneIndex > 0) {
                newSeries.priceScale().applyOptions({
                    scaleMargins: {
                        top: 0.25,
                        bottom: 0,
                    },
                })
            }

            instanceSeriesMap[seriesSpec.key] = newSeries
        })

        indicatorSeriesMapRef.current[indicator.instance_id] = instanceSeriesMap
        appliedPaneIndexMapRef.current[indicator.instance_id] = targetPaneIndex
        appliedIndicatorConfigKeyMapRef.current[indicator.instance_id] = getIndicatorConfigKey(indicator)

        if (targetPaneIndex > 0) {
            await recordTargetPaneTd(
                indicator.instance_id,
                formatIndicatorTitle(indicator),
                targetPaneIndex,
                getIndicatorColorMap(seriesSpecs),
                getDefaultIndicatorValue(displayRows, seriesSpecs),
                shouldApply,
            )
        } else {
            upsertMainOverlayIndicatorStatus(indicator, displayRows)
        }
    }

    async function addIndicatorFromLayout(
        chart: IChartApi,
        panelIndex: number,
        indicator: ChartLayoutIndicatorInstance,
        shouldApply: () => boolean,
    ) {
        const result = await calculateChartIndicator({
            indicator_type: indicator.indicator_id,
            stock_code: stockCode,
            adjust,
            params: indicator.params,
        })
        if (!result || !shouldApply()) return
        indicatorDataRowsRef.current[indicator.instance_id] = result.data
        await addIndicatorWithRows(chart, panelIndex, indicator, result.data, shouldApply)
    }

    useEffect(() => {
        /**合法性检查 如果数据为空或容器为空，则返回 */
        if (chartData === undefined || chartData.length === 0) return;
        if (!chartContainerRef.current) return;

        let isDragging = false
        let isMouseDown = false
        let isRightSelecting = false
        let startX = 0
        let startY = 0
        let selectionStartX = 0
        let selectionStartY = 0
        const threshold = 10
        let isCrosshairVisible = false
        let pinnedCrosshairIndex: number | null = null
        let cancelled = false

        setMainPane(null)
        setIndicatorPanes([])
        setMainOverlayIndicators([])
        setChosenIndicatorValueMap({})
        indicatorSeriesMapRef.current = {}
        indicatorDataRowsRef.current = {}
        appliedInstanceIdsRef.current = new Set()
        appliedPaneIndexMapRef.current = {}
        appliedIndicatorConfigKeyMapRef.current = {}
        lastLayoutStretchKeyRef.current = null
        candlestickSeriesRef.current = null
        volumeSeriesRef.current = null
        strategyMarkersRef.current = null

        chartRef.current = createChart(chartContainerRef.current, getChartOptions(isCrosshairVisible))

        createBaseChart(chartRef.current, chartData)
        chartRef.current.timeScale().scrollToRealTime()

        findTargetPaneTd(chartContainerRef.current, 0).then(td => {
            if (td && !cancelled) {
                setMainPane(td)
            }
        })

        // 通知 layout diff effect：图表已就绪，可以应用当前 layout
        setChartGenKey(prev => prev + 1)

        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || !entries[0].contentRect) return;
            const { width, height } = entries[0].contentRect;
            chartRef.current?.applyOptions({
                width,
                height: height,
            })
        })
        resizeObserver.observe(chartContainerRef.current)

        const getRelativeChartPoint = (e: MouseEvent) => {
            const containerRect = chartContainerRef.current?.getBoundingClientRect()
            if (!containerRect) return null
            return {
                x: Math.min(Math.max(e.clientX - containerRect.left, 0), containerRect.width),
                y: Math.min(Math.max(e.clientY - containerRect.top, 0), containerRect.height),
            }
        }

        function updateChosenAtIndex(index: number) {
            pinnedCrosshairIndex = index
            pinnedCrosshairIndexRef.current = index
            applyIndicatorValuesAtIndex(index)
        }

        function clampVisibleLogicalRange(from: number, to: number) {
            const currentChartData = chartDataRef.current
            const maxTo = currentChartData.length - 1 + TIME_SCALE_RIGHT_OFFSET_BARS
            const span = to - from

            if (from < 0) {
                from = 0
                to = Math.min(maxTo, from + span)
            }
            if (to > maxTo) {
                to = maxTo
                from = Math.max(0, to - span)
            }
            return { from, to }
        }

        /** 键盘逐根移动：每次最多平移 1 根 K 线，避免边缘一次跳多根 */
        function ensureBarIndexVisibleStep(index: number) {
            const chart = chartRef.current
            const currentChartData = chartDataRef.current
            if (!chart || currentChartData.length === 0) return

            const timeScale = chart.timeScale()
            const visibleRange = timeScale.getVisibleLogicalRange()
            if (!visibleRange) return

            let from = Number(visibleRange.from)
            let to = Number(visibleRange.to)
            const visibleFromBar = Math.ceil(from)
            const visibleToBar = Math.floor(to)

            if (index < visibleFromBar) {
                if (from <= 0) return
                from -= 1
                to -= 1
            } else if (index > visibleToBar) {
                const maxTo = currentChartData.length - 1 + TIME_SCALE_RIGHT_OFFSET_BARS
                if (to >= maxTo) return
                from += 1
                to += 1
            } else {
                return
            }

            timeScale.setVisibleLogicalRange(clampVisibleLogicalRange(from, to))
        }

        /** 单击定位：仅平移必要距离，使目标 K 线进入可见区 */
        function ensureBarIndexVisibleFit(index: number) {
            const chart = chartRef.current
            const currentChartData = chartDataRef.current
            if (!chart || currentChartData.length === 0) return

            const timeScale = chart.timeScale()
            const visibleRange = timeScale.getVisibleLogicalRange()
            if (!visibleRange) return

            let from = Number(visibleRange.from)
            let to = Number(visibleRange.to)
            const visibleFromBar = Math.ceil(from)
            const visibleToBar = Math.floor(to)

            if (index < visibleFromBar) {
                const delta = visibleFromBar - index
                from -= delta
                to -= delta
            } else if (index > visibleToBar) {
                const delta = index - visibleToBar
                from += delta
                to += delta
            } else {
                return
            }

            timeScale.setVisibleLogicalRange(clampVisibleLogicalRange(from, to))
        }

        function applyCrosshairAtIndex(index: number, scrollMode: 'step' | 'fit' = 'step') {
            const chart = chartRef.current
            const series = candlestickSeriesRef.current
            const row = chartDataRef.current[index]
            if (!chart || !series || !row) return

            if (scrollMode === 'fit') {
                ensureBarIndexVisibleFit(index)
            } else {
                ensureBarIndexVisibleStep(index)
            }
            chart.setCrosshairPosition(Number(row.close), row.trade_date as Time, series)
            updateChosenAtIndex(index)
        }

        function enableCrosshairKeyboard() {
            const container = chartContainerRef.current
            if (!container) return
            container.setAttribute('tabindex', '0')
            container.addEventListener('keydown', onHandleKeyDown)
            container.focus({ preventScroll: true })
        }

        function disableCrosshairKeyboard() {
            const container = chartContainerRef.current
            if (!container) return
            container.removeEventListener('keydown', onHandleKeyDown)
            pinnedCrosshairIndex = null
            pinnedCrosshairIndexRef.current = null
            chartRef.current?.clearCrosshairPosition()
        }

        const onHandleKeyDown = (e: KeyboardEvent) => {
            if (!isCrosshairVisible) return
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return

            e.preventDefault()
            e.stopPropagation()

            const currentChartData = chartDataRef.current
            const currentIndex = pinnedCrosshairIndex ?? currentChartData.length - 1
            const nextIndex = e.key === 'ArrowLeft'
                ? Math.max(0, currentIndex - 1)
                : Math.min(currentChartData.length - 1, currentIndex + 1)
            if (nextIndex === currentIndex) return

            applyCrosshairAtIndex(nextIndex)
        }

        // 处理点击事件,显示popup
        const onHandleClick = (e: MouseEvent) => {
            if (e.button !== 0) return
            if (isDragging) {
                e.preventDefault()
                e.stopPropagation()
                return
            }
            isCrosshairVisible = !isCrosshairVisible
            isCrosshairVisibleRef.current = isCrosshairVisible
            chartRef.current?.applyOptions({
                crosshair: generateCrosshairOptions(isCrosshairVisible)
            })

            if (isCrosshairVisible) {
                enableCrosshairKeyboard()
                const point = getRelativeChartPoint(e)
                if (point && chartRef.current) {
                    const logical = chartRef.current.timeScale().coordinateToLogical(point.x)
                    if (logical !== null) {
                        const currentChartData = chartDataRef.current
                        const index = Math.max(0, Math.min(currentChartData.length - 1, Math.round(Number(logical))))
                        applyCrosshairAtIndex(index, 'fit')
                    }
                }
            } else {
                disableCrosshairKeyboard()
            }
        }
        const onHandleMouseDown = (e: MouseEvent) => {
            if (e.button === 2) {
                const point = getRelativeChartPoint(e)
                if (!point) return
                e.preventDefault()
                e.stopPropagation()
                isRightSelecting = true
                isMouseDown = false
                isDragging = true
                selectionStartX = point.x
                selectionStartY = point.y
                document.body.style.cursor = 'crosshair'
                setIsSelectionFinished(false)
                setIsStatsDialogOpen(false)
                setSelectionRange(null)
                setSelectionRect({
                    startX: point.x,
                    startY: point.y,
                    endX: point.x,
                    endY: point.y,
                })
                return
            }
            if (e.button !== 0) return
            isMouseDown = true
            startX = e.clientX
            startY = e.clientY
        }
        const onHandleMouseMove = (e: MouseEvent) => {
            if (isRightSelecting) {
                const point = getRelativeChartPoint(e)
                if (!point) return
                e.preventDefault()
                e.stopPropagation()
                setSelectionRect(prev => prev ? {
                    ...prev,
                    endX: point.x,
                    endY: point.y,
                } : prev)
                return
            }
            if (!isMouseDown) return
            const dx = Math.abs(e.clientX - startX);
            const dy = Math.abs(e.clientY - startY);

            if (dx > threshold || dy > threshold) {
                isDragging = true;
                document.body.style.cursor = 'grabbing'
            }
        }
        const onHandleMouseUp = (e: MouseEvent) => {
            if (isRightSelecting) {
                e.preventDefault()
                e.stopPropagation()
                const point = getRelativeChartPoint(e)
                isRightSelecting = false
                isMouseDown = false
                document.body.style.cursor = 'default'
                if (point) {
                    setSelectionRect(prev => prev ? {
                        ...prev,
                        endX: point.x,
                        endY: point.y,
                    } : prev)
                    setIsSelectionFinished(
                        Math.abs(point.x - selectionStartX) > 4
                        || Math.abs(point.y - selectionStartY) > 4
                    )
                } else {
                    setIsSelectionFinished(false)
                }
                setTimeout(() => {
                    isDragging = false
                }, 100)
                return
            }
            isMouseDown = false
            setTimeout(() => {
                isDragging = false
                document.body.style.cursor = 'default'
            }, 100)
        }
        const onHandleContextMenu = (e: MouseEvent) => {
            e.preventDefault()
        }

        chartContainerRef.current.addEventListener('click', onHandleClick)
        chartContainerRef.current.addEventListener('mousedown', onHandleMouseDown)
        chartContainerRef.current.addEventListener('mousemove', onHandleMouseMove)
        chartContainerRef.current.addEventListener('mouseup', onHandleMouseUp)
        chartContainerRef.current.addEventListener('contextmenu', onHandleContextMenu)
        document.addEventListener('mouseup', onHandleMouseUp)

        chartRef.current.subscribeCrosshairMove(param => {
            // 鼠标移出图表区域时，param.time 可能为空
            if (!param.time) {
                if (!isCrosshairVisible) {
                    setChosenCandlestick(null)
                    setChosenIndicatorValueMap({})
                }
                return
            }
            const barIndex = findBarIndexByTime(String(param.time))
            // crosshair 可能指向的是空白区域（没有K线数据）
            if (barIndex < 0) {
                if (!isCrosshairVisible) {
                    setChosenCandlestick(null)
                    setChosenIndicatorValueMap({})
                }
                return
            }
            const currentChartData = chartDataRef.current
            const currentBar = currentChartData[barIndex]
            if (!currentBar) return

            if (isCrosshairVisible) {
                pinnedCrosshairIndex = barIndex
                pinnedCrosshairIndexRef.current = barIndex
            }

            setChosenCandlestick({
                date: String(currentBar.trade_date),
                open: Number(currentBar.open),
                close: Number(currentBar.close),
                high: Number(currentBar.high),
                low: Number(currentBar.low),
                volume: currentBar.vol,
                amount: currentBar.amount,
            } as BasicKlineData)

            const date = normalizeChartDisplayDate(currentBar.trade_date)
            Object.entries(indicatorSeriesMapRef.current).forEach(([indicatorId, seriesMap]) => {
                const indicator = findLayoutIndicator(indicatorId)
                const seriesSpecs = indicator ? getActiveIndicatorSeries(indicator) : []
                const rows = indicatorDataRowsRef.current[indicatorId]
                const row = rows?.find(item => normalizeChartDisplayDate(String(item.date)) === date)

                const valueMap = Object.entries(seriesMap).reduce<Record<string, string | number>>((acc, [seriesKey, series]) => {
                    const indicatorSeriesData = param.seriesData.get(series) as { value?: unknown, close?: unknown } | undefined
                    const value = indicatorSeriesData?.value ?? indicatorSeriesData?.close
                    if (typeof value === 'number' || typeof value === 'string') {
                        acc[seriesKey] = value
                        return acc
                    }
                    if (row) {
                        const rowValue = row[seriesKey]
                        if (typeof rowValue === 'number' || typeof rowValue === 'string') {
                            acc[seriesKey] = rowValue
                        }
                    }
                    return acc
                }, {})

                const resolvedMap = Object.keys(valueMap).length > 0
                    ? valueMap
                    : buildIndicatorValueMapFromRow(row, seriesSpecs)
                setChosenIndicatorValueMap(prev => ({ ...prev, [indicatorId]: resolvedMap }))
            })
        })

        return () => {
            cancelled = true
            chartRef.current?.remove()
            chartRef.current = null
            candlestickSeriesRef.current = null
            volumeSeriesRef.current = null
            strategyMarkersRef.current = null
            resizeObserver.disconnect()
            chartContainerRef.current?.removeEventListener('click', onHandleClick)
            chartContainerRef.current?.removeEventListener('mousedown', onHandleMouseDown)
            chartContainerRef.current?.removeEventListener('mousemove', onHandleMouseMove)
            chartContainerRef.current?.removeEventListener('mouseup', onHandleMouseUp)
            chartContainerRef.current?.removeEventListener('contextmenu', onHandleContextMenu)
            chartContainerRef.current?.removeEventListener('keydown', onHandleKeyDown)
            document.removeEventListener('mouseup', onHandleMouseUp)
            setMainPane(null)
            setIndicatorPanes([])
            setMainOverlayIndicators([])
            setChosenIndicatorValueMap({})
            setSelectionRect(null)
            setIsSelectionFinished(false)
            setSelectionRange(null)
            setIsStatsDialogOpen(false)
            indicatorSeriesMapRef.current = {}
            indicatorDataRowsRef.current = {}
            appliedInstanceIdsRef.current = new Set()
            appliedPaneIndexMapRef.current = {}
            appliedIndicatorConfigKeyMapRef.current = {}
            lastLayoutStretchKeyRef.current = null
        }
    }, [incrementalChartUpdate, stockCode, adjust, ...(incrementalChartUpdate ? [] : [chartData])])

    useEffect(() => {
        if (!incrementalChartUpdate || !chartRef.current || chartData.length === 0) return
        applyKlineVolumeData(chartData)
        if (clipIndicatorToChartData) {
            refreshClippedIndicatorSeries()
        }
        syncLegendAfterChartDataChange()
        chartRef.current.timeScale().scrollToRealTime()
    }, [chartData, incrementalChartUpdate, clipIndicatorToChartData, layout])

    useEffect(() => {
        const markersApi = strategyMarkersRef.current
        if (!markersApi) return

        if (tradeMarkers !== undefined) {
            markersApi.setMarkers(tradeMarkers.map(marker => ({
                time: marker.time as Time,
                position: marker.position,
                shape: marker.shape,
                color: marker.color,
                text: marker.text,
            })))
            return
        }

        if (!enableStrategyMarkers) {
            markersApi.setMarkers([])
            return
        }

        const strategyIds = selectedStrategyKey.split('|').filter(Boolean)
        if (!stockCode || chartData.length === 0 || strategyIds.length === 0) {
            markersApi.setMarkers([])
            return
        }

        let cancelled = false
        ;(async () => {
            const result = await getStrategyBuyPoints({
                stock_code: stockCode,
                adjust,
                strategy_ids: strategyIds,
            })
            if (cancelled || strategyMarkersRef.current !== markersApi) return

            markersApi.setMarkers((result?.signals || []).map(signal => ({
                time: signal.trade_date,
                position: 'belowBar' as const,
                shape: 'arrowUp' as const,
                color: signal.color || upColor,
                text: signal.label,
            })))
        })()

        return () => {
            cancelled = true
        }
    }, [stockCode, adjust, chartData.length, selectedStrategyKey, chartGenKey, tradeMarkers, enableStrategyMarkers])

    /**
     * 在 chart 当前 panes 中查找某个 indicator 实例所在的 pane index。
     * 通过该实例已注册的任一 series 引用，反查 paneApi.getSeries() 命中位置。
     * 找不到时返回 -1。
     */
    function findCurrentPaneIndexOfInstance(chart: IChartApi, instanceId: string) {
        const seriesMap = indicatorSeriesMapRef.current[instanceId]
        if (!seriesMap) return -1
        const probe = Object.values(seriesMap)[0]
        if (!probe) return -1
        const panes = chart.panes()
        for (let i = 0; i < panes.length; i++) {
            if (panes[i].getSeries().includes(probe)) return i
        }
        return -1
    }

    /**
     * 用 IPaneApi.moveTo 进行副图 pane 级重排，避免 remove/re-add series 引起的抖动。
     *
     * 算法：按目标 paneIndex 升序做 selection sort，每一步把"应该位于 target 的 instance"
     * 当前所在的 pane 调用 moveTo(target)；其余 pane 由 lightweight-charts 自动顺移。
     */
    function reorderSubPanesByMoveTo(
        chart: IChartApi,
        desiredPaneByInstance: Map<string, number>,
    ) {
        const targets = Array.from(desiredPaneByInstance.entries())
            .map(([instanceId, paneIndex]) => ({ instanceId, paneIndex }))
            .sort((a, b) => a.paneIndex - b.paneIndex)

        for (const { instanceId, paneIndex } of targets) {
            const currentPaneIndex = findCurrentPaneIndexOfInstance(chart, instanceId)
            if (currentPaneIndex < 0 || currentPaneIndex === paneIndex) continue
            chart.panes()[currentPaneIndex].moveTo(paneIndex)
        }
    }

    /**
     * moveTo 之后刷新 React 侧 indicatorPanes 的 paneIndex 与 container（td）。
     * lightweight-charts 内部会重排表格行，原 paneIndex 处的 td 现在归属另一个 pane，
     * 需要按"新 paneIndex"重新通过 findTargetPaneTd 拿对应的 td 作为 portal 挂载点。
     */
    async function refreshIndicatorPaneContainers(
        desiredPaneByInstance: Map<string, number>,
        shouldApply: () => boolean,
    ) {
        const entries = await Promise.all(
            Array.from(desiredPaneByInstance.entries()).map(async ([instanceId, paneIndex]) => {
                const td = await findTargetPaneTd(chartContainerRef.current, paneIndex)
                return { instanceId, paneIndex, td }
            }),
        )
        if (!shouldApply()) return

        setIndicatorPanes(prev => prev.map(pane => {
            const hit = entries.find(item => item.instanceId === pane.id)
            if (!hit) return pane
            return {
                ...pane,
                paneIndex: hit.paneIndex,
                container: hit.td ?? pane.container,
            }
        }))
    }

    // Effect B：layout 增量同步。仅按 instance_id diff 增删指标，避免重建图表导致时间轴重置
    useEffect(() => {
        const chart = chartRef.current
        if (!chart || !layout || !stockCode) return

        let cancelled = false
        const applied = appliedInstanceIdsRef.current

        const desired = [...(layout.panels || [])]
            .sort((a, b) => a.index - b.index)
            .flatMap(panel => (panel.indicators || []).map(indicator => ({
                panelIndex: panel.index,
                indicator,
            })))
        const desiredIds = new Set(desired.map(item => item.indicator.instance_id))

        // 快路径：仅副图位置变化（指标集合一致 + configKey 一致），用 IPaneApi.moveTo 整 pane 搬运。
        // 不动 series，stretchFactor 跟随 pane，主图也不会被销毁/重建，因此无抖动。
        const isSameInstanceSet =
            desiredIds.size === applied.size
            && desired.every(({ indicator }) => applied.has(indicator.instance_id))
        const isSameConfig = isSameInstanceSet && desired.every(({ indicator }) =>
            appliedIndicatorConfigKeyMapRef.current[indicator.instance_id] === getIndicatorConfigKey(indicator)
        )
        const reorderTargets = new Map<string, number>()
        if (isSameConfig) {
            desired.forEach(({ panelIndex, indicator }) => {
                const targetPaneIndex = getIndicatorTargetPaneIndex(panelIndex, indicator)
                if (targetPaneIndex <= 0) return
                if (appliedPaneIndexMapRef.current[indicator.instance_id] !== targetPaneIndex) {
                    reorderTargets.set(indicator.instance_id, targetPaneIndex)
                }
            })
        }

        if (isSameConfig && reorderTargets.size > 0) {
            const desiredPaneByInstance = new Map<string, number>()
            desired.forEach(({ panelIndex, indicator }) => {
                const targetPaneIndex = getIndicatorTargetPaneIndex(panelIndex, indicator)
                if (targetPaneIndex > 0) {
                    desiredPaneByInstance.set(indicator.instance_id, targetPaneIndex)
                }
            })

            reorderSubPanesByMoveTo(chart, desiredPaneByInstance)

            desiredPaneByInstance.forEach((paneIndex, instanceId) => {
                appliedPaneIndexMapRef.current[instanceId] = paneIndex
            })

            const shouldApply = () => !cancelled && chartRef.current === chart
            void refreshIndicatorPaneContainers(desiredPaneByInstance, shouldApply).then(() => {
                if (!shouldApply()) return
                return syncIndicatorStatusBars(desired, shouldApply)
            })

            return () => { cancelled = true }
        }

        // 非纯重排（增删 / configKey 变化）：保留原 diff 流程
        let removedAny = false

        Array.from(applied).forEach(id => {
            if (!desiredIds.has(id)) {
                removeIndicatorInstance(chart, id)
                removedAny = true
            }
        })

        desired.forEach(({ indicator }) => {
            if (!applied.has(indicator.instance_id)) return

            const configKey = getIndicatorConfigKey(indicator)
            if (
                appliedIndicatorConfigKeyMapRef.current[indicator.instance_id] !== configKey
            ) {
                removeIndicatorInstance(chart, indicator.instance_id)
                removedAny = true
            }
        })

        // 删除某副图后，lightweight-charts 会自动把后续副图的 pane 顺移；
        // 此时剩余副图在 React 侧的 paneIndex / container（td）已经过时，需要按目标位置同步。
        // moveTo 在 currentPaneIndex === target 时无操作，所以这里既兼容自动顺移、又兼容跨格调整。
        if (removedAny) {
            const desiredPaneByInstance = new Map<string, number>()
            desired.forEach(({ panelIndex, indicator }) => {
                if (!applied.has(indicator.instance_id)) return
                const targetPaneIndex = getIndicatorTargetPaneIndex(panelIndex, indicator)
                if (targetPaneIndex > 0) {
                    desiredPaneByInstance.set(indicator.instance_id, targetPaneIndex)
                }
            })
            if (desiredPaneByInstance.size > 0) {
                reorderSubPanesByMoveTo(chart, desiredPaneByInstance)
                desiredPaneByInstance.forEach((paneIndex, instanceId) => {
                    appliedPaneIndexMapRef.current[instanceId] = paneIndex
                })
                const shouldApply = () => !cancelled && chartRef.current === chart
                void refreshIndicatorPaneContainers(desiredPaneByInstance, shouldApply).then(() => {
                    if (!shouldApply()) return
                    return syncIndicatorStatusBars(desired, shouldApply)
                })
            }
        }

        ;(async () => {
            for (const { panelIndex, indicator } of desired) {
                if (cancelled) return
                if (applied.has(indicator.instance_id)) continue
                applied.add(indicator.instance_id)
                const shouldApply = () => !cancelled && applied.has(indicator.instance_id)
                await addIndicatorFromLayout(chart, panelIndex, indicator, shouldApply)
                // 若因 cancelled / 数据缺失而提前返回（series 未真正落地），回滚 applied 标记
                // 让下一轮 effect 能重新尝试添加该 instance
                if (!indicatorSeriesMapRef.current[indicator.instance_id]) {
                    applied.delete(indicator.instance_id)
                }
            }
            if (cancelled || chartRef.current !== chart) return
            const stretchKey = [...desiredIds].sort().join('|')
            if (lastLayoutStretchKeyRef.current !== stretchKey) {
                lastLayoutStretchKeyRef.current = stretchKey
                applyPaneStretchLayout(chart)
            }
            const shouldApply = () => !cancelled && chartRef.current === chart
            await syncIndicatorStatusBars(desired, shouldApply)
        })()

        return () => { cancelled = true }
    }, [layout, chartGenKey])

    const normalizedSelectionRect = selectionRect ? {
        left: Math.min(selectionRect.startX, selectionRect.endX),
        top: Math.min(selectionRect.startY, selectionRect.endY),
        width: Math.abs(selectionRect.endX - selectionRect.startX),
        height: Math.abs(selectionRect.endY - selectionRect.startY),
    } : null

    function getMainPaneRelativeBounds() {
        const chartContainer = chartContainerRef.current
        if (!chartContainer || !mainPane) return null

        const chartRect = chartContainer.getBoundingClientRect()
        const mainPaneRect = mainPane.getBoundingClientRect()
        return {
            top: Math.max(0, mainPaneRect.top - chartRect.top),
            height: Math.min(mainPaneRect.height, chartRect.height),
        }
    }

    function getSelectionRangeByRect(rect: NonNullable<typeof normalizedSelectionRect>): SelectionRange | null {
        const chart = chartRef.current
        if (!chart || chartData.length === 0) return null

        const startLogical = chart.timeScale().coordinateToLogical(rect.left)
        const endLogical = chart.timeScale().coordinateToLogical(rect.left + rect.width)
        if (startLogical === null || endLogical === null) return null

        const minLogical = Math.min(Number(startLogical), Number(endLogical))
        const maxLogical = Math.max(Number(startLogical), Number(endLogical))
        const startIndex = Math.max(0, Math.floor(minLogical))
        const endIndex = Math.min(chartData.length - 1, Math.ceil(maxLogical))
        if (endIndex < startIndex) return null

        return { startIndex, endIndex }
    }

    function getRectBySelectionRange(range: SelectionRange): SelectionRect | null {
        const chart = chartRef.current
        const mainPaneBounds = getMainPaneRelativeBounds()
        const startRow = chartData[range.startIndex]
        const endRow = chartData[range.endIndex]
        if (!chart || !mainPaneBounds || !startRow || !endRow) return null

        const startX = chart.timeScale().timeToCoordinate(startRow.trade_date)
        const endX = chart.timeScale().timeToCoordinate(endRow.trade_date)
        if (startX === null || endX === null) return null

        return {
            startX: Number(startX),
            endX: Number(endX),
            startY: mainPaneBounds.top,
            endY: mainPaneBounds.top + mainPaneBounds.height,
        }
    }

    function applySelectionRange(range: SelectionRange) {
        const nextRange = {
            startIndex: Math.max(0, Math.min(range.startIndex, chartData.length - 1)),
            endIndex: Math.max(0, Math.min(range.endIndex, chartData.length - 1)),
        }
        if (nextRange.startIndex > nextRange.endIndex) return

        const nextRect = getRectBySelectionRange(nextRange)
        if (!nextRect) return

        setSelectionRange(nextRange)
        setSelectionRect(nextRect)
        setIsSelectionFinished(false)
    }

    useEffect(() => {
        if (!statRange || chartData.length === 0) {
            return
        }

        let cancelled = false
        queueMicrotask(() => {
            if (cancelled) return

            const startIndex = chartData.findIndex(row => row.trade_date === statRange.startDate)
            const endIndex = chartData.findIndex(row => row.trade_date === statRange.endDate)
            if (startIndex < 0 || endIndex < 0) return

            const nextRange = {
                startIndex: Math.min(startIndex, endIndex),
                endIndex: Math.max(startIndex, endIndex),
            }
            setSelectionRange(nextRange)
            setSelectionRect(null)
            setIsSelectionFinished(false)
            setIsStatsDialogOpen(true)

            const chart = chartRef.current
            if (chart) {
                const padding = 15
                chart.timeScale().setVisibleLogicalRange({
                    from: Math.max(0, nextRange.startIndex - padding),
                    to: Math.min(chartData.length - 1 + TIME_SCALE_RIGHT_OFFSET_BARS, nextRange.endIndex + padding),
                })
            }
        })

        return () => {
            cancelled = true
        }
    }, [statRange, chartData, chartGenKey])

    function getSelectedKlineRows(range: SelectionRange | null) {
        if (!range) return []
        return chartData.slice(range.startIndex, range.endIndex + 1)
    }

    function handleSelectionStatsClick(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault()
        e.stopPropagation()
        if (!normalizedSelectionRect) return
        const nextRange = getSelectionRangeByRect(normalizedSelectionRect)
        if (!nextRange) return
        applySelectionRange(nextRange)
        setIsStatsDialogOpen(true)
    }

    const selectedKlineRows = useMemo(
        () => getSelectedKlineRows(selectionRange),
        [selectionRange, chartData],
    )

    const intervalStats = useMemo<IntervalStats | null>(() => {
        if (selectedKlineRows.length === 0) return null

        const first = selectedKlineRows[0]
        const last = selectedKlineRows[selectedKlineRows.length - 1]
        const startPrice = Number(first.open)
        const endPrice = Number(last.close)
        const highest = Math.max(...selectedKlineRows.map(item => Number(item.high)))
        const lowest = Math.min(...selectedKlineRows.map(item => Number(item.low)))
        const totalVolume = selectedKlineRows.reduce((sum, item) => sum + Number(item.vol), 0)
        const totalAmount = selectedKlineRows.reduce((sum, item) => sum + Number(item.amount), 0)
        const upRows = selectedKlineRows.filter(item => Number(item.close) > Number(item.open))
        const downRows = selectedKlineRows.filter(item => Number(item.close) < Number(item.open))
        const changeAmount = endPrice - startPrice

        return {
            count: selectedKlineRows.length,
            startDate: first.trade_date,
            endDate: last.trade_date,
            startPrice,
            endPrice,
            highest,
            lowest,
            changeAmount,
            changePercent: startPrice === 0 ? 0 : changeAmount / startPrice * 100,
            averagePrice: selectedKlineRows.reduce((sum, item) => sum + (Number(item.high) + Number(item.low)) / 2, 0) / selectedKlineRows.length,
            totalVolume,
            totalAmount,
            upCount: upRows.length,
            downCount: downRows.length,
            flatCount: selectedKlineRows.length - upRows.length - downRows.length,
            upVolume: upRows.reduce((sum, item) => sum + Number(item.vol), 0),
            downVolume: downRows.reduce((sum, item) => sum + Number(item.vol), 0),
            maxVolume: Math.max(...selectedKlineRows.map(item => Number(item.vol))),
            minVolume: Math.min(...selectedKlineRows.map(item => Number(item.vol))),
        }
    }, [selectedKlineRows])

    function changeRangeBoundary(boundary: 'start' | 'end', delta: number) {
        if (!selectionRange) return
        const nextRange = { ...selectionRange }
        if (boundary === 'start') {
            nextRange.startIndex = Math.max(0, Math.min(selectionRange.startIndex + delta, selectionRange.endIndex))
        } else {
            nextRange.endIndex = Math.min(chartData.length - 1, Math.max(selectionRange.endIndex + delta, selectionRange.startIndex))
        }
        applySelectionRange(nextRange)
    }

    function closeStatsDialog() {
        setIsStatsDialogOpen(false)
        setSelectionRange(null)
        setSelectionRect(null)
        setIsSelectionFinished(false)
    }

    return (
        <>
            <Box style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '100%', height: '100%', position: 'relative', flex: 1 }}>
                    <div
                        ref={chartContainerRef}
                        style={{ width: '100%', height: '100%', outline: 'none' }}
                    />
                    {
                        normalizedSelectionRect && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: normalizedSelectionRect.left,
                                    top: normalizedSelectionRect.top,
                                    width: normalizedSelectionRect.width,
                                    height: normalizedSelectionRect.height,
                                    border: '1px dashed rgba(255, 114, 86, 0.9)',
                                    backgroundColor: 'rgba(255, 114, 86, 0.12)',
                                    pointerEvents: 'none',
                                    zIndex: 5,
                                }}
                            />
                        )
                    }
                    {
                        normalizedSelectionRect && isSelectionFinished && (
                            <button
                                type="button"
                                onClick={handleSelectionStatsClick}
                                onMouseDown={e => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                }}
                                onContextMenu={e => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                }}
                                style={{
                                    position: 'absolute',
                                    left: normalizedSelectionRect.left,
                                    top: normalizedSelectionRect.top,
                                    zIndex: 6,
                                    padding: '4px 10px',
                                    border: '1px solid rgba(255, 114, 86, 0.9)',
                                    background: 'rgba(31, 35, 42, 0.92)',
                                    color: '#f0efed',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                }}
                            >
                                统计区间
                            </button>
                        )
                    }
                    <ChartIntervalStatsDialog
                        open={isStatsDialogOpen}
                        intervalStats={intervalStats}
                        selectionRange={selectionRange}
                        chartDataLength={chartData.length}
                        onClose={closeStatsDialog}
                        onChangeRangeBoundary={changeRangeBoundary}
                    />
                    {
                        mainPane && createPortal(<MainChartStatusBar
                            chosenCandlestick={chosenCandlestick as BasicKlineData}
                            defaultCandlestick={{
                                ...chartData[chartData.length - 1],
                                date: chartData[chartData.length - 1].trade_date,
                                volume: chartData[chartData.length - 1].vol,
                                amount: Number(chartData[chartData.length - 1].amount.toFixed(2)),
                            }}
                            overlayIndicators={mainOverlayIndicators.map(item => ({
                                id: item.id,
                                name: item.name,
                                chosenDateValue: chosenIndicatorValueMap[item.id],
                                defaultDateValue: item.defaultDateValue,
                                indicatorColorMap: item.indicatorColorMap,
                                indicatorLabelMap: item.indicatorLabelMap,
                            }))}
                            openIndicatorSettings={(instanceId) => {
                                openIndicatorsConfig?.(instanceId)
                            }}
                        />, mainPane)
                    }
                    {
                        indicatorPanes.map(pane => (
                            createPortal(<IndicatorChartStatusBar
                                indicatorName={pane.name}
                                chosenDateValue={chosenIndicatorValueMap[pane.id]}
                                defaultDateValue={pane.defaultDateValue}
                                indicatorColorMap={pane.indicatorColorMap as IndicatorColorMap}
                                disableMoveUp={pane.paneIndex === firstSubPaneIndex}
                                disableMoveDown={pane.paneIndex === lastSubPaneIndex}
                                moveUp={async () => {
                                    if (pane.paneIndex === firstSubPaneIndex) return
                                    const nextLayout = await moveChartPanelUp(pane.paneIndex)
                                    if (nextLayout) syncChartLayout(nextLayout)
                                }}
                                moveDown={async () => {
                                    if (pane.paneIndex === lastSubPaneIndex) return
                                    const nextLayout = await moveChartPanelDown(pane.paneIndex)
                                    if (nextLayout) syncChartLayout(nextLayout)
                                }}
                                openIndicatorSettings={() => {
                                    openIndicatorsConfig?.(pane.id)
                                }}
                                deleteIndicator={async () => {
                                    const nextLayout = await deleteChartLayoutIndicator(pane.id)
                                    if (nextLayout) syncChartLayout(nextLayout)
                                }}
                            />, pane.container)
                        ))
                    }
                </div>
            </Box>
        </>
    )
}

export default ChartComponent;