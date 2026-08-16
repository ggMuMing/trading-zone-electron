import { proxy } from 'valtio';
import type { ChartLayout, ChartLayoutIndicatorInstance } from '../../api/apiType';

type ChartComponentState = {
    layout: ChartLayout | null,
    selectedIndicators: string[],
    indicatorInstances: ChartLayoutIndicatorInstance[],
    selectedStrategies: string[],
}

const collectIndicatorInstances = (layout: ChartLayout | null) => {
    return (layout?.panels || []).flatMap(panel => panel.indicators || [])
}

const ChartComponentProxy = proxy<ChartComponentState>({
    layout: null,
    selectedIndicators: [],
    indicatorInstances: [],
    selectedStrategies: [],
})

const syncChartLayout = (layout: ChartLayout | null) => {
    ChartComponentProxy.layout = layout
    ChartComponentProxy.indicatorInstances = collectIndicatorInstances(layout)
    ChartComponentProxy.selectedIndicators = Array.from(new Set(
        ChartComponentProxy.indicatorInstances.map(item => item.indicator_id),
    ))
}

const syncSelectedStrategies = (selectedStrategies: string[]) => {
    ChartComponentProxy.selectedStrategies = Array.from(new Set(selectedStrategies))
}

export default ChartComponentProxy;
export {
    syncChartLayout,
    syncSelectedStrategies,
}