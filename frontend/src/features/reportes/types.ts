/** Tipos de los reportes (HU-12a a HU-12f). Coinciden con los schemas del backend. */

export type Periodo = 'HOY' | 'SEMANA' | 'MES' | 'PERSONALIZADO'

export interface FiltroPeriodo {
  periodo: Periodo
  desde?: string
  hasta?: string
}

interface ReporteBase {
  desde: string
  hasta: string
  /** Mensaje cuando no hay datos en el período. */
  mensaje: string | null
}

export interface ReporteVentas extends ReporteBase {
  total_facturado: string
  cantidad_facturas: number
  ticket_promedio: string
  pendiente_cobro: string
  por_dia: { fecha: string; total: string }[]
}

export type TipoProducto = 'PLATO' | 'POSTRE' | 'BEBIDA' | 'MENU_EJECUTIVO' | 'MENU_DEL_DIA'

export interface ProductoVendido {
  posicion: number
  producto_id: number
  nombre: string
  tipo: TipoProducto
  seccion: string
  unidades: number
  importe: string
  eliminado: boolean
}

export interface ReporteProductos extends ReporteBase {
  productos: ProductoVendido[]
}

export interface ComandaDeMozo {
  comanda_id: number
  fecha_hora_cierre: string
  mesas: number[]
  comensales: number
  importe: string
}

export interface VentasMozo {
  mozo_id: number
  dni: string
  nombre: string
  apellido: string
  comandas: number
  comensales: number
  total_facturado: string
  promedio_por_comanda: string
  dado_de_baja: boolean
  detalle: ComandaDeMozo[]
}

export interface ReporteMozos extends ReporteBase {
  mozos: VentasMozo[]
}

export interface CeldaOcupacion {
  /** 0 = lunes ... 6 = domingo */
  dia_semana: number
  hora: number
  porcentaje: number
}

export interface ReporteOcupacion extends ReporteBase {
  mesas_activas: number
  celdas: CeldaOcupacion[]
  ocupacion_promedio: number
  franja_maxima: (CeldaOcupacion & { etiqueta: string }) | null
}

export type EstadoReserva = 'ACTIVA' | 'CUMPLIDA' | 'CANCELADA' | 'AUSENTE'

export interface ReporteReservas extends ReporteBase {
  total_reservas: number
  por_estado: { estado: EstadoReserva; cantidad: number; porcentaje: number }[]
  senas_retenidas: string
  clientes_ausentes: {
    cliente_id: number
    nombre: string
    apellido: string
    dni: string
    telefono: string
    ausencias: number
    total_reservas: number
    dado_de_baja: boolean
  }[]
}

export interface CobroMedio {
  medio_pago_id: number
  nombre: string
  tipo_acreditacion: string
  cantidad_pagos: number
  monto_abonado: string
  recargo: string
  total_cobrado: string
  porcentaje: number
  dado_de_baja: boolean
}

export interface ReporteCobros extends ReporteBase {
  total_cobrado: string
  medios: CobroMedio[]
}

/** Para los filtros: SeccionOut de carta y SectorOut de salón (solo lo que se usa). */
export interface Opcion {
  id: number
  nombre: string
}
