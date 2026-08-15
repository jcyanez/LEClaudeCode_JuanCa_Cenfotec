import { useCallback, useEffect, useState } from 'react'
import { esErrorDeApi, obtenerCierreDeCaja, type CierreDeCaja as Cierre } from '../../api/cliente.js'
import { formatearColones } from '../../utilidades/formato.js'
import { Aviso, Boton, CampoDeFecha } from '../base/index.js'
import './taquilla.scss'

/**
 * El cierre de caja de la jornada, en sus dos partes (RN-46, RF-26): la de
 * ventanilla —lo que hay que contar y entregar— y la de internet, solo
 * informativa, que nunca se mezcla con la anterior (CA-6). Es de solo
 * lectura: pedirlo dos veces no cambia nada, y como se calcula al vuelo, un
 * número puede moverse si se entrega una devolución después de mirarlo
 * (limitación conocida de DISENO.md).
 *
 * Se presenta como tarjetas de indicador (el patrón «KPI cards» de
 * Data-Dense Dashboard): el efectivo esperado es el único número que alguien
 * va a comparar contra lo que tiene en la mano, así que va destacado y los
 * otros dos explican cómo se llegó a él.
 */
export function CierreDeCaja() {
  const [jornada, setJornada] = useState<string>('')
  const [cierre, setCierre] = useState<Cierre | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    obtenerCierreDeCaja(jornada === '' ? undefined : jornada)
      .then((respuesta) => {
        setCierre(respuesta)
        setError(null)
      })
      .catch((error: unknown) =>
        setError(esErrorDeApi(error) ? error.mensaje : 'No pudimos calcular el cierre de caja'),
      )
  }, [jornada])

  useEffect(() => {
    cargar()
  }, [cargar])

  return (
    <div className="trabajo">
      <div className="trabajo__buscador">
        <CampoDeFecha
          id="jornada-del-cierre"
          etiqueta="Jornada"
          ayuda="Empieza a las 06:00 y termina a las 05:59 del día siguiente."
          value={jornada}
          onChange={(evento) => setJornada(evento.target.value)}
        />
        <Boton variante="secundario" onClick={cargar}>
          Actualizar
        </Boton>
      </div>

      {error !== null ? <Aviso tono="error" titulo="No se pudo calcular" detalle={error} /> : null}

      {cierre !== null ? (
        <>
          <section>
            <h2 className="trabajo__titulo">Ventanilla · jornada {cierre.jornada}</h2>
            <p className="trabajo__nota">Esto es lo que hay que contar y entregar.</p>
            <ul className="cierre__indicadores">
              <li className="indicador">
                <p className="indicador__etiqueta">Cobrado en efectivo</p>
                <p className="indicador__valor">{formatearColones(cierre.ventanilla.cobrado)}</p>
              </li>
              <li className="indicador">
                <p className="indicador__etiqueta">Devoluciones entregadas</p>
                <p className="indicador__valor">− {formatearColones(cierre.ventanilla.devuelto)}</p>
              </li>
              <li className="indicador indicador--destacado">
                <p className="indicador__etiqueta">Efectivo esperado</p>
                <p className="indicador__valor">{formatearColones(cierre.ventanilla.efectivoEsperado)}</p>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="trabajo__titulo">Internet · jornada {cierre.jornada}</h2>
            <p className="trabajo__nota">Informativo: por este canal no hay efectivo que contar.</p>
            <ul className="cierre__indicadores">
              <li className="indicador">
                <p className="indicador__etiqueta">Vendido por internet</p>
                <p className="indicador__valor">{formatearColones(cierre.internet.vendido)}</p>
              </li>
            </ul>
          </section>
        </>
      ) : null}
    </div>
  )
}
