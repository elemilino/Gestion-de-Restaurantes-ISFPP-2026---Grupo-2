import type { ProductoDatos, TipoProducto } from './types'

/** Valores del formulario de producto, tal como los escribe el usuario. */
export interface FormularioProducto {
  nombre: string
  descripcion: string
  precio: string
  seccion_id: string
  porcion_gramos: string
  volumen_ml: string
  alcoholica: boolean
}

export type ErroresProducto = Partial<Record<keyof FormularioProducto, string>>

export const FORMULARIO_VACIO: FormularioProducto = {
  nombre: '',
  descripcion: '',
  precio: '',
  seccion_id: '',
  porcion_gramos: '',
  volumen_ml: '',
  alcoholica: false,
}

const ENTERO_POSITIVO = /^[1-9]\d*$/

/** Tipos que tienen porción en gramos. */
const CON_PORCION: TipoProducto[] = ['PLATO', 'POSTRE']

/**
 * Valida el formulario con las mismas reglas que el backend (HU-04a CA3).
 * Devuelve un mensaje por campo con error (objeto vacío si está todo bien).
 */
export function validarProducto(tipo: TipoProducto, datos: FormularioProducto): ErroresProducto {
  const errores: ErroresProducto = {}

  const nombre = datos.nombre.trim()
  if (nombre.length < 3 || nombre.length > 60) {
    errores.nombre = 'El nombre debe tener entre 3 y 60 caracteres'
  }
  if (datos.descripcion.trim().length > 200) {
    errores.descripcion = 'La descripción no puede superar los 200 caracteres'
  }
  const precio = datos.precio.trim()
  if (precio === '' || !Number.isFinite(Number(precio)) || Number(precio) <= 0) {
    errores.precio = 'El precio debe ser mayor a 0'
  } else if (!/^\d+(\.\d{1,2})?$/.test(precio)) {
    errores.precio = 'El precio puede tener hasta 2 decimales'
  }
  if (datos.seccion_id === '') {
    errores.seccion_id = 'Elegí una sección'
  }
  if (CON_PORCION.includes(tipo)) {
    const porcion = datos.porcion_gramos.trim()
    if (porcion !== '' && !ENTERO_POSITIVO.test(porcion)) {
      errores.porcion_gramos = 'La porción debe ser un número entero mayor a 0'
    }
  }
  if (tipo === 'BEBIDA' && !ENTERO_POSITIVO.test(datos.volumen_ml.trim())) {
    errores.volumen_ml = 'El volumen debe ser un número entero mayor a 0'
  }
  return errores
}

/** Convierte el formulario (ya validado) en los datos que espera la API. */
export function aDatosApi(tipo: TipoProducto, datos: FormularioProducto): ProductoDatos {
  const base: ProductoDatos = {
    nombre: datos.nombre.trim(),
    descripcion: datos.descripcion.trim() || null,
    precio: datos.precio.trim(),
    seccion_id: Number(datos.seccion_id),
  }
  if (CON_PORCION.includes(tipo)) {
    const porcion = datos.porcion_gramos.trim()
    base.porcion_gramos = porcion === '' ? null : Number(porcion)
  }
  if (tipo === 'BEBIDA') {
    base.volumen_ml = Number(datos.volumen_ml)
    base.alcoholica = datos.alcoholica
  }
  return base
}
