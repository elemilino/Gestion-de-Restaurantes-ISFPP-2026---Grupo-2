import type { EstadoPromocion, Promocion, PromocionCreate, PromocionUpdate } from './types'

/** Valores del formulario de promoción, tal como los escribe el usuario. */
export interface FormularioPromocion {
  descripcion: string
  descuento: string
  fecha_inicio: string
  fecha_fin: string
  productos_ids: number[]
}

export type ErroresPromocion = Partial<Record<keyof FormularioPromocion, string>>

export const FORMULARIO_PROMOCION_VACIO: FormularioPromocion = {
  descripcion: '',
  descuento: '',
  fecha_inicio: '',
  fecha_fin: '',
  productos_ids: [],
}

/** Hasta dos decimales, como `Numeric(5,2)` en el backend. */
const DESCUENTO = /^\d+(\.\d{1,2})?$/

/** Fecha de hoy en formato YYYY-MM-DD, en hora local. */
export function hoyISO(): string {
  const ahora = new Date()
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

/**
 * Valida el formulario con las mismas reglas que el backend (CA2 y CA3).
 *
 * `fechaInicioOriginal` permite conservar una fecha pasada al editar una
 * promoción que ya comenzó (CA4); si la fecha cambia, no puede ser anterior a hoy.
 */
export function validarPromocion(
  datos: FormularioPromocion,
  fechaInicioOriginal?: string,
): ErroresPromocion {
  const errores: ErroresPromocion = {}

  const descripcion = datos.descripcion.trim()
  if (descripcion.length === 0) {
    errores.descripcion = 'La descripción es obligatoria'
  } else if (descripcion.length < 3 || descripcion.length > 200) {
    errores.descripcion = 'La descripción debe tener entre 3 y 200 caracteres'
  }

  const descuento = datos.descuento.trim()
  if (descuento.length === 0) {
    errores.descuento = 'El descuento es obligatorio'
  } else if (!DESCUENTO.test(descuento)) {
    errores.descuento = 'El descuento debe ser un número con hasta 2 decimales'
  } else {
    const valor = Number(descuento)
    if (valor <= 0 || valor > 100) {
      errores.descuento = 'El descuento debe ser mayor a 0 y menor o igual a 100'
    }
  }

  if (!datos.fecha_inicio) {
    errores.fecha_inicio = 'La fecha de inicio es obligatoria'
  } else if (datos.fecha_inicio !== fechaInicioOriginal && datos.fecha_inicio < hoyISO()) {
    errores.fecha_inicio = 'La fecha de inicio no puede ser anterior a hoy'
  }

  if (!datos.fecha_fin) {
    errores.fecha_fin = 'La fecha de fin es obligatoria'
  } else if (datos.fecha_inicio && datos.fecha_fin <= datos.fecha_inicio) {
    errores.fecha_fin = 'La fecha de fin debe ser posterior a la fecha de inicio'
  }

  if (datos.productos_ids.length === 0) {
    errores.productos_ids = 'Seleccioná al menos un producto'
  }

  return errores
}

/** Convierte el formulario (ya validado) en los datos que espera la API. */
export function aDatosApi(datos: FormularioPromocion): PromocionCreate {
  return {
    descripcion: datos.descripcion.trim(),
    descuento: datos.descuento.trim(),
    fecha_inicio: datos.fecha_inicio,
    fecha_fin: datos.fecha_fin,
    productos_ids: datos.productos_ids,
  }
}

/** Precarga el formulario para editar una promoción existente (CA4). */
export function aFormulario(promocion: Promocion): FormularioPromocion {
  return {
    descripcion: promocion.descripcion,
    descuento: promocion.descuento,
    fecha_inicio: promocion.fecha_inicio,
    fecha_fin: promocion.fecha_fin,
    productos_ids: promocion.productos.map((producto) => producto.id),
  }
}

/** Formatea una fecha ISO (YYYY-MM-DD) como dd/mm/aaaa; '' si no es válida. */
export function formatearFecha(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!partes) return ''
  const [, anio, mes, dia] = partes
  return `${dia}/${mes}/${anio}`
}

/** Da formato dd/mm/aaaa a lo que escribe el usuario, descartando lo demás. */
export function formatearFechaEntrada(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8)
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`
}

/** Convierte dd/mm/aaaa a ISO (YYYY-MM-DD); '' si está incompleta o es inválida. */
export function textoAFecha(texto: string): string {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto)
  if (!partes) return ''
  const [, dia, mes, anio] = partes
  const fecha = new Date(Number(anio), Number(mes) - 1, Number(dia))
  const valida =
    fecha.getFullYear() === Number(anio) &&
    fecha.getMonth() === Number(mes) - 1 &&
    fecha.getDate() === Number(dia)
  return valida ? `${anio}-${mes}-${dia}` : ''
}

/**
 * Productos de la selección que ya tienen otra promoción activa superpuesta
 * en el mismo período. Devuelve, por producto, las promociones en conflicto.
 */
export function conflictosDeProductos(
  promociones: Promocion[],
  productosIds: number[],
  fechaInicio: string,
  fechaFin: string,
  excluirId?: number,
): Map<number, Promocion[]> {
  const ids = new Set(productosIds)
  const conflictos = new Map<number, Promocion[]>()

  for (const promocion of promociones) {
    if (!promocion.activo || promocion.id === excluirId) continue
    if (promocion.fecha_inicio > fechaFin || promocion.fecha_fin < fechaInicio) continue

    for (const producto of promocion.productos) {
      if (!ids.has(producto.id)) continue
      const lista = conflictos.get(producto.id) ?? []
      lista.push(promocion)
      conflictos.set(producto.id, lista)
    }
  }

  return conflictos
}

function mismosIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const conjunto = new Set(b)
  return a.every((id) => conjunto.has(id))
}

/**
 * CA4: arma un update parcial con solo los campos que cambiaron.
 *
 * Evita reenviar la selección de productos (y volver a validar productos
 * inactivos) cuando el usuario solo edita la descripción o las fechas.
 */
export function cambiosRespectoDe(
  datos: FormularioPromocion,
  original: FormularioPromocion,
): PromocionUpdate {
  const enviar = aDatosApi(datos)
  const cambios: PromocionUpdate = {}

  if (enviar.descripcion !== original.descripcion.trim()) {
    cambios.descripcion = enviar.descripcion
  }
  if (enviar.descuento !== original.descuento.trim()) {
    cambios.descuento = enviar.descuento
  }
  if (enviar.fecha_inicio !== original.fecha_inicio) {
    cambios.fecha_inicio = enviar.fecha_inicio
  }
  if (enviar.fecha_fin !== original.fecha_fin) {
    cambios.fecha_fin = enviar.fecha_fin
  }
  if (!mismosIds(enviar.productos_ids, original.productos_ids)) {
    cambios.productos_ids = enviar.productos_ids
  }

  return cambios
}

/** Estado calculado de la promoción para el listado (badge). */
export function estadoPromocion(
  promocion: Pick<Promocion, 'activo' | 'fecha_inicio' | 'fecha_fin'>,
): EstadoPromocion {
  const hoy = hoyISO()
  if (promocion.fecha_fin < hoy) return 'vencida'
  if (!promocion.activo) return 'inactiva'
  if (promocion.fecha_inicio > hoy) return 'programada'
  return 'vigente'
}
