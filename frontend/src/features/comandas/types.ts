/** Tipos del módulo comandas (HU-05a a HU-05f, HU-06). Coinciden con el backend. */

export type EstadoComanda = 'ABIERTA' | 'CERRADA' | 'FACTURADA' | 'ANULADA'

export interface DetalleComanda {
  id: number
  producto: { id: number; nombre: string; precio: string }
  cantidad: number
  precio_unitario: string
  entregado: boolean
}

/** ComandaRespuesta. */
export interface Comanda {
  id: number
  cantidad_comensales: number
  fecha_hora_apertura: string
  fecha_hora_cierre: string | null
  estado: EstadoComanda
  motivo_anulacion: string | null
  reserva_id: number | null
  abierta: boolean
  mozo: { id: number; dni: string; nombre: string; apellido: string }
  mesas: { id: number; numero: number; capacidad: number }[]
  detalles: DetalleComanda[]
}

export type EstadoMesaTablero = 'libre' | 'ocupada' | 'esperando_cobro'

/** ReservaTableroOut: reserva activa de hoy en una mesa (aviso, no bloquea el uso). */
export interface ReservaTablero {
  id: number
  fecha_hora: string
  cliente: string | null
  cantidad_comensales: number
}

/** MesaTableroOut. */
export interface MesaTablero {
  id: number
  numero: number
  capacidad: number
  sector_id: number
  sector_nombre: string
  estado_mesa: EstadoMesaTablero
  comanda: Comanda | null
  reserva_hoy: ReservaTablero | null
}

export interface ComandaCrear {
  dni_mozo: string
  cantidad_comensales?: number
  numeros_mesa?: number[]
}

export interface FiltrosComandas {
  dni_mozo?: string
  fecha_desde?: string
  fecha_hasta?: string
  abierta?: boolean
}
