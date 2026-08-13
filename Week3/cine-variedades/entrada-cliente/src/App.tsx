import { ClickableTile, Column, Grid, Theme, Tile } from '@carbon/react'
import { Link, Route, Routes } from 'react-router-dom'

function Inicio() {
  return (
    <Grid className="pagina-inicio">
      <Column sm={4} md={8} lg={12}>
        <h1>Cine Variedades</h1>
        <p>Base de la capa de Entrada (T18). Las pantallas reales de cada público llegan en T19–T21.</p>
      </Column>
      <Column sm={4} md={4} lg={4}>
        <ClickableTile href="/">
          <h3>Cartelera</h3>
          <p>Web pública del comprador — T19</p>
        </ClickableTile>
      </Column>
      <Column sm={4} md={4} lg={4}>
        <ClickableTile href="/taquilla">
          <h3>Taquilla</h3>
          <p>Venta presencial — T20</p>
        </ClickableTile>
      </Column>
      <Column sm={4} md={4} lg={4}>
        <ClickableTile href="/puerta">
          <h3>Puerta</h3>
          <p>Validación de entradas — T21</p>
        </ClickableTile>
      </Column>
    </Grid>
  )
}

function Placeholder({ titulo, tarea }: { titulo: string; tarea: string }) {
  return (
    <Grid>
      <Column sm={4} md={8} lg={12}>
        <Tile>
          <h2>{titulo}</h2>
          <p>Esta pantalla se construye en {tarea}.</p>
          <Link to="/">Volver al inicio</Link>
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
          <Route path="/" element={<Inicio />} />
          <Route path="/taquilla" element={<Placeholder titulo="Taquilla" tarea="T20" />} />
          <Route path="/puerta" element={<Placeholder titulo="Puerta" tarea="T21" />} />
        </Routes>
      </main>
    </Theme>
  )
}
