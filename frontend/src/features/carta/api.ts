import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../api/client'
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

// --- Postres (HU-04b) ---

export const crearPostre = (datos: ProductoDatos) => apiPost<Producto>('/carta/postres', datos)

export const modificarPostre = (id: number, datos: ProductoDatos) =>
  apiPut<Producto>(`/carta/postres/${id}`, datos)

// --- Bebidas (HU-04c) ---

export const crearBebida = (datos: ProductoDatos) => apiPost<Producto>('/carta/bebidas', datos)

export const modificarBebida = (id: number, datos: ProductoDatos) =>
  apiPut<Producto>(`/carta/bebidas/${id}`, datos)

// --- Stock y disponibilidad (HU-04d) ---

export const cambiarDisponibilidad = (id: number, disponible: boolean) =>
  apiPatch<Producto>(`/carta/productos/${id}/disponibilidad`, { disponible })

export const cambiarStock = (id: number, stock: number | null) =>
  apiPatch<Producto>(`/carta/productos/${id}/stock`, { stock })
