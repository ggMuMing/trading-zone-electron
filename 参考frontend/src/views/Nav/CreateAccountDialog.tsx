import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import styled from '@emotion/styled'
import { createAccount } from '../../api/api'

const StyledTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    color: 'var(--c-texPri)',
    backgroundColor: 'var(--ca-inpBac)',
    borderRadius: '8px',
    '& fieldset': {
      borderColor: 'var(--c-borPri)',
    },
    '&:hover fieldset': {
      borderColor: '#f0efed',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#f0efed',
      borderWidth: '2px',
    },
  },
  '& .MuiInputLabel-root': {
    color: 'var(--c-texSec)',
    '&.Mui-focused': {
      color: '#f0efed',
    },
  },
})
function CreateAccountDialog({ isOpen, onClose }: { isOpen: boolean, onClose: (isSuccess: boolean) => void }) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget as HTMLFormElement)
    const name = formData.get('name') as string
    const amount = formData.get('amount') as unknown as number
    const description = formData.get('description') as string
    createAccount({ name, amount, description })
      .then((res) => {
        console.log(res)
        onClose(true)
      })
      .catch((err) => {
        console.error(err)
        onClose(false)
      })
  }

  return (
    <Dialog
      open={isOpen}
      onClose={() => onClose(false)}
      sx={{
        '& .MuiDialog-paper': {
          background: '#202020',
          color: '#9b9b9b'
          // color: '#f0efed'
        }
      }}
    >
      <DialogTitle
        sx={{
          color: '#f0efed',
          fontSize: '20px',
          fontWeight: 600,
          padding: '24px 24px 16px 24px',
          borderBottom: '1px solid var(--c-borSec)',
        }}
      >
        创建账户
      </DialogTitle>
      <DialogContent sx={{ padding: '24px' }}>
        <DialogContentText
          sx={{
            color: 'var(--c-texSec)',
            marginBottom: '24px',
            fontSize: '14px',
          }}
        >
          请输入账户名称、金额和描述信息
        </DialogContentText>
        <form onSubmit={handleSubmit} id="create-account-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <StyledTextField
            label="账户名称"
            name="name"
            required
            fullWidth
          />
          <StyledTextField
            label="金额"
            name="amount"
            required
            fullWidth
            type="number"
          />
          <StyledTextField
            label="描述"
            name="description"
            required
            fullWidth
            multiline
            rows={3}
          />
        </form>
      </DialogContent>
      <DialogActions sx={{ padding: '16px 24px 24px 24px', gap: '12px', borderTop: '1px solid var(--c-borSec)' }}>
        <Button
          onClick={() => onClose(false)}
          sx={{
            color: 'var(--c-texSec)',
            backgroundColor: 'transparent',
            border: '1px solid var(--c-borPri)',
            borderRadius: '8px',
            padding: '8px 20px',
            textTransform: 'none',
            fontSize: '14px',
            fontWeight: 500,
            '&:hover': {
              backgroundColor: 'rgba(255,255,243,.082)',
              borderColor: 'var(--c-borStr)',
              color: 'var(--c-texPri)',
            },
          }}
        >
          取消
        </Button>
        <Button
          type="submit"
          form="create-account-form"
          sx={{
            color: 'var(--c-texSec)',
            backgroundColor: 'transparent',
            border: '1px solid var(--c-borPri)',
            borderRadius: '8px',
            padding: '8px 20px',
            textTransform: 'none',
            fontSize: '14px',
            fontWeight: 500,
            '&:hover': {
              backgroundColor: 'rgba(255,255,243,.082)',
              borderColor: 'var(--c-borStr)',
              color: 'var(--c-texPri)',
            },
          }}
        >
          创建
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CreateAccountDialog