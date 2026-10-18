import type { Theme } from '@mui/material/styles'
import type { SystemStyleObject } from '@mui/system'

/** 小号复选框内边距，输入框左框与方块左缘对齐，右侧留出同样间距。 */
export const PAPER_FIELD_INSET = '9px'

export const paperFieldSx: SystemStyleObject<Theme> = {
  mx: PAPER_FIELD_INSET,
  width: `calc(100% - ${PAPER_FIELD_INSET} - ${PAPER_FIELD_INSET})`,
  '& .MuiOutlinedInput-root': {
    minHeight: 32
  },
  '& .MuiOutlinedInput-input': {
    boxSizing: 'border-box',
    height: 32,
    padding: '4px 12px',
    fontSize: 14,
    lineHeight: '22px'
  },
  '& .MuiInputLabel-outlined:not(.MuiInputLabel-shrink)': {
    transform: 'translate(12px, 5px) scale(1)',
    fontSize: 14
  }
}
