import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import type { TabsProps } from '@mui/material/Tabs'
import { styled } from '@mui/material/styles'
import { Children, isValidElement } from 'react'

const TAB_PAD_X = 1.5

const SettingsTabsRoot = styled(Tabs)(({ theme }) => ({
  minHeight: 36,
  borderBottom: `1px solid ${theme.palette.divider}`,
  '& .MuiTabs-indicator': {
    display: 'flex',
    backgroundColor: 'transparent',
    height: 2
  },
  '& .MuiTabs-indicatorSpan': {
    flex: 1,
    backgroundColor: theme.palette.primary.main
  },
  '&[data-edge="start"] .MuiTabs-indicatorSpan': {
    marginLeft: 0,
    marginRight: theme.spacing(TAB_PAD_X)
  },
  '&[data-edge="end"] .MuiTabs-indicatorSpan': {
    marginLeft: theme.spacing(TAB_PAD_X),
    marginRight: 0
  },
  '&[data-edge="middle"] .MuiTabs-indicatorSpan': {
    marginLeft: theme.spacing(TAB_PAD_X),
    marginRight: theme.spacing(TAB_PAD_X)
  }
}))

function selectedTabEdge(value: unknown, children: TabsProps['children']): 'start' | 'middle' | 'end' {
  const values = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => (child.props as { value?: unknown }).value)
  const index = values.indexOf(value)
  if (index <= 0) {
    return 'start'
  }
  if (index >= values.length - 1) {
    return 'end'
  }
  return 'middle'
}

export function SettingsTabs(props: TabsProps): React.JSX.Element {
  return (
    <SettingsTabsRoot
      {...props}
      data-edge={selectedTabEdge(props.value, props.children)}
      slotProps={{
        ...props.slotProps,
        indicator: {
          children: <span className="MuiTabs-indicatorSpan" />
        }
      }}
    />
  )
}

export const SettingsTab = styled(Tab)(({ theme }) => ({
  textTransform: 'none',
  minHeight: 36,
  minWidth: 0,
  paddingTop: theme.spacing(0.75),
  paddingBottom: theme.spacing(0.75),
  paddingLeft: theme.spacing(TAB_PAD_X),
  paddingRight: theme.spacing(TAB_PAD_X),
  fontWeight: theme.typography.fontWeightRegular,
  color: theme.palette.text.secondary,
  '&:hover': {
    color: theme.palette.primary.main,
    opacity: 1
  },
  '&.Mui-selected': {
    color: theme.palette.primary.main,
    fontWeight: theme.typography.fontWeightMedium
  },
  '&.Mui-focusVisible': {
    backgroundColor: theme.palette.action.focus
  },
  '&:first-of-type': {
    paddingLeft: 0
  },
  '&:last-of-type': {
    paddingRight: 0
  }
}))
