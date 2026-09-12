import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { DASHBOARD_BASIS_PRODUCTS } from '../../../../shared/constants/dashboard'
import type { DashboardBasisProduct } from '../../../../shared/types/dashboard'
import { BasisProductChart } from './BasisProductChart'

interface BasisGridProps {
  products: DashboardBasisProduct[]
}

export function BasisGrid({ products }: BasisGridProps): React.JSX.Element {
  const byProduct = new Map(products.map((item) => [item.product, item]))
  const items = DASHBOARD_BASIS_PRODUCTS.map((meta) => {
    const found = byProduct.get(meta.product)
    return (
      found ?? {
        product: meta.product,
        fut_code: meta.fut_code,
        spot_code: meta.spot_code,
        name: meta.name,
        series: []
      }
    )
  })

  return (
    <Box sx={{ minHeight: 1480, display: 'flex', flexDirection: 'column' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, px: 0.5, mb: 0.5, flexShrink: 0 }}>
        基差
      </Typography>
      <Box
        sx={{
          flex: 1,
          minHeight: 1440,
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        {items.map((item) => (
          <Box
            key={item.product}
            sx={{ flex: 1, minHeight: 340, display: 'flex', flexDirection: 'column' }}
          >
            <Typography variant="caption" sx={{ px: 0.5, mb: 0.25, color: 'text.secondary' }}>
              {item.product} · {item.name}
            </Typography>
            <Box sx={{ flex: 1, minHeight: 320 }}>
              <BasisProductChart series={item.series} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
