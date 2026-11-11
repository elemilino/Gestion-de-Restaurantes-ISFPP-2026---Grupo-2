import { useEffect, useEffectEvent, useState } from 'react'

import { ApiError } from '../../api/client'

interface Resultado<T> {
  clave: string
  datos: T | null
  error: string | null
}

/**
 * Pide un reporte cada vez que cambia `clave` (el resumen de sus filtros).
 * Mientras llega la respuesta de la clave actual, `cargando` es true.
 */
export function useReporte<T>(pedir: () => Promise<T>, clave: string) {
  const [resultado, setResultado] = useState<Resultado<T> | null>(null)
  const pedirReporte = useEffectEvent(pedir)

  useEffect(() => {
    let vigente = true
    pedirReporte()
      .then((datos) => vigente && setResultado({ clave, datos, error: null }))
      .catch(
        (e) =>
          vigente &&
          setResultado({
            clave,
            datos: null,
            error: e instanceof ApiError ? e.message : 'No se pudo generar el reporte',
          }),
      )
    return () => {
      vigente = false
    }
  }, [clave])

  const cargando = resultado?.clave !== clave
  return {
    datos: cargando ? null : (resultado?.datos ?? null),
    error: cargando ? null : (resultado?.error ?? null),
    cargando,
  }
}
