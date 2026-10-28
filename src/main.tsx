import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RecoveryScreen } from './components/RecoveryScreen'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RecoveryScreen>
      <App />
    </RecoveryScreen>
  </StrictMode>,
)
