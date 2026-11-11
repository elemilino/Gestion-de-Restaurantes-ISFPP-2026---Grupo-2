import type { TipoCarta, TipoProducto } from './types'

/** Etiqueta e ícono de cada tipo de producto (tabla, formulario y carta). */
export const TIPOS_PRODUCTO: Record<TipoProducto, { etiqueta: string; icono: string }> = {
  PLATO: { etiqueta: 'Plato', icono: 'restaurant' },
  POSTRE: { etiqueta: 'Postre', icono: 'icecream' },
  BEBIDA: { etiqueta: 'Bebida', icono: 'local_bar' },
}

/** Igual que TIPOS_PRODUCTO, más los menús especiales (HU-09b), para "Ver carta". */
export const TIPOS_CARTA: Record<TipoCarta, { etiqueta: string; icono: string }> = {
  ...TIPOS_PRODUCTO,
  MENU_EJECUTIVO: { etiqueta: 'Menú ejecutivo', icono: 'lunch_dining' },
  MENU_DEL_DIA: { etiqueta: 'Menú del día', icono: 'today' },
}
