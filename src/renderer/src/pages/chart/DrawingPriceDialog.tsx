import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Close from '@mui/icons-material/Close'
import { useEffect, useRef, useState } from 'react'
import { CHART_ICON_SX, ChartIconButton } from './ChartIconButton'

export interface DrawingPriceDialogProps {
  open: boolean
  price: number | null
  onClose: () => void
  onConfirm: (price: number) => void
}

const DIALOG_WIDTH = 320

function formatEditablePrice(price: number): string {
  return price.toFixed(2)
}

function parseEditablePrice(text: string): number | null {
  const trimmed = text.trim()
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    return null
  }
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }
  return value
}

export function DrawingPriceDialog({
  open,
  price,
  onClose,
  onConfirm
}: DrawingPriceDialogProps): React.JSX.Element {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || price === null || !Number.isFinite(price)) {
      return
    }
    setText(formatEditablePrice(price))
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [open, price])

  const parsed = parseEditablePrice(text)
  const unchanged = price !== null && text.trim() === formatEditablePrice(price)
  const showError = text.trim() !== '' && parsed === null

  const submit = (): void => {
    if (unchanged || parsed === null) {
      if (unchanged) {
        onClose()
      }
      return
    }
    onConfirm(parsed)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        paper: {
          sx: { width: DIALOG_WIDTH, maxWidth: DIALOG_WIDTH }
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', py: 1.25, pr: 1 }}>
        <Typography component="span" sx={{ flex: 1, fontWeight: 700, pr: 1 }}>
          修改价格
        </Typography>
        <ChartIconButton ariaLabel="关闭" title="关闭" roomy onClick={onClose}>
          <Close sx={CHART_ICON_SX} />
        </ChartIconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="价格"
          value={text}
          inputRef={inputRef}
          error={showError}
          helperText={showError ? '请输入大于 0 的价格' : ' '}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          slotProps={{
            htmlInput: {
              inputMode: 'decimal',
              'aria-label': '价格'
            }
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={parsed === null} onClick={submit}>
          确定
        </Button>
      </DialogActions>
    </Dialog>
  )
}
