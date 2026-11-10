import type { Tono } from '../../components/tonos'
import type { Comanda, EstadoComanda } from './types'

/** Etiqueta y tono de cada estado de la comanda (diagrama de clases). */
export const ESTADOS_COMANDA: Record<EstadoComanda, { etiqueta: string; tono: Tono }> = {
  ABIERTA: { etiqueta: 'Abierta', tono: 'ocupado' },
  CERRADA: { etiqueta: 'Cerrada', tono: 'pendiente' },
  FACTURADA: { etiqueta: 'Facturada', tono: 'libre' },
  ANULADA: { etiqueta: 'Anulada', tono: 'inactivo' },
}

/** Suma de cantidad × precio unitario de los productos cargados. */
export function totalComanda(comanda: Comanda): number {
  return comanda.detalles.reduce((s, d) => s + d.cantidad * Number(d.precio_unitario), 0)
}

/** "2026-11-09T21:30:00" → "09/11 21:30". */
export function fechaHora(iso: string | null): string {
  if (!iso) return '—'
  const [fecha, hora] = iso.split('T')
  const [, mes, dia] = fecha.split('-')
  return `${dia}/${mes} ${hora.slice(0, 5)}`
}
