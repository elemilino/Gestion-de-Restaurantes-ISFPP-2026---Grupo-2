/*
 * MOCK: las 12 mesas del prototipo de Stitch.
 * Reemplazar por datos del backend:
 *   - mesas y capacidad → GET /api/v1/salon/mesas (HU-01b)
 *   - comanda abierta/cerrada, mozo, entregas y total → HU-05 y HU-06
 *   - reserva del día → HU-11b
 */

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

export const MESAS_MOCK: MesaVista[] = [
  {
    numero: 1,
    estado: 'ocupada',
    capacidad: 4,
    comensales: 3,
    mozo: 'Carlos M.',
    minutos: 45,
    entregados: 5,
    pendientes: 2,
    total: 78500,
  },
  {
    numero: 2,
    estado: 'libre',
    capacidad: 2,
    ubicacion: 'Salón Ventana',
    nota: 'Mesa lista y fajinada',
  },
  {
    numero: 3,
    estado: 'ocupada',
    capacidad: 6,
    comensales: 5,
    mozo: 'Elena R.',
    minutos: 25,
    entregados: 4,
    pendientes: 3,
    total: 142000,
  },
  {
    numero: 4,
    estado: 'libre',
    capacidad: 4,
    ubicacion: 'Zona Centro',
    nota: 'Disponible de inmediato',
  },
  {
    numero: 5,
    estado: 'ocupada',
    capacidad: 2,
    comensales: 2,
    mozo: 'Carlos M.',
    minutos: 75,
    entregados: 6,
    pendientes: 0,
    total: 54200,
  },
  {
    numero: 6,
    estado: 'reservada',
    capacidad: 4,
    comensales: 4,
    reserva: {
      titular: 'Familia Gómez',
      hora: 'Hoy 14:30 h',
      peticion: 'Petición: Trona infantil',
    },
  },
  {
    numero: 7,
    estado: 'ocupada',
    capacidad: 4,
    comensales: 3,
    mozo: 'Marcos V.',
    minutos: 18,
    entregados: 3,
    pendientes: 3,
    total: 65000,
  },
  {
    numero: 8,
    estado: 'esperando_cobro',
    capacidad: 8,
    comensales: 8,
    mozo: 'Carlos M.',
    entregados: 12,
    pendientes: 0,
    total: 215800,
  },
  {
    numero: 9,
    estado: 'libre',
    capacidad: 2,
    ubicacion: 'Salón Esquina',
    nota: 'Montaje completo',
  },
  {
    numero: 10,
    estado: 'ocupada',
    capacidad: 6,
    comensales: 5,
    mozo: 'Elena R.',
    minutos: 38,
    entregados: 7,
    pendientes: 1,
    total: 112400,
  },
  {
    numero: 11,
    estado: 'reservada',
    capacidad: 2,
    comensales: 2,
    reserva: { titular: 'Laura & David', hora: 'Hoy 15:00 h', peticion: 'Aniversario' },
  },
  {
    numero: 12,
    estado: 'libre',
    capacidad: 6,
    ubicacion: 'Mesa Redonda',
    nota: 'Mesa amplia preparada',
  },
]
