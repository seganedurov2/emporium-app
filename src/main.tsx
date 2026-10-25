import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {
  initTelegramApp,
  isTelegramMiniApp,
  sendLogsToBot,
  startErrorCapture
} from './telegram'

initTelegramApp()
startErrorCapture()

if (isTelegramMiniApp()) {
  const button = document.createElement('button')
  button.textContent = 'Logs'
  Object.assign(button.style, {
    position: 'fixed',
    right: '12px',
    bottom: '12px',
    zIndex: '2147483647',
    padding: '8px 12px',
    border: '1px solid #334155',
    borderRadius: '8px',
    background: '#0f172a',
    color: '#94a3b8',
    fontSize: '12px',
    fontFamily: 'monospace',
    cursor: 'pointer',
    opacity: '0.75'
  })
  button.addEventListener('click', () => {
    const sent = sendLogsToBot()
    button.textContent = sent ? 'Sent' : 'N/A'
    window.setTimeout(() => {
      button.textContent = 'Logs'
    }, 2000)
  })
  document.body.appendChild(button)
  window.sendEmporiumLogs = sendLogsToBot
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
