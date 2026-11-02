/** Tipos del módulo carta. Deben coincidir con los schemas de salida del backend. */

/** SeccionOut (HU-03a). */
export interface Seccion {
  id: number
  nombre: string
  orden: number
  cantidad_productos: number
}

export type TipoProducto = 'PLATO' | 'POSTRE' | 'BEBIDA'

/** ProductoOut (HU-04a). `precio` es texto: el backend envía los Decimal como string. */
export interface Producto {
  id: number
  nombre: string
  descripcion: string | null
  precio: string
  tipo: TipoProducto
  seccion_id: number
  porcion_gramos: number | null
  volumen_ml: number | null
  alcoholica: boolean | null
  disponible: boolean
  stock: number | null
  /** Disponible, activo y con stock si lo controla (HU-04d). */
  disponible_efectivo: boolean
}

/** Datos que se envían al crear o modificar un producto (PlatoCreate, ...). */
export interface ProductoDatos {
  nombre: string
  descripcion: string | null
  precio: string
  seccion_id: number
  porcion_gramos?: number | null
  volumen_ml?: number
  alcoholica?: boolean
}

export interface FiltrosProductos {
  tipo?: TipoProducto
  seccion_id?: number
}

/** ProductoCartaOut (HU-03b). `disponible` es la disponibilidad efectiva. */
export interface ProductoCarta {
  id: number
  nombre: string
  descripcion: string | null
  precio: string
  tipo: TipoProducto
  porcion_gramos: number | null
  volumen_ml: number | null
  alcoholica: boolean | null
  disponible: boolean
}

/** SeccionCartaOut (HU-03b). */
export interface SeccionCarta {
  id: number
  nombre: string
  orden: number
  productos: ProductoCarta[]
}

/** CartaOut (HU-03b). */
export interface Carta {
  secciones: SeccionCarta[]
}
