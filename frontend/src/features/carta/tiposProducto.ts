import type { TipoProducto } from './types'

/** Etiqueta e ícono de cada tipo de producto (tabla, formulario y carta). */
export const TIPOS_PRODUCTO: Record<TipoProducto, { etiqueta: string; icono: string }> = {
  PLATO: { etiqueta: 'Plato', icono: 'restaurant' },
  POSTRE: { etiqueta: 'Postre', icono: 'icecream' },
  BEBIDA: { etiqueta: 'Bebida', icono: 'local_bar' },
}
