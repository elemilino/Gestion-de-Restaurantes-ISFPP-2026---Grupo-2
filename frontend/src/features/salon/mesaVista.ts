import type { MesaTablero, ReservaTablero } from '../comandas/types'

export type EstadoMesa = 'libre' | 'ocupada' | 'esperando_cobro'

/** Cercanía de la reserva: normal (azul), próxima ≤ 60 min (ámbar), inminente ≤ 15 min (rojo). */
export type UrgenciaReserva = 'normal' | 'proxima' | 'inminente'

export const MINUTOS_PROXIMA = 60
export const MINUTOS_INMINENTE = 15

export function urgenciaReserva(minutos: number): UrgenciaReserva {
  if (minutos <= MINUTOS_INMINENTE) return 'inminente'
  if (minutos <= MINUTOS_PROXIMA) return 'proxima'
  return 'normal'
}

/** Minutos que faltan para la reserva (negativo si el horario ya pasó). */
export function minutosHastaReserva(reserva: ReservaTablero, ahora: Date = new Date()): number {
  return Math.round((new Date(reserva.fecha_hora).getTime() - ahora.getTime()) / 60000)
}

/** Hora "HH:MM" de la reserva, tal como la guarda el backend. */
export function horaReserva(reserva: ReservaTablero): string {
  return reserva.fecha_hora.slice(11, 16)
}

/** Reserva de hoy que se muestra como aviso en la tarjeta, en cualquier estado. */
export interface ReservaVista {
  id: number
  hora: string
  titular: string | null
  comensales: number
  minutos: number
  urgencia: UrgenciaReserva
}

/** Datos que muestra una tarjeta de mesa. Los opcionales dependen del estado. */
export interface MesaVista {
  numero: number
  estado: EstadoMesa
  capacidad: number
  comensales?: number
  ubicacion?: string
  nota?: string
  mozo?: string
  minutos?: number
  entregados?: number
  pendientes?: number
  total?: number
  reserva?: ReservaVista
}

/** Convierte una mesa del tablero de comandas (HU-06) en lo que muestra la tarjeta. */
export function aVista(mesa: MesaTablero, ahora: Date = new Date()): MesaVista {
  const comanda = mesa.comanda
  const vista: MesaVista = {
    numero: mesa.numero,
    estado: mesa.estado_mesa,
    capacidad: mesa.capacidad,
    ubicacion: mesa.sector_nombre,
  }
  if (mesa.estado_mesa === 'libre') vista.nota = `Disponible · ${mesa.sector_nombre}`
  if (mesa.reserva_hoy) {
    const minutos = minutosHastaReserva(mesa.reserva_hoy, ahora)
    vista.reserva = {
      id: mesa.reserva_hoy.id,
      hora: horaReserva(mesa.reserva_hoy),
      titular: mesa.reserva_hoy.cliente,
      comensales: mesa.reserva_hoy.cantidad_comensales,
      minutos,
      urgencia: urgenciaReserva(minutos),
    }
  }
  if (comanda) {
    const entregados = comanda.detalles.filter((d) => d.entregado).length
    vista.comensales = comanda.cantidad_comensales
    vista.mozo = `${comanda.mozo.nombre} ${comanda.mozo.apellido.charAt(0)}.`
    vista.minutos = Math.max(
      0,
      Math.round((ahora.getTime() - new Date(comanda.fecha_hora_apertura).getTime()) / 60000),
    )
    vista.entregados = entregados
    vista.pendientes = comanda.detalles.length - entregados
    vista.total = comanda.detalles.reduce((s, d) => s + d.cantidad * Number(d.precio_unitario), 0)
  }
  return vista
}
