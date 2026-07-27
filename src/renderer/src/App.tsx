import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState } from 'react'

function App(): React.JSX.Element {
  const [pinged, setPinged] = useState(false)
  const versions = window.electron.process.versions

  const handlePing = (): void => {
    window.api.ping()
    setPinged(true)
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Stack spacing={2}>
        <Typography variant="h4" component="h1" fontWeight={700}>
          Trading Zone
        </Typography>
        <Typography color="text.secondary">
          Electron + React + MUI 脚手架已就绪。后续迭代将接入 SQLite 与 Python worker。
        </Typography>
        <Box>
          <Button variant="contained" onClick={handlePing}>
            测试 IPC Ping
          </Button>
        </Box>
        {pinged ? (
          <Typography variant="body2" color="success.main">
            已发送 ping（主进程控制台应打印 pong）
          </Typography>
        ) : null}
        <Typography variant="caption" color="text.secondary">
          Electron {versions.electron} · Chromium {versions.chrome} · Node {versions.node}
        </Typography>
      </Stack>
    </Container>
  )
}

export default App
