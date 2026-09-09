import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import Typography from '@mui/material/Typography'
import { useMemo, useState } from 'react'
import type { DashboardIndexQuote } from '../../../../shared/types/dashboard'
import { formatPct, formatYi, signedColor } from './format'

type PctSort = 'default' | 'desc' | 'asc'

interface IndexListPanelProps {
  indices: DashboardIndexQuote[]
  selected: string
  onSelect: (tsCode: string) => void
}

export function IndexListPanel({
  indices,
  selected,
  onSelect
}: IndexListPanelProps): React.JSX.Element {
  const [pctSort, setPctSort] = useState<PctSort>('default')

  const market = useMemo(
    () => sortByPct(indices.filter((item) => item.group === 'market'), pctSort),
    [indices, pctSort]
  )
  const broad = useMemo(
    () => sortByPct(indices.filter((item) => item.group === 'broad'), pctSort),
    [indices, pctSort]
  )

  const onTogglePctSort = (): void => {
    setPctSort((current) => (current === 'default' ? 'desc' : current === 'desc' ? 'asc' : 'default'))
  }

  return (
    <Box sx={{ height: '100%', minHeight: 0, overflow: 'auto' }}>
      <IndexGroup
        title="大盘指数"
        rows={market}
        selected={selected}
        pctSort={pctSort}
        onTogglePctSort={onTogglePctSort}
        onSelect={onSelect}
      />
      <IndexGroup
        title="宽基指数"
        rows={broad}
        selected={selected}
        pctSort={pctSort}
        onTogglePctSort={onTogglePctSort}
        onSelect={onSelect}
      />
    </Box>
  )
}

function sortByPct(rows: DashboardIndexQuote[], pctSort: PctSort): DashboardIndexQuote[] {
  if (pctSort === 'default') {
    return rows
  }
  const direction = pctSort === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    if (a.pct_chg == null && b.pct_chg == null) {
      return 0
    }
    if (a.pct_chg == null) {
      return 1
    }
    if (b.pct_chg == null) {
      return -1
    }
    if (a.pct_chg === b.pct_chg) {
      return 0
    }
    return a.pct_chg > b.pct_chg ? direction : -direction
  })
}

function IndexGroup({
  title,
  rows,
  selected,
  pctSort,
  onTogglePctSort,
  onSelect
}: {
  title: string
  rows: DashboardIndexQuote[]
  selected: string
  pctSort: PctSort
  onTogglePctSort: () => void
  onSelect: (tsCode: string) => void
}): React.JSX.Element {
  const active = pctSort !== 'default'
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="subtitle2" sx={{ px: 1, py: 0.5, fontWeight: 700 }}>
        {title}
      </Typography>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>名称</TableCell>
            <TableCell align="right">收盘</TableCell>
            <TableCell align="right">
              <TableSortLabel
                active={active}
                direction={pctSort === 'asc' ? 'asc' : 'desc'}
                onClick={onTogglePctSort}
              >
                涨跌幅
              </TableSortLabel>
            </TableCell>
            <TableCell align="right">成交额(亿)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const color = signedColor(row.pct_chg)
            return (
              <TableRow
                key={row.ts_code}
                hover
                selected={row.ts_code === selected}
                onClick={() => onSelect(row.ts_code)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.name}</TableCell>
                <TableCell align="right" sx={{ color, fontVariantNumeric: 'tabular-nums' }}>
                  {row.close == null ? '—' : row.close.toFixed(2)}
                </TableCell>
                <TableCell align="right" sx={{ color, fontVariantNumeric: 'tabular-nums' }}>
                  {formatPct(row.pct_chg)}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatYi(row.amount, 0)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Box>
  )
}
