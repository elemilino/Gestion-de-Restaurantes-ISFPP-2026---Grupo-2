import type { FiltroPeriodo } from './types'

/** "2026-11-04" → "04/11/2026". */
export function fechaLarga(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${anio}`
}

/** "2026-11-04" → "04/11". */
export function fechaCorta(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}`
}

/** Resume los filtros de un reporte, para volver a pedirlo solo si cambian. */
export function claveFiltro(filtro: FiltroPeriodo, extra: object = {}): string {
  return JSON.stringify({ ...filtro, ...extra })
}

/** Serie única: color de acción de la marca (ámbar 600). */
export const COLOR_SERIE = '#d97706'

/**
 * Paleta categórica en orden fijo (validada para daltonismo en pares contiguos).
 * Algunos tonos tienen poco contraste con el fondo: por eso cada gráfico que la
 * usa lleva leyenda con valores y tabla.
 */
export const CATEGORICOS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300']
