import type { StockDailyData } from '../../api/apiType'
import ChartComponent from '../ChartComponent/ChartComponent'
import type { ChartTradeMarker } from '../ChartComponent/shared/chartTypes'

type PaperTradingChartProps = {
  chartData: StockDailyData[]
  stockCode: string
  adjust: 'qfq' | 'hfq' | 'standard'
  tradeMarkers?: ChartTradeMarker[]
  incrementalChartUpdate?: boolean
  clipIndicatorToChartData?: boolean
  openIndicatorsConfig?: (instanceId: string) => void
}

export default function PaperTradingChart(props: PaperTradingChartProps) {
  const {
    chartData,
    stockCode,
    adjust,
    tradeMarkers,
    incrementalChartUpdate,
    clipIndicatorToChartData,
    openIndicatorsConfig,
  } = props

  return (
    <ChartComponent
      chartData={chartData}
      stockCode={stockCode}
      adjust={adjust}
      tradeMarkers={tradeMarkers}
      incrementalChartUpdate={incrementalChartUpdate}
      clipIndicatorToChartData={clipIndicatorToChartData}
      enableStrategyMarkers={false}
      openIndicatorsConfig={openIndicatorsConfig}
    />
  )
}
