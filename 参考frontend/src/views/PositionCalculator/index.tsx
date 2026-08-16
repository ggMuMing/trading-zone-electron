import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined'
import {
  Box,
  Divider,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'

function parsePositive(value: string): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function formatMoney(value: number) {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPrice(value: number) {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
}

function StatItem(props: { label: string, value: string, hint?: string }) {
  const { label, value, hint } = props
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      <Typography variant="caption" sx={{ opacity: 0.65 }}>{label}</Typography>
      <Typography variant="body1" sx={{ fontWeight: 700 }}>{value}</Typography>
      {hint ? (
        <Typography variant="caption" sx={{ opacity: 0.5 }}>{hint}</Typography>
      ) : null}
    </Box>
  )
}

export default function PositionCalculatorView() {
  const [initialCapital, setInitialCapital] = useState('100000')
  const [riskPct, setRiskPct] = useState('1')
  const [profitLossRatio, setProfitLossRatio] = useState('2')
  const [buyPrice, setBuyPrice] = useState('10')
  const [stopLossPrice, setStopLossPrice] = useState('9.5')

  const result = useMemo(() => {
    const capital = parsePositive(initialCapital)
    const risk = parsePositive(riskPct)
    const rr = parsePositive(profitLossRatio)
    const buy = parsePositive(buyPrice)
    const stop = parsePositive(stopLossPrice)

    if (capital === null || risk === null || rr === null || buy === null || stop === null) {
      return { ok: false as const, message: '请填写有效的正数' }
    }
    if (risk > 100) {
      return { ok: false as const, message: '单笔风险百分比不能超过 100%' }
    }
    if (stop >= buy) {
      return { ok: false as const, message: '做多时止损价须低于买入价' }
    }

    const riskPerShare = buy - stop
    const sellPrice = buy + riskPerShare * rr
    const riskAmount = capital * (risk / 100)
    const shares = riskAmount / riskPerShare
    const investedCapital = shares * buy
    const lots = Math.floor(shares / 100)
    const investedCapitalLots = lots * 100 * buy
    const lotShares = lots * 100
    const actualRiskAmount = lotShares > 0 ? lotShares * riskPerShare : 0
    const actualRiskPct = capital > 0 ? (actualRiskAmount / capital) * 100 : 0
    const targetProfit = lotShares > 0 ? lotShares * (sellPrice - buy) : shares * (sellPrice - buy)

    return {
      ok: true as const,
      riskPerShare,
      sellPrice,
      riskAmount,
      shares,
      investedCapital,
      lots,
      lotShares,
      investedCapitalLots,
      actualRiskAmount,
      actualRiskPct,
      targetProfit,
    }
  }, [initialCapital, riskPct, profitLossRatio, buyPrice, stopLossPrice])

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      p: 2,
      gap: 2,
      overflow: 'auto',
      background: 'var(--c-bacPri)',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CalculateOutlinedIcon fontSize="small" sx={{ opacity: 0.8 }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>仓位计算器</Typography>
      </Box>

      <Paper elevation={1} sx={{
        p: 2,
        background: 'var(--c-bacSec)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxWidth: 480,
      }}>
        <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 700 }}>输入参数</Typography>

        <TextField
          label="起始资金"
          size="small"
          type="number"
          value={initialCapital}
          onChange={(e) => setInitialCapital(e.target.value)}
          InputProps={{ endAdornment: <InputAdornment position="end">元</InputAdornment> }}
          inputProps={{ min: 0, step: 'any' }}
        />
        <TextField
          label="单笔风险"
          size="small"
          type="number"
          value={riskPct}
          onChange={(e) => setRiskPct(e.target.value)}
          InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
          inputProps={{ min: 0, max: 100, step: 'any' }}
          helperText="账户总资金中，本笔交易愿意承受的最大亏损比例"
        />
        <TextField
          label="盈亏比"
          size="small"
          type="number"
          value={profitLossRatio}
          onChange={(e) => setProfitLossRatio(e.target.value)}
          helperText="盈利空间 ÷ 亏损空间（用于计算目标卖出价）"
          inputProps={{ min: 0, step: 'any' }}
        />
        <TextField
          label="买入价"
          size="small"
          type="number"
          value={buyPrice}
          onChange={(e) => setBuyPrice(e.target.value)}
          InputProps={{ endAdornment: <InputAdornment position="end">元</InputAdornment> }}
          inputProps={{ min: 0, step: 'any' }}
        />
        <TextField
          label="止损价"
          size="small"
          type="number"
          value={stopLossPrice}
          onChange={(e) => setStopLossPrice(e.target.value)}
          InputProps={{ endAdornment: <InputAdornment position="end">元</InputAdornment> }}
          inputProps={{ min: 0, step: 'any' }}
        />
      </Paper>

      <Paper elevation={1} sx={{
        p: 2,
        background: 'var(--c-bacSec)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxWidth: 480,
      }}>
        <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 700 }}>计算结果</Typography>

        {!result.ok ? (
          <Typography variant="body2" sx={{ color: 'warning.main' }}>{result.message}</Typography>
        ) : (
          <>
            <StatItem
              label="卖出价（目标价）"
              value={`${formatPrice(result.sellPrice)} 元`}
              hint={`买入价 + (买入价 − 止损价) × 盈亏比 = ${formatPrice(result.sellPrice)}`}
            />
            <Divider />
            <StatItem
              label="投入资金（理论）"
              value={`${formatMoney(result.investedCapital)} 元`}
              hint={`单笔可承受亏损 ${formatMoney(result.riskAmount)} 元 ÷ 每股风险 ${formatPrice(result.riskPerShare)} 元 × 买入价`}
            />
            <StatItem
              label="理论股数"
              value={`${result.shares.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} 股`}
            />
            <Divider />
            <StatItem
              label="投入资金（按 100 股整手）"
              value={result.lots > 0 ? `${formatMoney(result.investedCapitalLots)} 元` : '—'}
              hint={result.lots > 0
                ? `${result.lots} 手（${result.lotShares} 股），实际风险约 ${result.actualRiskPct.toFixed(2)}%（${formatMoney(result.actualRiskAmount)} 元）`
                : '股数不足 1 手，无法按 A 股整手买入'}
            />
            {result.lots > 0 ? (
              <StatItem
                label="达目标卖出价时盈利（整手）"
                value={`${formatMoney(result.targetProfit)} 元`}
              />
            ) : null}
          </>
        )}
      </Paper>

      <Typography variant="caption" sx={{ opacity: 0.5, maxWidth: 480 }}>
        公式说明：每股风险 = 买入价 − 止损价；卖出价 = 买入价 + 每股风险 × 盈亏比；
        投入资金 = 起始资金 × 单笔风险% ÷ 每股风险 × 买入价。
      </Typography>
    </Box>
  )
}
