/** Tipos del módulo carta. Deben coincidir con los schemas de salida del backend. */

/** SeccionOut (HU-03a). */
export interface Seccion {
  id: number
  nombre: string
  orden: number
  cantidad_productos: number
}
