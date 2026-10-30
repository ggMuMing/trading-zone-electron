import { ChartPage } from '../ChartPage'
import { ScreenerPanel } from './ScreenerPanel'

const SCREEN_PICKER_WIDTH = 220
const SCREEN_PANEL_WIDTH = SCREEN_PICKER_WIDTH

export function ScreenerPage(): React.JSX.Element {
  return (
    <ChartPage
      fixedPickerStocks={[]}
      screenSession
      pickerFixedWidth={SCREEN_PICKER_WIDTH}
      showToolbarExtras={false}
      rightPanel={(session) => <ScreenerPanel session={session} />}
      rightPanelFixedWidth={SCREEN_PANEL_WIDTH}
    />
  )
}
