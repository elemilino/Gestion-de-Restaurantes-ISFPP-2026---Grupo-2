/** Tipos de reservas (HU-11a y HU-11b). Coinciden con ReservaOut del backend. */

export type EstadoReserva = 'ACTIVA' | 'CUMPLIDA' | 'CANCELADA' | 'AUSENTE'

export interface Reserva {
  id: number
  nro_reserva: number
  fecha_hora: string
  fecha: string
  hora: string
  duracion_horas: number
  cantidad_comensales: number
  estado: EstadoReserva
  cliente: { id: number; nombre: string; apellido: string; dni: string; telefono: string } | null
  mesas: { id: number; numero: number; capacidad: number }[]
  sena: {
    monto: string
    fecha: string
    medio_pago_id: number
    medio_pago_nombre: string
    devuelta: boolean
  } | null
  menu_acordado: {
    producto_id: number
    producto_nombre: string
    cantidad: number
    precio: string
  }[]
  fecha_hora_llegada: string | null
  tiene_comanda: boolean
}

export interface ItemMenu {
  producto_id: number
  cantidad: number
  precio_acordado: string
}

/** ReservaDatos / ReservaCrear. */
export interface ReservaDatos {
  fecha: string
  hora: string
  duracion_horas: number
  cantidad_comensales: number
  numeros_mesa: number[]
  cliente_id: number
  menu_acordado: ItemMenu[]
  sena?: { monto: string; medio_pago_id: number }
}

export interface FiltrosReservas {
  fecha?: string
  estado?: EstadoReserva
}
