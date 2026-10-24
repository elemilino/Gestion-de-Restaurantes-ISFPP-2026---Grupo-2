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
  disponible: boolean
  stock: number | null
}

/** Datos que se envían al crear o modificar un producto (PlatoCreate, ...). */
export interface ProductoDatos {
  nombre: string
  descripcion: string | null
  precio: string
  seccion_id: number
  porcion_gramos?: number | null
}

export interface FiltrosProductos {
  tipo?: TipoProducto
  seccion_id?: number
}
