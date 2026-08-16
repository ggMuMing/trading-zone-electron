import type { NavItemData } from '../../../data/type'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import FactCheckIcon from '@mui/icons-material/FactCheck';
import SearchIcon from '@mui/icons-material/Search';
import DialpadIcon from '@mui/icons-material/Dialpad';
import WalletOutlinedIcon from '@mui/icons-material/WalletOutlined';
import AddIcon from '@mui/icons-material/Add';
import MoreHorizOutlinedIcon from '@mui/icons-material/MoreHorizOutlined';
import FunctionsIcon from '@mui/icons-material/Functions';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import CodeIcon from '@mui/icons-material/Code';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import SportsEsportsOutlinedIcon from '@mui/icons-material/SportsEsportsOutlined';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import { setIsCreateAccountDialogOpen } from './NavState'

const NavConfig: Record<string, NavItemData> = {
  home: {
    index: 'home',
    type: 'leaf',
    text: 'Home',
    icon: <AccountBalanceIcon fontSize="small" />,
    textSx: { fontWeight: 'bold', color: 'inactive' },
    extraButtons: [],
    level: 0,
    children: [],
    route: '/home',
    parentIndex: null,
  },
  search: {
    index: 'search',
    type: 'leaf',
    text: 'Search',
    icon: <SearchIcon fontSize="small" />,
    textSx: { fontWeight: 'medium', color: 'inactive' },
    extraButtons: [],
    level: 0,
    children: [],
    route: '/search',
    parentIndex: null,
  },
  orderhistory: {
    index: 'orderhistory',
    type: 'leaf',
    text: 'Order History',
    icon: <FactCheckIcon fontSize="small" />,
    textSx: { fontWeight: 'medium', color: 'inactive' },
    extraButtons: [],
    level: 0,
    children: [],
    route: '/orderhistory',
    parentIndex: null,
  },
  chart: {
    index: 'chart',
    type: 'leaf',
    text: 'Chart',
    icon: <ShowChartIcon fontSize="small" />,
    textSx: { fontWeight: 'medium', color: 'inactive' },
    extraButtons: [],
    level: 0,
    children: [],
    route: '/chart',
    parentIndex: null,
  },
  stockScreening: {
    index: 'stock-screening',
    type: 'leaf',
    text: '选股',
    icon: <ManageSearchIcon fontSize="small" />,
    textSx: { fontWeight: 'medium', color: 'inactive' },
    extraButtons: [],
    level: 0,
    children: [],
    route: '/stock-screening',
    parentIndex: null,
  },
  backtestResult: {
    index: 'backtest-result',
    type: 'leaf',
    text: '回测结果',
    icon: <AnalyticsOutlinedIcon fontSize="small" />,
    textSx: { fontWeight: 'medium', color: 'inactive' },
    extraButtons: [],
    level: 0,
    children: [],
    route: '/backtest-result',
    parentIndex: null,
  },
  paperTrading: {
    index: 'paper-trading',
    type: 'leaf',
    text: '模拟盘',
    icon: <SportsEsportsOutlinedIcon fontSize="small" />,
    textSx: { fontWeight: 'medium', color: 'inactive' },
    extraButtons: [],
    level: 0,
    children: [],
    route: '/paper-trading',
    parentIndex: null,
  },
  positionCalculator: {
    index: 'position-calculator',
    type: 'leaf',
    text: '仓位计算器',
    icon: <CalculateOutlinedIcon fontSize="small" />,
    textSx: { fontWeight: 'medium', color: 'inactive' },
    extraButtons: [],
    level: 0,
    children: [],
    route: '/position-calculator',
    parentIndex: null,
  },
  test: {
    index: 'test',
    type: 'leaf',
    text: 'Test',
    icon: <BugReportOutlinedIcon fontSize="small" />,
    textSx: { fontWeight: 'medium', color: 'inactive' },
    extraButtons: [],
    level: 0,
    children: [],
    route: '/test',
    parentIndex: null,
  },
  editor: {
    index: 'editor',
    type: 'leaf',
    text: 'Editor',
    icon: <CodeIcon fontSize="small" />,
    textSx: { fontWeight: 'medium', color: 'inactive' },
    extraButtons: [],
    level: 0,
    children: [],
    route: '/editor',
    parentIndex: null,
  },
  profitlosscalculator: {
    index: 'profitlosscalculator',
    type: 'leaf',
    text: 'Profit Loss Calculator',
    icon: <DialpadIcon fontSize="small" />,
    textSx: { fontWeight: 'medium', color: 'inactive' },
    extraButtons: [],
    level: 0,
    children: [],
    route: '/profitlosscalculator',
    parentIndex: null,
  },
  account: {
    index: 'account',
    type: 'leaf',
    text: 'Account',
    icon: <WalletOutlinedIcon fontSize="small" />,
    textSx: { fontWeight: 'bold', color: 'inactive' },
    extraButtons: [
      {
        icon: <MoreHorizOutlinedIcon fontSize="small" />,
        onClick: () => {
          console.log('more')
        }
      },
      {
        icon: <AddIcon fontSize="small" />,
        onClick: () => {
          console.log('add')
          setIsCreateAccountDialogOpen(true)
        }
      },
    ],
    level: 0,
    children: [],
    route: '/account',
    parentIndex: null,
  },
  strategy: {
    index: 'strategy',
    type: 'leaf',
    text: 'Strategy',
    icon: <FunctionsIcon fontSize="small" />,
    textSx: { fontWeight: 'bold', color: 'inactive' },
    extraButtons: [],
    children: [],
    level: 0,
    route: '/strategy',
    parentIndex: null,
  },
  data: {
    index: 'data',
    type: 'leaf',
    text: 'Data',
    icon: <StorageOutlinedIcon fontSize="small" />,
    textSx: { fontWeight: 'bold', color: 'inactive' },
    extraButtons: [],
    children: [],
    level: 0,
    route: '/data/parquet',
    parentIndex: null,
  }
}

export default NavConfig