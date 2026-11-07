import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect, useMemo, useState } from 'react'
import { yyyymmddToIso } from '../../../../shared/constants/market'
import type { SwIndustryLevel, SwIndustryNode } from '../../../../shared/types/swIndustry'
import {
  HEATMAP_AREA_OPTIONS,
  HEATMAP_INDUSTRY_LEVELS,
  HEATMAP_UNIVERSE_OPTIONS,
  industryLevelLabel,
  type HeatmapAreaId,
  type HeatmapIndustryLevel,
  type HeatmapSettings
} from './heatmapSettings'

const controlSx = {
  '& .MuiOutlinedInput-root': {
    fontSize: 12,
    minHeight: 28
  },
  '& .MuiOutlinedInput-input, & .MuiSelect-select': {
    py: '3px',
    px: 1,
    fontSize: 12,
    lineHeight: '20px',
    minHeight: 'unset'
  },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
  '& .MuiSvgIcon-root': { fontSize: 16, right: 2 }
} as const

const menuItemSx = { fontSize: 12, minHeight: 28, py: 0.25 } as const

interface HeatmapSettingsPanelProps {
  value: HeatmapSettings
  onChange: (next: HeatmapSettings) => void
  onCoverageMax: (isoDate: string) => void
}

export function HeatmapSettingsPanel({
  value,
  onChange,
  onCoverageMax
}: HeatmapSettingsPanelProps): React.JSX.Element {
  const [industries, setIndustries] = useState<SwIndustryNode[]>([])
  const [industryLoaded, setIndustryLoaded] = useState(false)
  const [industryError, setIndustryError] = useState<string | null>(null)
  const [coverageBound, setCoverageBound] = useState<{ min: string; max: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.market
      .coverage()
      .then((coverage) => {
        if (cancelled) {
          return
        }
        if (coverage.max_date) {
          onCoverageMax(yyyymmddToIso(coverage.max_date))
          setCoverageBound({
            min: coverage.min_date ? yyyymmddToIso(coverage.min_date) : '',
            max: yyyymmddToIso(coverage.max_date)
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCoverageBound(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [onCoverageMax])

  useEffect(() => {
    let cancelled = false
    void window.api.industry
      .tree()
      .then((rows) => {
        if (!cancelled) {
          setIndustries(rows)
          setIndustryError(null)
          setIndustryLoaded(true)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setIndustries([])
          setIndustryError(err instanceof Error ? err.message : String(err))
          setIndustryLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const levelIndustries = useMemo(() => {
    return industries
      .filter((node) => node.level === (value.industryLevel as SwIndustryLevel))
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  }, [industries, value.industryLevel])

  const patch = (partial: Partial<HeatmapSettings>): void => {
    onChange({ ...value, ...partial })
  }

  const levelName = industryLevelLabel(value.industryLevel)

  return (
    <Box
      sx={{
        width: 200,
        flexShrink: 0,
        minHeight: 0,
        overflow: 'auto',
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        px: 1,
        py: 1
      }}
    >
      <Stack spacing={1.25}>
        <SettingField label="数据截止时间">
          <TextField
            size="small"
            fullWidth
            type="date"
            value={value.asOf}
            onChange={(event) => {
              const next = event.target.value
              if (next) {
                patch({ asOf: next })
              }
            }}
            sx={controlSx}
            slotProps={{
              htmlInput: {
                'aria-label': '数据截止时间',
                min: coverageBound?.min || undefined,
                max: coverageBound?.max || undefined
              }
            }}
          />
        </SettingField>

        <SettingField label="指数分类">
          <Box
            role="listbox"
            aria-label="指数分类"
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              py: 0.25
            }}
          >
            {HEATMAP_UNIVERSE_OPTIONS.map((option) => {
              const selected = value.universe === option.id
              return (
                <Box
                  key={option.id}
                  component="button"
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => patch({ universe: option.id })}
                  sx={{
                    display: 'block',
                    width: '100%',
                    m: 0,
                    px: 0.75,
                    py: 0.125,
                    border: 0,
                    borderRadius: 0.5,
                    textAlign: 'left',
                    font: 'inherit',
                    fontSize: 12,
                    lineHeight: '20px',
                    cursor: 'pointer',
                    color: selected ? 'primary.main' : 'text.primary',
                    bgcolor: selected ? 'action.selected' : 'transparent',
                    fontWeight: selected ? 600 : 400,
                    '&:hover': {
                      bgcolor: selected ? 'action.selected' : 'action.hover'
                    }
                  }}
                >
                  {option.label}
                </Box>
              )
            })}
          </Box>
        </SettingField>

        <SettingField label="面积代表">
          <FormControl size="small" fullWidth>
            <Select
              value={value.area}
              onChange={(event) => patch({ area: event.target.value as HeatmapAreaId })}
              sx={controlSx}
              inputProps={{ 'aria-label': '面积代表' }}
            >
              {HEATMAP_AREA_OPTIONS.map((option) => (
                <MenuItem key={option.id} value={option.id} sx={menuItemSx}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </SettingField>

        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.75 }}>
            板块选择
          </Typography>
          <Stack spacing={1}>
            <SettingField label="行业分级">
              <FormControl size="small" fullWidth>
                <Select
                  value={value.industryLevel}
                  onChange={(event) =>
                    patch({
                      industryLevel: event.target.value as HeatmapIndustryLevel,
                      industryCode: ''
                    })
                  }
                  sx={controlSx}
                  inputProps={{ 'aria-label': '行业分级' }}
                >
                  {HEATMAP_INDUSTRY_LEVELS.map((option) => (
                    <MenuItem key={option.id} value={option.id} sx={menuItemSx}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </SettingField>
            <SettingField label="具体分级">
              <FormControl size="small" fullWidth>
                <Select
                  displayEmpty
                  value={value.industryCode}
                  onChange={(event) => patch({ industryCode: event.target.value })}
                  sx={controlSx}
                  inputProps={{ 'aria-label': '具体分级' }}
                  renderValue={(selected) => {
                    if (!selected) {
                      return `所有${levelName}行业`
                    }
                    return (
                      levelIndustries.find((node) => node.index_code === selected)?.name ?? selected
                    )
                  }}
                >
                  <MenuItem value="" sx={menuItemSx}>{`所有${levelName}行业`}</MenuItem>
                  {levelIndustries.map((node) => (
                    <MenuItem key={node.index_code} value={node.index_code} sx={menuItemSx}>
                      {node.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {industryError ? (
                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                  {industryError}
                </Typography>
              ) : null}
              {!industryError && industryLoaded && industries.length === 0 ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  尚无行业数据，请到配置页更新行业分类
                </Typography>
              ) : null}
            </SettingField>
          </Stack>
        </Box>
      </Stack>
    </Box>
  )
}

function SettingField({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 0.25, fontSize: 11 }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  )
}
