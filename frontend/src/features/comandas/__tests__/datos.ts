import type { Comanda, MesaTablero } from '../types'

export const COMANDA: Comanda = {
  id: 7,
  cantidad_comensales: 3,
  fecha_hora_apertura: '2026-11-10T20:15:00',
  fecha_hora_cierre: null,
  estado: 'ABIERTA',
  motivo_anulacion: null,
  reserva_id: null,
  abierta: true,
  mozo: { id: 1, dni: '12345678', nombre: 'Ana', apellido: 'Ruiz' },
  mesas: [{ id: 1, numero: 1, capacidad: 4 }],
  detalles: [
    {
      id: 11,
      producto: { id: 3, nombre: 'Milanesa napolitana', precio: '8500.00' },
      cantidad: 2,
      precio_unitario: '8500.00',
      entregado: true,
    },
    {
      id: 12,
      producto: { id: 4, nombre: 'Flan casero', precio: '3000.00' },
      cantidad: 1,
      precio_unitario: '3000.00',
      entregado: false,
    },
  ],
}

export const TABLERO: MesaTablero[] = [
  {
    id: 1,
    numero: 1,
    capacidad: 4,
    sector_id: 1,
    sector_nombre: 'Salón Principal',
    estado_mesa: 'ocupada',
    comanda: COMANDA,
  },
  {
    id: 2,
    numero: 2,
    capacidad: 2,
    sector_id: 1,
    sector_nombre: 'Salón Principal',
    estado_mesa: 'libre',
    comanda: null,
  },
]
