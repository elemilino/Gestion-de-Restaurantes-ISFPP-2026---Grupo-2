/** Tipos del módulo promociones. Deben coincidir con los schemas del backend (HU-09a). */

export interface PromocionProducto {
  id: number
  nombre: string
}

/** PromocionOut. `descuento` es texto: el backend envía los Decimal como string. */
export interface Promocion {
  id: number
  descripcion: string
  fecha_inicio: string
  fecha_fin: string
  descuento: string
  activo: boolean
  vigente: boolean
  productos: PromocionProducto[]
}

/** Datos para registrar una promoción (CA1-CA3). */
export interface PromocionCreate {
  descripcion: string
  fecha_inicio: string
  fecha_fin: string
  descuento: string
  productos_ids: number[]
}

/** Actualización parcial (CA4): solo se aplican los campos enviados. */
export type PromocionUpdate = Partial<PromocionCreate>

/** Filtro del listado (coincide con el parámetro `estado` del backend). */
export type FiltroPromocion = 'todas' | 'vigentes' | 'programadas' | 'vencidas' | 'inactivas'

/** Estado calculado de una promoción para mostrar en la interfaz. */
export type EstadoPromocion = 'vigente' | 'programada' | 'vencida' | 'inactiva'
