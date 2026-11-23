/** Tipos del módulo carta. Deben coincidir con los schemas de salida del backend. */

/** SeccionOut (HU-03a). */
export interface Seccion {
  id: number
  nombre: string
  orden: number
  cantidad_productos: number
}

export type TipoProducto = 'PLATO' | 'POSTRE' | 'BEBIDA'

/** Menús especiales (HU-09b): en el diagrama, Menu hereda de Producto. */
export type TipoMenu = 'MENU_EJECUTIVO' | 'MENU_DEL_DIA'

/** Lo que puede aparecer en "Ver carta": productos y menús vigentes. */
export type TipoCarta = TipoProducto | TipoMenu

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
  descuento_porcentaje?: string | null
  precio_final?: string | null
  promocion_descripcion?: string | null
  tipo: TipoCarta
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

/** MenuOut (HU-09b). */
export interface Menu {
  id: number
  nombre: string
  descripcion: string | null
  precio: string
  tipo: TipoMenu
  seccion_id: number
  disponible: boolean
  disponible_efectivo: boolean
  fecha_inicio: string
  fecha_fin: string
  plato: { id: number; nombre: string }
  postre: { id: number; nombre: string } | null
  vigente: boolean
}

/** MenuEjecutivoIn / MenuDelDiaIn. */
export interface MenuDatos {
  nombre: string
  descripcion: string | null
  precio: string
  seccion_id: number
  plato_id: number
  postre_id?: number
  fecha_inicio: string
  fecha_fin: string
}
