import { apiGet, apiPatch, apiPost, apiPut } from '../../api/client'
import type { FiltroPromocion, Promocion, PromocionCreate, PromocionUpdate } from './types'

export const listarPromociones = (estado?: FiltroPromocion) => {
  const consulta = estado && estado !== 'todas' ? `?estado=${estado}` : ''
  return apiGet<Promocion[]>(`/promociones${consulta}`)
}

export const obtenerPromocion = (id: number) => apiGet<Promocion>(`/promociones/${id}`)

export const crearPromocion = (datos: PromocionCreate) => apiPost<Promocion>('/promociones', datos)

export const modificarPromocion = (id: number, datos: PromocionUpdate) =>
  apiPut<Promocion>(`/promociones/${id}`, datos)

export const cambiarEstadoPromocion = (id: number, activo: boolean) =>
  apiPatch<Promocion>(`/promociones/${id}/activo`, { activo })
