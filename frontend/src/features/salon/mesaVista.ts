import type { MesaTablero } from '../comandas/types'

export type EstadoMesa = 'libre' | 'ocupada' | 'esperando_cobro' | 'reservada'

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
  reserva?: { titular: string; hora: string; peticion?: string }
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
  if (mesa.estado_mesa === 'reservada') {
    vista.comensales = mesa.capacidad
    vista.reserva = {
      titular: mesa.sector_nombre,
      hora: 'Reservada para hoy',
      peticion: 'Ver detalle en Reservas',
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
