import { Column, Grid, Theme, Tile } from '@carbon/react'
import { Link, Route, Routes } from 'react-router-dom'
import { Cartelera } from './paginas/Cartelera.js'
import { Funcion } from './paginas/Funcion.js'

function Placeholder({ titulo, tarea }: { titulo: string; tarea: string }) {
  return (
    <Grid>
      <Column sm={4} md={8} lg={12}>
        <Tile>
          <h2>{titulo}</h2>
          <p>Esta pantalla se construye en {tarea}.</p>
          <Link to="/">Volver a la cartelera</Link>
        </Tile>
      </Column>
    </Grid>
  )
}

export default function App() {
  return (
    <Theme theme="g10">
      <main style={{ padding: '1.5rem' }}>
        <Routes>
          <Route path="/" element={<Cartelera />} />
          <Route path="/funciones/:id" element={<Funcion />} />
          <Route path="/taquilla" element={<Placeholder titulo="Taquilla" tarea="T20" />} />
          <Route path="/puerta" element={<Placeholder titulo="Puerta" tarea="T21" />} />
        </Routes>
      </main>
    </Theme>
  )
}
