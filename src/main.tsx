import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initDb } from './db'
import { ensurePersistentStorage } from './utils/persist'
import './index.css'

void ensurePersistentStorage()
void initDb()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
