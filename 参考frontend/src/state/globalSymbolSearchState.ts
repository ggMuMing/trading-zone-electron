import { proxy } from 'valtio'
import type { Stock } from '../api/apiType'

export type SymbolSelectionSource = 'sidebar' | 'global-search' | 'chart-search'

type GlobalSymbolSearchState = {
  selectedStock: Stock | null
  selectedStockSource: SymbolSelectionSource | null
  symbolSearchOpen: boolean
  symbolSearchSeed: string
}

const globalSymbolSearchState = proxy<GlobalSymbolSearchState>({
  selectedStock: null,
  selectedStockSource: null,
  symbolSearchOpen: false,
  symbolSearchSeed: '',
})

export default globalSymbolSearchState

export const openSymbolSearch = (options?: { seed?: string }) => {
  globalSymbolSearchState.symbolSearchSeed = options?.seed ?? ''
  globalSymbolSearchState.symbolSearchOpen = true
}

export const closeSymbolSearch = () => {
  globalSymbolSearchState.symbolSearchOpen = false
}

export const setGlobalSelectedStock = (
  stock: Stock | null,
  source: SymbolSelectionSource = 'sidebar',
) => {
  globalSymbolSearchState.selectedStock = stock
  globalSymbolSearchState.selectedStockSource = source
}
