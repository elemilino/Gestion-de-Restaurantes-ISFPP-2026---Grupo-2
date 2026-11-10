import { apiDelete, apiGet, apiPatch, apiPost } from '../../api/client'
import type { Comanda, ComandaCrear, FiltrosComandas, MesaTablero, ReservaPendiente } from './types'

const BASE = '/comandas'

function query(filtros: object): string {
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(clave, String(valor))
  }
  const texto = params.toString()
  return texto ? '?' + texto : ''
}

export const tableroMesas = () => apiGet<MesaTablero[]>(`${BASE}/tablero-mesas`)

export const listarComandas = (filtros: FiltrosComandas = {}) =>
  apiGet<Comanda[]>(BASE + query(filtros))

export const obtenerComanda = (id: number) => apiGet<Comanda>(`${BASE}/${id}`)

export const crearComanda = (datos: ComandaCrear) => apiPost<Comanda>(BASE, datos)

export const modificarComanda = (
  id: number,
  datos: { dni_mozo?: string; cantidad_comensales?: number },
) => apiPatch<Comanda>(`${BASE}/${id}`, datos)

export const agregarProducto = (id: number, productoId: number, cantidad: number) =>
  apiPost<Comanda>(`${BASE}/${id}/detalles`, { producto_id: productoId, cantidad })

export const cambiarCantidad = (id: number, detalleId: number, cantidad: number) =>
  apiPatch<Comanda>(`${BASE}/${id}/detalles/${detalleId}`, { cantidad })

export const quitarProducto = (id: number, detalleId: number) =>
  apiDelete<Comanda>(`${BASE}/${id}/detalles/${detalleId}`)

export const entregarProducto = (id: number, detalleId: number, entregado = true) =>
  apiPatch<Comanda>(`${BASE}/${id}/detalles/${detalleId}/entrega`, { entregado })

export const cerrarComanda = (id: number) => apiPost<Comanda>(`${BASE}/${id}/cierre`)

export const reabrirComanda = (id: number) => apiPost<Comanda>(`${BASE}/${id}/reapertura`)

export const anularComanda = (id: number, motivo: string) =>
  apiPost<Comanda>(`${BASE}/${id}/anulacion`, { motivo })

export const eliminarComanda = (id: number) => apiDelete(`${BASE}/${id}`)

/** Reservas cumplidas que todavía no tienen comanda (HU-05a CA8). */
export const reservasPendientes = () =>
  apiGet<ReservaPendiente[]>('/reservas?estado=CUMPLIDA&sin_comanda=true')
