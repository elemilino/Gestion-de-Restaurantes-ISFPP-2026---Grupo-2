import { apiDelete, apiGet, apiPost, apiPut } from '../../api/client'
import type { FiltrosProductos, Producto, ProductoDatos, Seccion } from './types'

// --- Secciones (HU-03a) ---

export const listarSecciones = () => apiGet<Seccion[]>('/carta/secciones')

export const crearSeccion = (datos: { nombre: string; orden?: number }) =>
  apiPost<Seccion>('/carta/secciones', datos)

export const modificarSeccion = (id: number, datos: { nombre: string; orden: number }) =>
  apiPut<Seccion>(`/carta/secciones/${id}`, datos)

export const eliminarSeccion = (id: number) => apiDelete(`/carta/secciones/${id}`)

// --- Productos (HU-04a) ---

export function listarProductos(filtros: FiltrosProductos = {}) {
  const params = new URLSearchParams()
  if (filtros.tipo) params.set('tipo', filtros.tipo)
  if (filtros.seccion_id) params.set('seccion_id', String(filtros.seccion_id))
  const query = params.toString()
  return apiGet<Producto[]>('/carta/productos' + (query ? '?' + query : ''))
}

export const obtenerProducto = (id: number) => apiGet<Producto>(`/carta/productos/${id}`)

export const eliminarProducto = (id: number) => apiDelete(`/carta/productos/${id}`)

export const crearPlato = (datos: ProductoDatos) => apiPost<Producto>('/carta/platos', datos)

export const modificarPlato = (id: number, datos: ProductoDatos) =>
  apiPut<Producto>(`/carta/platos/${id}`, datos)
