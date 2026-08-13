import { ClickableTile, Column, Grid, InlineLoading, InlineNotification } from '@carbon/react'
import { useEffect, useState } from 'react'
import { esErrorDeApi, obtenerCartelera, type FuncionEnCartelera } from '../api/cliente.js'
import { ETIQUETA_MIERCOLES, formatearColones, formatearFecha } from '../utilidades/formato.js'

function textoDePrecios(funcion: FuncionEnCartelera): string {
  if (funcion.categoriaBase === 'miercoles') {
    return `${formatearColones(funcion.precios.miercoles ?? 0)} general`
  }
  return `${formatearColones(funcion.precios.general ?? 0)} general · ${formatearColones(funcion.precios.estudiante ?? 0)} estudiante`
}

/** La cartelera pública: cualquiera la ve sin identificarse (RF-8, RN-55). */
export function Cartelera() {
  const [funciones, setFunciones] = useState<FuncionEnCartelera[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    obtenerCartelera()
      .then(setFunciones)
      .catch((error: unknown) => setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos cargar la cartelera'))
  }, [])

  if (error !== null) {
    return <InlineNotification kind="error" title="No se pudo cargar" subtitle={error} hideCloseButton />
  }
  if (funciones === null) {
    return <InlineLoading description="Cargando cartelera…" />
  }
  if (funciones.length === 0) {
    return <p>No hay funciones en venta por ahora.</p>
  }

  return (
    <Grid>
      <Column sm={4} md={8} lg={12}>
        <h1>Cartelera</h1>
      </Column>
      {funciones.map((funcion) => (
        <Column sm={4} md={4} lg={4} key={funcion.funcionId}>
          <ClickableTile href={`/funciones/${funcion.funcionId}`}>
            <h3>{funcion.pelicula}</h3>
            <p>
              {funcion.sala} · {formatearFecha(funcion.fecha)} · {funcion.horaInicio}
            </p>
            {funcion.categoriaBase === 'miercoles' ? (
              <p className="etiqueta-miercoles">{ETIQUETA_MIERCOLES}</p>
            ) : null}
            <p>{textoDePrecios(funcion)}</p>
          </ClickableTile>
        </Column>
      ))}
    </Grid>
  )
}
