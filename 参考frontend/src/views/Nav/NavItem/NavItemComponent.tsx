import { styled, Box } from '@mui/material'
import KeyboardArrowRightOutlinedIcon from '@mui/icons-material/KeyboardArrowRightOutlined';
import KeyboardArrowDownOutlinedIcon from '@mui/icons-material/KeyboardArrowDownOutlined';

const IconButton = styled(Box)(() => {
  return {
    color: 'var(--c-sidTexCol)',
    alignItems: 'center',
    height: '20px',
    lineHeight: '20px',
    borderRadius: '4px',

    '&:hover': {
      background: 'rgba(255, 255, 255, 0.05)',
    },
  }
})

const ArrowIconButton = (props: { direction: 'right' | 'down' }) => {
  const { direction = 'right' } = props

  return (
    <IconButton>
      {direction === 'right' ? (
        <KeyboardArrowRightOutlinedIcon sx={{ fontSize: 18 }} />
      ) : (
        <KeyboardArrowDownOutlinedIcon sx={{ fontSize: 18 }} />
      )}
    </IconButton>
  )
}


const NavListItemText = styled('div')(({ textSx }: { textSx: React.CSSProperties }) => {
  const fontWeight = textSx?.fontWeight || 'normal'
  const fontSize = textSx?.fontSize || '14px'
  const color = textSx?.color || 'inactive'

  return {
    ...textSx,
    fontWeight: fontWeight === 'normal' ? 400 : fontWeight === 'medium' ? 500 : fontWeight === 'bold' ? 600 : (typeof fontWeight === 'number' ? fontWeight : 400),
    fontSize: fontSize,
    color: color === 'active' ? 'var(--c-texPri)' : 'var(--c-sidTexCol)',
    flex: '1 1 auto',
    whiteSpace: 'nowrap',
    minWidth: '0px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: 'left',
  }
})

export { ArrowIconButton, NavListItemText, IconButton }