import { Theme } from '@carbon/react'
import { Route, Routes } from 'react-router-dom'
import { Administracion } from './paginas/Administracion.js'
import { Cartelera } from './paginas/Cartelera.js'
import { Funcion } from './paginas/Funcion.js'
import { Puerta } from './paginas/Puerta.js'
import { Taquilla } from './paginas/Taquilla.js'

/**
 * Las rutas de los tres públicos que conoce Entrada (DISENO.md): la web
 * pública del comprador (T19), taquilla (T20), y puerta y administración
 * (T21). Las tres internas exigen identificarse con un PIN (RF-32); la
 * pública no exige nada (RN-55).
 */
export default function App() {
  return (
    <Theme theme="g10">
      <main style={{ padding: '1.5rem' }}>
        <Routes>
          <Route path="/" element={<Cartelera />} />
          <Route path="/funciones/:id" element={<Funcion />} />
          <Route path="/taquilla" element={<Taquilla />} />
          <Route path="/puerta" element={<Puerta />} />
          <Route path="/administracion" element={<Administracion />} />
        </Routes>
      </main>
    </Theme>
  )
}
