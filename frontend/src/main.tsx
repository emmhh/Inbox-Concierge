import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import DemoGate from './components/DemoGate'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoGate>
      <App />
    </DemoGate>
  </StrictMode>,
)
