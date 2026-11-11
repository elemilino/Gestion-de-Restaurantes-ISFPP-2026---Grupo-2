/** Tipos de caja: medios de pago (HU-07) y facturación (HU-08). Coinciden con el backend. */

export type TipoAcreditacion = 'Inmediata' | 'Diferida'
export type TipoFactura = 'A' | 'B' | 'C' | 'Consumidor Final'
export type EstadoFactura = 'Adeudada' | 'Pagada'

export interface MedioPago {
  id: number
  nombre: string
  tipo_acreditacion: TipoAcreditacion
  porcentaje_recargo: string
  activo: boolean
}

export interface MedioPagoDatos {
  nombre: string
  tipo_acreditacion: TipoAcreditacion
  porcentaje_recargo: string
  activo?: boolean
}

export interface DetallePago {
  id: number
  medio_pago_id: number
  medio_pago_nombre: string
  porcentaje_recargo: string
  monto_abonado: string
  monto_con_recargo: string
}

export interface Factura {
  id: number
  comanda_id: number
  cuit_dni_cliente: string | null
  tipo_factura: TipoFactura
  fecha: string
  importe_total: string
  total_a_pagar: string
  monto_recibido: string
  estado: EstadoFactura
  detalles_pago: DetallePago[]
}

export interface ComandaPorFacturar {
  comanda_id: number
  fecha_hora_cierre: string | null
  mesas: number[]
  mozo: string
  cantidad_comensales: number
  importe: string
}

export interface Comprobante {
  factura_id: number
  fecha: string
  tipo_factura: TipoFactura
  cuit_dni_cliente: string | null
  comanda_id: number
  mesa_numero: number | null
  mozo_nombre: string | null
  items: { producto_nombre: string; cantidad: number; precio_unitario: string; subtotal: string }[]
  importe_total: string
  total_a_pagar: string
  monto_recibido: string
  vuelto: string
  detalles_pago: DetallePago[]
}
