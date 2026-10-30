import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect, useRef, useState } from 'react'
import { isChartUniverseIndexCode } from '../../../../shared/constants/chartUniverse'
import { isoToYyyymmdd, yyyymmddToIso } from '../../../../shared/constants/market'
import type { StrategyInfo } from '../../../../shared/types/pythonProtocol'
import type { StrategyScreenHit } from '../../../../shared/types/screener'
import type { ChartRightPanelContext } from '../ChartPage'
import { MonthCalendar } from './MonthCalendar'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function ScreenerPanel({ session }: { session: ChartRightPanelContext }): React.JSX.Element {
  const {
    stock,
    chartCode,
    chartTimes,
    adjust,
    windowStocks,
    coverageMax,
    universeId,
    setScreenHits,
    setDateHighlight,
    locateTrade
  } = session
  const [strategies, setStrategies] = useState<StrategyInfo[]>([])
  const [strategyId, setStrategyId] = useState('')
  const [signalIso, setSignalIso] = useState<string | null>(null)
  const [heldHits, setHeldHits] = useState<StrategyScreenHit[] | null>(null)
  const [screenSignalIso, setScreenSignalIso] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const runningRef = useRef(false)
  const seenUniverse = useRef(universeId)
  const maxIso = coverageMax ? yyyymmddToIso(coverageMax) : null
  const stockCodes = windowStocks
    .map((item) => item.ts_code)
    .filter((code) => !isChartUniverseIndexCode(code))

  useEffect(() => {
    if (!maxIso) {
      setSignalIso(null)
      return
    }
    setSignalIso((current) => (!current || current > maxIso ? maxIso : current))
  }, [maxIso])

  useEffect(() => {
    let cancelled = false
    void window.api.strategy
      .list()
      .then((result) => {
        if (!cancelled) {
          setStrategies(result.strategies)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRunError(errorMessage(error))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (seenUniverse.current === universeId) {
      return
    }
    seenUniverse.current = universeId
    setHeldHits(null)
    setScreenSignalIso(null)
    setRunError(null)
    setScreenHits(null)
    setDateHighlight(null)
  }, [universeId, setScreenHits, setDateHighlight])

  useEffect(() => {
    const code = stock?.ts_code
    if (!screenSignalIso || !code || !heldHits) {
      return
    }
    if (!heldHits.some((hit) => hit.ts_code === code)) {
      return
    }
    locateTrade(code, screenSignalIso)
  }, [stock?.ts_code, screenSignalIso, heldHits, locateTrade])

  useEffect(() => {
    const code = stock?.ts_code
    if (!screenSignalIso || !code || !heldHits) {
      setDateHighlight(null)
      return
    }
    const hit = heldHits.find((item) => item.ts_code === code)
    if (!hit || chartCode !== code || !chartTimes || !chartTimes.includes(screenSignalIso)) {
      setDateHighlight(null)
      return
    }
    setDateHighlight({ timeIso: screenSignalIso, kind: hit.side, prominent: true })
  }, [stock?.ts_code, chartCode, chartTimes, heldHits, screenSignalIso, setDateHighlight])

  const canRun = Boolean(
    coverageMax && signalIso && strategyId && stockCodes.length > 0 && !running
  )

  const run = (): void => {
    if (runningRef.current || !canRun || !signalIso || !coverageMax) {
      return
    }
    runningRef.current = true
    setRunning(true)
    setRunError(null)
    void window.api.strategy
      .screen({
        strategy_id: strategyId,
        ts_codes: stockCodes,
        signal_date: isoToYyyymmdd(signalIso),
        adjust
      })
      .then((result) => {
        setHeldHits(result.hits)
        setScreenSignalIso(signalIso)
        setScreenHits(result.hits)
        const first = result.hits[0]
        if (first) {
          locateTrade(first.ts_code, signalIso)
        } else {
          setDateHighlight(null)
        }
      })
      .catch((error: unknown) => {
        setRunError(errorMessage(error))
      })
      .finally(() => {
        runningRef.current = false
        setRunning(false)
      })
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        overflow: 'auto',
        px: 1.5,
        py: 1.5
      }}
    >
      <Box>
        <Typography variant="caption" color="text.secondary">
          数据截止日期
        </Typography>
        <Typography variant="body1">{maxIso ?? '尚无日线'}</Typography>
      </Box>
      <MonthCalendar
        value={signalIso}
        maxIso={maxIso}
        disabled={!maxIso || running}
        onChange={setSignalIso}
      />
      <TextField
        select
        size="small"
        label="策略"
        value={strategyId}
        disabled={running || strategies.length === 0}
        onChange={(event) => setStrategyId(event.target.value)}
        helperText={strategies.length === 0 ? '没有策略' : undefined}
      >
        <MenuItem value="">请选择策略</MenuItem>
        {strategies.map((item) => (
          <MenuItem key={item.id} value={item.id}>
            {item.name}
          </MenuItem>
        ))}
      </TextField>
      <Button variant="contained" disabled={!canRun} onClick={run}>
        {running ? '正在选股' : '执行选股'}
      </Button>
      {runError ? <Alert severity="error">{runError}</Alert> : null}
    </Box>
  )
}
