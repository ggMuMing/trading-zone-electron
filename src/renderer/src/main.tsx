import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ColorModeProvider } from './theme/colorMode'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColorModeProvider>
      <App />
    </ColorModeProvider>
  </StrictMode>
)
