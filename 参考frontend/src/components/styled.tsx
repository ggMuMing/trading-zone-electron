import styled from "@emotion/styled";
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';

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

const StyledButton = styled(Button)({
  color: 'var(--c-texPri)',
  border: 'none',
  boxShadow: 'none',
  '&.MuiButton-outlined': {
    border: 'none',
  },
  '&:hover': {
    boxShadow: 'none',
    border: 'none',
    backgroundColor: 'var(--ca-sidIteSelBac)',
  },
})

const StyledDialog = styled(Dialog)(() => ({
  '& .MuiDialogContent-root': {
    padding: '24px',
  },
  '& .MuiDialogActions-root': {
    padding: '16px',
  },
}));

const SeperatorBox = styled(Box)({
  width: '1px',
  height: 28,
  backgroundColor: 'var(--c-borPri)',
  alignSelf: 'center',
  flexShrink: 0,
})

export { StyledTextField, StyledButton, StyledDialog, SeperatorBox }