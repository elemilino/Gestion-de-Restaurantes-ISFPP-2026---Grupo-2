import { apiDelete, apiGet, apiPost, apiPut } from '../../api/client'
import type { Seccion } from './types'

// --- Secciones (HU-03a) ---

export const listarSecciones = () => apiGet<Seccion[]>('/carta/secciones')

export const crearSeccion = (datos: { nombre: string; orden?: number }) =>
  apiPost<Seccion>('/carta/secciones', datos)

export const modificarSeccion = (id: number, datos: { nombre: string; orden: number }) =>
  apiPut<Seccion>(`/carta/secciones/${id}`, datos)

export const eliminarSeccion = (id: number) => apiDelete(`/carta/secciones/${id}`)
