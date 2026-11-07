import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isoToYyyymmdd, todayYyyymmdd, yyyymmddToIso } from '../../../../shared/constants/market'
import type { HeatmapQueryResult } from '../../../../shared/types/heatmap'
import { HeatmapCanvas } from './heatmap/HeatmapCanvas'
import type { HeatmapTitleAction } from './heatmap/heatmapPaint'
import { HeatmapSettingsPanel } from './HeatmapSettingsPanel'
import { defaultHeatmapSettings, type HeatmapSettings } from './heatmapSettings'

export function HeatmapPage(): React.JSX.Element {
  const [settings, setSettings] = useState<HeatmapSettings>(() =>
    defaultHeatmapSettings(yyyymmddToIso(todayYyyymmdd()))
  )
  const [result, setResult] = useState<HeatmapQueryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const asOfTouched = useRef(false)

  const handleChange = useCallback((next: HeatmapSettings) => {
    setSettings((current) => {
      if (next.asOf !== current.asOf) {
        asOfTouched.current = true
      }
      return next
    })
  }, [])

  const handleNavigate = useCallback((action: HeatmapTitleAction) => {
    setSettings((current) => navigateIndustry(current, action))
  }, [])

  const handleCoverageMax = useCallback((isoDate: string) => {
    if (asOfTouched.current) {
      return
    }
    setSettings((current) => (current.asOf === isoDate ? current : { ...current, asOf: isoDate }))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    window.api.heatmap
      .query({
        as_of: isoToYyyymmdd(settings.asOf),
        universe: settings.universe,
        area: settings.area,
        industry_level: settings.industryLevel,
        industry_code: settings.industryCode
      })
      .then((data) => {
        if (cancelled) {
          return
        }
        setResult(data)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (cancelled) {
          return
        }
        setResult(null)
        setError(reason instanceof Error ? reason.message : '热力图数据读取失败')
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [settings])

  const notice = heatmapNotice(settings, result, loading, error)
  const resolvedDate =
    result?.as_of && result.as_of !== isoToYyyymmdd(settings.asOf)
      ? yyyymmddToIso(result.as_of)
      : null

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <HeatmapSettingsPanel
        value={settings}
        onChange={handleChange}
        onCoverageMax={handleCoverageMax}
      />
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
        <HeatmapCanvas
          sectors={result?.sectors ?? []}
          focus={result?.focus ?? null}
          industryLevel={result?.industry_level ?? settings.industryLevel}
          asOf={result?.as_of ?? null}
          navEnabled={
            result != null &&
            result.industry_level === settings.industryLevel &&
            (result.focus?.code ?? '') === settings.industryCode
          }
          dimmed={loading && result !== null}
          onNavigate={handleNavigate}
        />
        {resolvedDate ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ position: 'absolute', bottom: 6, left: 10, pointerEvents: 'none' }}
          >
            行情日 {resolvedDate}
          </Typography>
        ) : null}
        {notice ? (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: 3,
              pointerEvents: 'none'
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              {notice}
            </Typography>
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}

function navigateIndustry(current: HeatmapSettings, action: HeatmapTitleAction): HeatmapSettings {
  if (action.direction === 'back-all') {
    return current.industryCode === '' && current.industryLevel === action.level
      ? current
      : { ...current, industryLevel: action.level, industryCode: '' }
  }
  if (!action.code) {
    return current
  }
  if (current.industryLevel === action.level && current.industryCode === action.code) {
    return current
  }
  return { ...current, industryLevel: action.level, industryCode: action.code }
}

function heatmapNotice(
  settings: HeatmapSettings,
  result: HeatmapQueryResult | null,
  loading: boolean,
  error: string | null
): string | null {
  if (error) {
    return error
  }
  if (!result) {
    return loading ? '正在读取热力图' : null
  }
  if (!result.as_of) {
    return '截止日之前没有日线'
  }
  if (result.sectors.length > 0 || (result.focus?.stocks.length ?? 0) > 0) {
    return null
  }
  if (settings.area === 'amount') {
    return '没有同时满足当前条件的股票'
  }
  return '没有同时满足当前条件的股票。市值来自日指标，未补全时面积为空'
}
