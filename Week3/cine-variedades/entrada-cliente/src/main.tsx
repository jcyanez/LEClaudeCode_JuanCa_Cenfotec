import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.js'
import './estilos/global.scss'

const raiz = document.getElementById('raiz')
if (raiz === null) throw new Error('Falta el elemento #raiz en index.html')

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
