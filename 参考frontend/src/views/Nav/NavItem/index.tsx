import { useRef, useEffect, useContext } from 'react'
import NavItemNode, { type NavItemNodeRef, type NavItemNodeProps, type ExtraButton } from './NavItemNode'
import { NavContext } from '../index'
import { useNavigate } from 'react-router-dom'

interface NavItemProps {
  type: 'branch' | 'leaf',
  text: string,
  icon: React.ReactNode,
  textSx: React.CSSProperties,
  extraButtons: ExtraButton[],
  level: number,
  index: string,
  route: string,
  expandable?: boolean,
}

function NavItem(props: NavItemProps) {
  const { type, text, icon, textSx, level, index, extraButtons, route, expandable = false } = props
  const { navNodeExpandedStates, setNavNodeExpanded, selectedNavItemIndex, setSelectedNavItemIndex } = useContext(NavContext)
  const navigate = useNavigate()
  const isExpanded = navNodeExpandedStates[index] || false
  const isActive = selectedNavItemIndex === index
  const handleClickExpand = (expanded: boolean) => {
    setNavNodeExpanded(index, expanded)
  }

  const navItemNodeProps: NavItemNodeProps = {
    type,
    text,
    icon,
    textSx,
    extraButtons,
    expandable,
    level,
    onClick: () => {
      setSelectedNavItemIndex(index)
      navigate(route)
    },
    onClickExpand: handleClickExpand,
    isActive,
    isExpanded,
    ref: null,
  }
  const ref = useRef<NavItemNodeRef>(null)

  useEffect(() => {
    if (ref.current && isExpanded) {
      ref.current.expand(isExpanded)
    }
  }, [isExpanded])

  return (
    <NavItemNode {...navItemNodeProps} ref={ref} />
  )
}

export default NavItem

export type { NavItemProps }