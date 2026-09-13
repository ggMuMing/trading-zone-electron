import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import type { SwIndustryBreadcrumb } from '../../../../shared/types/swIndustry'

interface IndustryBreadcrumbProps {
  tsCode: string | null
  onNavigate: (indexCode: string) => void
}

export function IndustryBreadcrumb({
  tsCode,
  onNavigate
}: IndustryBreadcrumbProps): React.JSX.Element | null {
  const [crumb, setCrumb] = useState<SwIndustryBreadcrumb | null>(null)

  useEffect(() => {
    if (!tsCode) {
      setCrumb(null)
      return
    }
    let cancelled = false
    void window.api.industry
      .breadcrumb({ ts_code: tsCode })
      .then((result) => {
        if (!cancelled) {
          setCrumb(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCrumb(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [tsCode])

  if (!crumb) {
    return null
  }

  const levels = [crumb.l1, crumb.l2, crumb.l3]

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        maxWidth: 360,
        justifyContent: 'flex-end'
      }}
    >
      {levels.map((level, index) => (
        <Box key={level.index_code} sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          {index > 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ px: 0.25 }}>
              /
            </Typography>
          ) : null}
          <Button
            size="small"
            onClick={() => onNavigate(level.index_code)}
            sx={{ minWidth: 0, px: 0.5, textTransform: 'none' }}
          >
            <Typography variant="caption" noWrap>
              {level.name}
            </Typography>
          </Button>
        </Box>
      ))}
    </Box>
  )
}
