export type ChartTradeMarker = {
    time: string,
    position: 'belowBar' | 'aboveBar',
    shape: 'arrowUp' | 'arrowDown',
    color: string,
    text?: string,
}

export type ChartStatRange = {
    startDate: string,
    endDate: string,
}

export type SelectionRect = {
    startX: number,
    startY: number,
    endX: number,
    endY: number,
}

export type SelectionRange = {
    startIndex: number,
    endIndex: number,
}

export type IntervalStats = {
    count: number,
    startDate: string,
    endDate: string,
    startPrice: number,
    endPrice: number,
    highest: number,
    lowest: number,
    changeAmount: number,
    changePercent: number,
    averagePrice: number,
    totalVolume: number,
    totalAmount: number,
    upCount: number,
    downCount: number,
    flatCount: number,
    upVolume: number,
    downVolume: number,
    maxVolume: number,
    minVolume: number,
}
