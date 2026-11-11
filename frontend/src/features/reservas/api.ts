import { apiGet, apiPost, apiPut } from '../../api/client'
import type { FiltrosReservas, Reserva, ReservaDatos } from './types'

function query(filtros: object): string {
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(clave, String(valor))
  }
  const texto = params.toString()
  return texto ? '?' + texto : ''
}

export const listarReservas = (filtros: FiltrosReservas = {}) =>
  apiGet<Reserva[]>('/reservas' + query(filtros))

export const crearReserva = (datos: ReservaDatos) => apiPost<Reserva>('/reservas', datos)

export const modificarReserva = (id: number, datos: ReservaDatos) =>
  apiPut<Reserva>(`/reservas/${id}`, datos)

export const cancelarReserva = (id: number) => apiPost<Reserva>(`/reservas/${id}/cancelacion`)

export const registrarLlegada = (id: number) => apiPost<Reserva>(`/reservas/${id}/llegada`)

export const registrarAusencia = (id: number) => apiPost<Reserva>(`/reservas/${id}/ausencia`)
