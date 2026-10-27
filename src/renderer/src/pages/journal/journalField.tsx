import TextField, { type TextFieldProps } from '@mui/material/TextField'
import { forwardRef } from 'react'
import { paperFieldSx } from '../paper/paperFieldSx'

/** 与模拟盘表单同一套高度和字号，去掉纸面方案里为复选框留的左右边距。 */
const compactFieldSx = [
  paperFieldSx,
  {
    mx: 0,
    width: '100%',
    '& .MuiAutocomplete-inputRoot': {
      minHeight: 32,
      paddingTop: '0 !important',
      paddingBottom: '0 !important'
    }
  }
] as const

const multilineFieldSx = [
  paperFieldSx,
  {
    mx: 0,
    width: '100%',
    '& .MuiOutlinedInput-root': { minHeight: 0 },
    '& .MuiOutlinedInput-input': { height: 'auto', padding: '6px 12px' }
  }
] as const

export const journalChoiceSx = {
  m: 0,
  height: 32,
  flexShrink: 0,
  '& .MuiFormControlLabel-label': { fontSize: 14 }
} as const

export const JournalTextField = forwardRef<HTMLDivElement, TextFieldProps>(function JournalTextField(
  { sx, multiline, ...rest },
  ref
) {
  return (
    <TextField
      {...rest}
      ref={ref}
      size="small"
      multiline={multiline}
      sx={[multiline ? multilineFieldSx : compactFieldSx, ...(Array.isArray(sx) ? sx : [sx ?? false])]}
    />
  )
})
