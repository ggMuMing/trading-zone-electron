import { useState, Fragment, createContext, useEffect, useImperativeHandle } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Paper } from '@mui/material'
import NavItem from './NavItem'
import NavConfig from './NavConfig'
import { NAV_NODE_SQUARE_PX } from './navRailConstants'
import { getAccountList } from '../../api/api'
import type { NavItemData } from '../../../data/type'
import { setAccountNameIdMap } from './NavState'

interface NavContextType {
  navNodeExpandedStates: Record<string, boolean>,
  selectedNavItemIndex: string,
  toggleNavNodeExpanded: (index: string) => void,
  setNavNodeExpanded: (index: string, expanded: boolean) => void,
  setSelectedNavItemIndex: (index: string) => void,
}

const NavContext = createContext<NavContextType>({
  navNodeExpandedStates: {},
  selectedNavItemIndex: '',
  toggleNavNodeExpanded: () => { },
  setNavNodeExpanded: () => { },
  setSelectedNavItemIndex: () => { },
})

export { NavContext }

interface NavRef {
  refresh: () => void
}

interface NavProps {
  ref: React.Ref<NavRef>
}

function Nav(props: NavProps) {
  const { ref } = props
  const location = useLocation()
  const navigate = useNavigate()
  const [navNodeExpandedStates, setNavNodeExpandedStates] = useState<Record<string, boolean>>(() => ({}))
  const [selectedNavItemIndex, setSelectedNavItemIndexState] = useState<string>('')

  const homeData: NavItemData = NavConfig.home
  const defaultNavList: NavItemData[] = [
    NavConfig.search,
    NavConfig.orderhistory,
    NavConfig.profitlosscalculator,
  ]
  const [chartNav] = useState<NavItemData>(NavConfig.chart)
  const [stockScreeningNav] = useState<NavItemData>(NavConfig.stockScreening)
  const [backtestResultNav] = useState<NavItemData>(NavConfig.backtestResult)
  const [paperTradingNav] = useState<NavItemData>(NavConfig.paperTrading)
  const [positionCalculatorNav] = useState<NavItemData>(NavConfig.positionCalculator)
  const [testNav] = useState<NavItemData>(NavConfig.test)
  const [editorNav] = useState<NavItemData>(NavConfig.editor)
  const [dataNav] = useState<NavItemData>(NavConfig.data)

  const indexNavNodeMap = new Map<string, NavItemData>()
  indexNavNodeMap.set(homeData.index, homeData)
  defaultNavList.forEach(item => {
    indexNavNodeMap.set(item.index, item)
  })
  indexNavNodeMap.set(chartNav.index, chartNav)
  indexNavNodeMap.set(stockScreeningNav.index, stockScreeningNav)
  indexNavNodeMap.set(backtestResultNav.index, backtestResultNav)
  indexNavNodeMap.set(paperTradingNav.index, paperTradingNav)
  indexNavNodeMap.set(positionCalculatorNav.index, positionCalculatorNav)
  indexNavNodeMap.set(testNav.index, testNav)
  indexNavNodeMap.set(editorNav.index, editorNav)
  indexNavNodeMap.set(NavConfig.account.index, NavConfig.account)
  indexNavNodeMap.set(dataNav.index, dataNav)
  const toggleNavNodeExpanded = (index: string) => {
    setNavNodeExpandedStates(prev => ({
      ...prev,
      [index]: !prev[index],
    }))
  }

  const setNavNodeExpanded = (index: string, expanded: boolean) => {
    setNavNodeExpandedStates(prev => ({
      ...prev,
      [index]: expanded,
    }))
  }

  const setSelectedNavItemIndex = (index: string) => {
    setSelectedNavItemIndexState(index)
  }

  const contextValue: NavContextType = {
    navNodeExpandedStates,
    selectedNavItemIndex,
    toggleNavNodeExpanded,
    setNavNodeExpanded,
    setSelectedNavItemIndex
  }

  const renderNode = (nodeData: NavItemData): React.ReactNode => {
    if (nodeData.type === 'branch') {
      return renderBranch(nodeData)
    } else {
      return renderLeaf(nodeData)
    }
  }

  const renderBranch = (branchData: NavItemData) => {
    const {
      text,
      index,
      icon,
      children,
      textSx,
      extraButtons,
      level,
      route
    } = branchData
    return (
      <>
        <NavItem
          type="branch"
          text={text}
          icon={icon}
          textSx={textSx}
          extraButtons={extraButtons}
          level={level}
          index={index}
          route={route}
          expandable={(children?.length ?? 0) > 0}
        />
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 0,
          flexShrink: 0,
          gap: '1px',
          width: '100%'
        }}>
          {
            navNodeExpandedStates[index] && children && children.length > 0 &&
            children.map((child) => (
              <Fragment key={child.index}>
                {renderNode(child)}
              </Fragment>
            ))
          }
        </Box>
      </>
    )
  }

  const renderLeaf = (leafData: NavItemData) => {
    const { text, index, icon, textSx, extraButtons, level, route } = leafData
    return (
      <NavItem
        key={index}
        type="leaf"
        text={text}
        icon={icon}
        textSx={textSx}
        extraButtons={extraButtons}
        level={level}
        index={index}
        route={route}
      />
    )
  }

  function syncNavSelectionFromPathname() {
    const urlArray = location.pathname.split('/').slice(1)
    // 解码 URL 中的中文编码
    const decodedUrlArray = urlArray.map(segment => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    let currentIndex = decodedUrlArray.length > 2
      ? `${decodedUrlArray[decodedUrlArray.length - 2]}-${decodedUrlArray[decodedUrlArray.length - 1]}`
      : decodedUrlArray[decodedUrlArray.length - 1]
    if (decodedUrlArray.length >= 2 && decodedUrlArray[0] === 'data' && decodedUrlArray[1] === 'parquet') {
      currentIndex = 'data'
    }

    // 检查 currentIndex 是否在 indexNavNodeMap 中存在
    let currentNode = indexNavNodeMap.get(currentIndex)

    // 如果匹配不上，尝试找到有效的 parentIndex 并导航
    if (!currentNode) {
      // 尝试从 URL 中提取可能的 parentIndex（对于 account/:accountIndex/xxx 格式）
      let fallbackIndex: string | null = null
      if (decodedUrlArray.length >= 2 && decodedUrlArray[0] === 'account') {
        // 尝试匹配 accountIndex
        const accountName = decodedUrlArray[1]
        if (accountName) {
          fallbackIndex = accountName
        }
      }

      // 如果找到了有效的 fallbackIndex，导航到它
      if (fallbackIndex) {
        const fallbackNode = indexNavNodeMap.get(fallbackIndex)
        if (fallbackNode?.route) {
          navigate(fallbackNode.route)
          currentNode = fallbackNode
        }
      } else {
        // 如果 parentIndex 为 null 或找不到，跳转回 home
        navigate(homeData.route || '/home')
        currentNode = homeData
      }
    }

    // 展开所有父节点
    if (currentNode) {
      let parentIndex = currentNode.parentIndex
      while (parentIndex) {
        setNavNodeExpanded(parentIndex, true)
        parentIndex = indexNavNodeMap.get(parentIndex)?.parentIndex || null
      }
      setSelectedNavItemIndex(currentNode.index)
    }
  }

  function initializeNav() {
    getAccountList().then((accounts) => {
      accounts.forEach((account) => {
        setAccountNameIdMap(account.name, account.id)
      })
      syncNavSelectionFromPathname()
    })
  }

  useImperativeHandle(ref, () => {
    return {
      refresh() {
        initializeNav()
      }
    }
  }, [])

  useEffect(() => {
    initializeNav()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    syncNavSelectionFromPathname()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <NavContext.Provider value={contextValue}>
      <Paper elevation={1} sx={{
        height: '100%',
        width: 'fit-content',
        borderRadius: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--c-bacSec)',
      }}>
        <Box>
          <Box sx={{
            width: NAV_NODE_SQUARE_PX,
            height: NAV_NODE_SQUARE_PX,
            userSelect: 'none',
            transition: 'background 20ms ease-in',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginInline: '4px',
            marginTop: '4px',
            borderRadius: '6px',
            marginBottom: '4px',
            padding: '0px',
            color: 'var(--c-texPri)',
          }}>
            {renderNode(homeData)}
          </Box>
        </Box>
        <Box>
          <Box sx={{
            width: NAV_NODE_SQUARE_PX,
            height: NAV_NODE_SQUARE_PX,
            userSelect: 'none',
            transition: 'background 20ms ease-in',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginInline: '4px',
            marginTop: '4px',
            borderRadius: '6px',
            marginBottom: '4px',
            padding: '0px',
            color: 'var(--c-texPri)',
          }}>
            {renderNode(chartNav)}
          </Box>
        </Box>
        <Box>
          <Box sx={{
            width: NAV_NODE_SQUARE_PX,
            height: NAV_NODE_SQUARE_PX,
            userSelect: 'none',
            transition: 'background 20ms ease-in',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginInline: '4px',
            marginTop: '4px',
            borderRadius: '6px',
            marginBottom: '4px',
            padding: '0px',
            color: 'var(--c-texPri)',
          }}>
            {renderNode(stockScreeningNav)}
          </Box>
        </Box>
        <Box>
          <Box sx={{
            width: NAV_NODE_SQUARE_PX,
            height: NAV_NODE_SQUARE_PX,
            userSelect: 'none',
            transition: 'background 20ms ease-in',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginInline: '4px',
            marginTop: '4px',
            borderRadius: '6px',
            marginBottom: '4px',
            padding: '0px',
            color: 'var(--c-texPri)',
          }}>
            {renderNode(backtestResultNav)}
          </Box>
        </Box>
        <Box>
          <Box sx={{
            width: NAV_NODE_SQUARE_PX,
            height: NAV_NODE_SQUARE_PX,
            userSelect: 'none',
            transition: 'background 20ms ease-in',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginInline: '4px',
            marginTop: '4px',
            borderRadius: '6px',
            marginBottom: '4px',
            padding: '0px',
            color: 'var(--c-texPri)',
          }}>
            {renderNode(paperTradingNav)}
          </Box>
        </Box>
        <Box>
          <Box sx={{
            width: NAV_NODE_SQUARE_PX,
            height: NAV_NODE_SQUARE_PX,
            userSelect: 'none',
            transition: 'background 20ms ease-in',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginInline: '4px',
            marginTop: '4px',
            borderRadius: '6px',
            marginBottom: '4px',
            padding: '0px',
            color: 'var(--c-texPri)',
          }}>
            {renderNode(positionCalculatorNav)}
          </Box>
        </Box>
        <Box>
          <Box sx={{
            width: NAV_NODE_SQUARE_PX,
            height: NAV_NODE_SQUARE_PX,
            userSelect: 'none',
            transition: 'background 20ms ease-in',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginInline: '4px',
            marginTop: '4px',
            borderRadius: '6px',
            marginBottom: '4px',
            padding: '0px',
            color: 'var(--c-texPri)',
          }}>
            {renderNode(editorNav)}
          </Box>
        </Box>

        <Box>
          <Box sx={{
            width: NAV_NODE_SQUARE_PX,
            height: NAV_NODE_SQUARE_PX,
            userSelect: 'none',
            transition: 'background 20ms ease-in',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginInline: '4px',
            marginTop: '4px',
            borderRadius: '6px',
            marginBottom: '4px',
            padding: '0px',
            color: 'var(--c-texPri)',
          }}>
            {renderNode(dataNav)}
          </Box>
        </Box>
      </Paper>
    </NavContext.Provider>
  )
}

export default Nav
export type { NavRef }