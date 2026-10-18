import { ChartPage } from '../ChartPage'
import { PaperTradingPanel } from './PaperTradingPanel'

/** 固定宽度。2 列 × 5 行格子表，含内边距约 350px。 */
const PAPER_PANEL_WIDTH = 350
/** 左侧标的列表固定宽度，不随图表页的拖动宽度变化。 */
const PAPER_PICKER_WIDTH = 220

export function PaperTradingPage(): React.JSX.Element {
  return (
    <ChartPage
      fixedPickerStocks={[]}
      pickerFixedWidth={PAPER_PICKER_WIDTH}
      showToolbarExtras={false}
      paperSession
      rightPanel={(session) => (
        <PaperTradingPanel symbol={session.stock} bar={session.bar} session={session} />
      )}
      rightPanelFixedWidth={PAPER_PANEL_WIDTH}
    />
  )
}
