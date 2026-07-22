import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initMonitoring } from '@/lib/monitoring'

// Поднимаем мониторинг до рендера, чтобы поймать в том числе ранние ошибки.
// Промис не ждём: инициализация Sentry не должна задерживать первый кадр.
void initMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
