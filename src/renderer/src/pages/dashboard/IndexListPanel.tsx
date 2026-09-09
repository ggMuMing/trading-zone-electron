import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import type { DashboardIndexQuote } from '../../../../shared/types/dashboard'
import { formatPct, formatYi, signedColor } from './format'

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
  const market = indices.filter((item) => item.group === 'market')
  const broad = indices.filter((item) => item.group === 'broad')
  return (
    <Box sx={{ height: '100%', minHeight: 0, overflow: 'auto' }}>
      <IndexGroup title="大盘指数" rows={market} selected={selected} onSelect={onSelect} />
      <IndexGroup title="宽基指数" rows={broad} selected={selected} onSelect={onSelect} />
    </Box>
  )
}

function IndexGroup({
  title,
  rows,
  selected,
  onSelect
}: {
  title: string
  rows: DashboardIndexQuote[]
  selected: string
  onSelect: (tsCode: string) => void
}): React.JSX.Element {
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
            <TableCell align="right">涨跌幅</TableCell>
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
