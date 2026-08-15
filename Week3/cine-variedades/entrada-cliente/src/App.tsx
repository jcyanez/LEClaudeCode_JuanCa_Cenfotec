import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Administracion } from './paginas/Administracion.js'
import { Cartelera } from './paginas/Cartelera.js'
import { Funcion } from './paginas/Funcion.js'
import { Puerta } from './paginas/Puerta.js'
import { Taquilla } from './paginas/Taquilla.js'

/** Las dos rutas que ve quien compra por internet, sin identificarse (RN-55). */
function esRutaPublica(ruta: string): boolean {
  return ruta === '/' || ruta.startsWith('/funciones')
}

/**
 * Las rutas de los tres públicos que conoce Entrada (DISENO.md): la web
 * pública del comprador (T19), taquilla (T20), y puerta y administración
 * (T21). Las tres internas exigen identificarse con un PIN (RF-32); la
 * pública no exige nada (RN-55).
 *
 * El tema se elige por sección, no por gusto: la web pública usa el oscuro
 * cinematográfico que la skill `ui-ux-pro-max` recomienda para Theater/Cinema,
 * y las pantallas de trabajo el claro funcional que esa misma skill recomienda
 * para herramientas de productividad. Quien cobra efectivo necesita leer
 * rápido, no ambiente.
 */
export default function App() {
  const { pathname } = useLocation()
  const tema = esRutaPublica(pathname) ? 'tema-cine' : 'tema-operacion'

  // El tema vive en el `body` para que el fondo cubra la pantalla entera,
  // incluido el rebote al desplazarse, y no solo la caja del contenido.
  useEffect(() => {
    document.body.classList.add(tema)
    return () => document.body.classList.remove(tema)
  }, [tema])

  return (
    <main className="lienzo">
      <Routes>
        <Route path="/" element={<Cartelera />} />
        <Route path="/funciones/:id" element={<Funcion />} />
        <Route path="/taquilla" element={<Taquilla />} />
        <Route path="/puerta" element={<Puerta />} />
        <Route path="/administracion" element={<Administracion />} />
      </Routes>
    </main>
  )
}
