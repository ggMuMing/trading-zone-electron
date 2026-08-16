import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material'
import CssBaseline from '@mui/material/CssBaseline'
import './App.css'
import './styles/darkTheme.css'
import Zone from './views/Zone'
import OpenRecordView from './views/Account/OpenRecord'

import AccountView from './views/Account'
import StrategyView from './views/Strategy'
import ParquetView from './views/Data/Parquet'
import ChartView from './views/Chart'
import EditorView from './views/Editor'
import StockScreeningView from './views/StockScreening'
import BacktestResultView from './views/BacktestResult'
import PaperTradingView from './views/PaperTrading'
import PositionCalculatorView from './views/PositionCalculator'

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
  typography: {
    fontFamily: 'var(--lwc-font-stack)',
  }
})

const router = createBrowserRouter([
  {
    path: '/',
    element: <Zone />,
    children: [
      {
        index: true,
        element: <div>Home</div>
      },
      {
        path: 'home',
        element: <div>Home</div>
      },
      {
        path: 'search',
        element: <div>Search</div>
      },
      {
        path: 'orderhistory',
        element: <div>Order History</div>
      },
      {
        path: 'profitlosscalculator',
        element: <div>Profit Loss Calculator</div>
      },
      {
        path: 'account',
        element: <AccountView />
      },
      {
        path: 'account/:accountIndex',
        element: <div>Account index</div>
      },
      {
        path: 'account/:accountIndex/info',
        element: <div>Account Info</div>
      },
      {
        path: 'account/:accountIndex/trade-plan',
        element: <OpenRecordView />
      },
      {
        path: 'account/:accountIndex/delivery-slip',
        element: <div>Account Delivery Slip</div>
      },
      {
        path: 'strategy',
        element: <StrategyView />
      },
      {
        path: 'chart',
        element: <ChartView />
      },
      {
        path: 'stock-screening',
        element: <StockScreeningView />
      },
      {
        path: 'backtest-result',
        element: <BacktestResultView />
      },
      {
        path: 'paper-trading',
        element: <PaperTradingView />
      },
      {
        path: 'position-calculator',
        element: <PositionCalculatorView />
      },
      {
        path: 'editor',
        element: <EditorView />
      },
      {
        path: 'data',
        element: <Navigate to="/data/parquet" replace />
      },
      {
        path: 'data/parquet',
        element: <ParquetView />
      }
    ]
  },
  {
    path: '*',
    element: <div>404</div>
  }
])

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}

export default App