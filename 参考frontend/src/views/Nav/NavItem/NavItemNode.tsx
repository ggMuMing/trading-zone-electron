import { useState, useImperativeHandle, useEffect, useCallback } from 'react'
import { Box, Tooltip } from '@mui/material'
import { ArrowIconButton, IconButton } from './NavItemComponent'
import { NAV_NODE_SQUARE_PX } from '../navRailConstants'

interface NavItemNodeRef {
  expand: (shouldExpand: boolean) => void,
}

interface ExtraButton {
  icon: React.ReactNode,
  onClick: () => void,
}

interface NavItemNodeProps {
  text: string,
  icon: React.ReactNode,
  textSx: React.CSSProperties,
  extraButtons: ExtraButton[],
  type: 'branch' | 'leaf',
  level: number,
  onClick: () => void,
  onClickExpand: (isExpanded: boolean) => void,
  isActive: boolean,
  isExpanded?: boolean,
  expandable?: boolean,
  ref: React.Ref<NavItemNodeRef>,
}

const navIconSx = {
  color: 'var(--c-sidTexCol)',
  lineHeight: 0,
  '& .MuiSvgIcon-root': {
    fontSize: 28,
  },
} as const

function NavItemNode(props: NavItemNodeProps) {
  const {
    text,
    icon,
    textSx,
    type,
    level,
    onClick,
    onClickExpand,
    isActive,
    isExpanded: isExpandedProp = false,
    extraButtons,
    expandable = false,
    ref,
  } = props
  const [isHovering, setIsHovering] = useState(false)
  const [isExpanded, setIsExpanded] = useState(isExpandedProp)

  // 同步外部传入的 isExpanded 状态
  useEffect(() => {
    setIsExpanded(isExpandedProp)
  }, [isExpandedProp])

  const expand = useCallback((shouldExpand: boolean) => {
    setIsExpanded(shouldExpand)
    if (onClickExpand && typeof onClickExpand === 'function') {
      onClickExpand(shouldExpand)
    }
  }, [onClickExpand])

  useImperativeHandle(ref, () => {
    return {
      expand(shouldExpand: boolean) {
        expand(shouldExpand)
      }
    }
  }, [expand])

  const activeColor = isActive ? 'var(--c-texPri)' : (textSx?.color === 'active' ? 'var(--c-texPri)' : 'var(--c-sidTexCol)')

  const iconBlock = type === 'branch' && expandable ? (
    <Box sx={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...navIconSx,
      color: activeColor,
    }}>
      {icon}
      <Box
        sx={{
          position: 'absolute',
          right: -4,
          bottom: -2,
          lineHeight: 0,
        }}
        onClick={(e) => {
          e.stopPropagation()
          expand(!isExpanded)
        }}
      >
        <ArrowIconButton direction={isExpanded ? 'down' : 'right'} />
      </Box>
    </Box>
  ) : (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...navIconSx,
      color: activeColor,
    }}>{icon}</Box>
  )

  return (
    <Tooltip title={text} placement="right" enterDelay={400}>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: level > 0 ? 'flex-start' : 'center',
        width: '100%',
        height: NAV_NODE_SQUARE_PX,
        minHeight: NAV_NODE_SQUARE_PX,
        maxHeight: NAV_NODE_SQUARE_PX,
        boxSizing: 'border-box',
        padding: '4px',
        borderRadius: '6px',
        overflow: type === 'branch' && expandable ? 'visible' : 'hidden',
        marginInlineStart: '0px',
        paddingLeft: level > 0 ? `${2 + level * 8}px` : undefined,
        paddingRight: '4px',
        '&:hover': {
          background: 'var(--ca-sidIteSelBac)',
          cursor: 'pointer',
        },
        background: isActive ? 'var(--ca-sidIteSelBac)' : 'transparent',
      }}
        onClick={() => {
          if (onClick && typeof onClick === 'function') {
            onClick()
          }
        }}

        onMouseEnter={() => {
          setIsHovering(true)
        }}

        onMouseLeave={() => {
          setIsHovering(false)
        }}
      >
        {iconBlock}
        {
          isHovering && extraButtons && extraButtons.map((item, index) => {
            return (
              <IconButton key={`expand-func-${index}`}
                sx={{ margin: '0 2px' }}
                onClick={(e) => {
                  e.stopPropagation()
                  item.onClick?.()
                }}
              >
                {item.icon}
              </IconButton>
            )
          })
        }
      </Box>
    </Tooltip>
  )

}

export default NavItemNode

export type { NavItemNodeRef, NavItemNodeProps, ExtraButton }
