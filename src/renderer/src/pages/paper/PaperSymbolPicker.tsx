import Box from '@mui/material/Box'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Close from '@mui/icons-material/Close'
import { useMemo, useState } from 'react'
import { PAPER_GROUP_SIZE_MAX } from '../../../../shared/paper/paperPlan'
import type { PaperSymbolRef } from '../../../../shared/types/paperPlan'
import type { Stock } from '../../../../shared/types/stock'
import { CHART_ICON_SX, ChartIconButton } from '../chart/ChartIconButton'
import { PAPER_FIELD_INSET, paperFieldSx } from './paperFieldSx'
import { matchesStockQuery, pinyinInitials } from '../stockMatch'

const RESULT_LIMIT = 8
const SYMBOL_GRID_COLUMNS = 2
const SYMBOL_GRID_ROWS = PAPER_GROUP_SIZE_MAX / SYMBOL_GRID_COLUMNS
const SYMBOL_SLOT_COUNT = SYMBOL_GRID_COLUMNS * SYMBOL_GRID_ROWS

export function PaperSymbolPicker({
  stocks,
  stocksLoading,
  stocksError,
  symbols,
  limit,
  disabled,
  selectedBelowSearch = false,
  placeholderGrid = false,
  onChange
}: {
  stocks: Stock[]
  stocksLoading: boolean
  stocksError: string | null
  symbols: PaperSymbolRef[]
  limit: number
  disabled?: boolean
  /** 已选列表放在搜索框下面。 */
  selectedBelowSearch?: boolean
  /** 一组指定标的：固定 2 列 × 5 行，空位先占好。 */
  placeholderGrid?: boolean
  onChange: (symbols: PaperSymbolRef[]) => void
}): React.JSX.Element {
  const [keyword, setKeyword] = useState('')
  const query = keyword.trim().toLowerCase()
  const selectedCodes = useMemo(() => new Set(symbols.map((symbol) => symbol.tsCode)), [symbols])
  const initials = useMemo(() => {
    const map = new Map<string, string>()
    for (const stock of stocks) {
      map.set(stock.ts_code, pinyinInitials(stock.name))
    }
    return map
  }, [stocks])
  const matches = useMemo(() => {
    if (!query) {
      return []
    }
    const found: Stock[] = []
    for (const stock of stocks) {
      if (limit !== 1 && selectedCodes.has(stock.ts_code)) {
        continue
      }
      if (!matchesStockQuery(stock, query, initials.get(stock.ts_code) ?? '')) {
        continue
      }
      found.push(stock)
      if (found.length >= RESULT_LIMIT) {
        break
      }
    }
    return found
  }, [initials, limit, query, selectedCodes, stocks])
  const full = limit > 1 && symbols.length >= limit

  const addSymbol = (stock: Stock): void => {
    if (selectedCodes.has(stock.ts_code)) {
      return
    }
    const next = { tsCode: stock.ts_code, name: stock.name }
    if (limit === 1) {
      onChange([next])
    } else if (symbols.length < limit) {
      onChange([...symbols, next])
    }
    setKeyword('')
  }

  const removeSymbol = (tsCode: string): void => {
    onChange(symbols.filter((item) => item.tsCode !== tsCode))
  }

  const symbolRow = (symbol: PaperSymbolRef): React.JSX.Element => (
    <Box key={symbol.tsCode} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, height: 24 }}>
      <Typography variant="body2" noWrap sx={{ flex: 1 }} title={`${symbol.name} ${symbol.tsCode}`}>
        {symbol.name || symbol.tsCode}
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
          {symbol.tsCode}
        </Typography>
      </Typography>
      <ChartIconButton
        ariaLabel={`移除${symbol.name || symbol.tsCode}`}
        title="移除"
        roomy
        disabled={disabled}
        onClick={() => removeSymbol(symbol.tsCode)}
      >
        <Close sx={CHART_ICON_SX} />
      </ChartIconButton>
    </Box>
  )

  const selectedList = placeholderGrid ? (
    <Box sx={{ mx: PAPER_FIELD_INSET, mt: 0.75 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        已选 {symbols.length} / {limit}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${SYMBOL_GRID_COLUMNS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${SYMBOL_GRID_ROWS}, 24px)`,
          columnGap: 1
        }}
      >
        {Array.from({ length: SYMBOL_SLOT_COUNT }, (_, index) => {
          const symbol = symbols[index]
          if (symbol) {
            return symbolRow(symbol)
          }
          return (
            <Typography
              key={`slot-${index}`}
              variant="body2"
              color="text.secondary"
              sx={{ height: 24, lineHeight: '24px', opacity: index < limit ? 1 : 0.4 }}
            >
              -
            </Typography>
          )
        })}
      </Box>
    </Box>
  ) : (
    <Box sx={{ mx: selectedBelowSearch ? PAPER_FIELD_INSET : 0, mt: selectedBelowSearch ? 0.75 : 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        已选 {symbols.length} / {limit}
      </Typography>
      {symbols.map((symbol) => symbolRow(symbol))}
    </Box>
  )

  const searchResults = stocksError ? (
    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.75 }}>
      {stocksError}
    </Typography>
  ) : stocksLoading ? (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
      股票列表加载中…
    </Typography>
  ) : query && matches.length === 0 ? (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
      无匹配股票
    </Typography>
  ) : matches.length > 0 ? (
    <Box
      sx={{
        mt: 0.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'background.paper'
      }}
    >
      {matches.map((stock) => (
        <ListItemButton
          key={stock.ts_code}
          dense
          disabled={disabled}
          selected={selectedCodes.has(stock.ts_code)}
          onClick={() => addSymbol(stock)}
        >
          <ListItemText
            primary={stock.name || stock.ts_code}
            secondary={stock.ts_code}
            primaryTypographyProps={{ variant: 'body2', noWrap: true }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </ListItemButton>
      ))}
    </Box>
  ) : null

  return (
    <Box>
      {selectedBelowSearch ? null : selectedList}
      <Box sx={{ position: 'relative' }}>
        <TextField
          size="small"
          autoComplete="off"
          disabled={disabled || stocksLoading || full}
          placeholder={full ? '已选满' : '代码 / 名称 / 首字母'}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          sx={[paperFieldSx, { mt: !selectedBelowSearch && symbols.length > 0 ? 0.75 : 0 }]}
        />
        <Box
          sx={{
            position: selectedBelowSearch ? 'absolute' : 'static',
            left: selectedBelowSearch ? PAPER_FIELD_INSET : 0,
            right: selectedBelowSearch ? PAPER_FIELD_INSET : 0,
            top: '100%',
            zIndex: 2,
            mx: selectedBelowSearch ? 0 : PAPER_FIELD_INSET
          }}
        >
          {searchResults}
        </Box>
      </Box>
      {selectedBelowSearch ? selectedList : null}
    </Box>
  )
}
