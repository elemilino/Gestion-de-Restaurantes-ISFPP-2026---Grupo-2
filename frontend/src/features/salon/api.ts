import { apiDelete, apiGet, apiPost, apiPut } from '../../api/client'
import type { Mesa, MesaDatos, Sector, SectorDatos } from './types'

// --- Sectores (HU-01a) ---

export const listarSectores = () => apiGet<Sector[]>('/salon/sectores')

export const crearSector = (datos: SectorDatos) => apiPost<Sector>('/salon/sectores', datos)

export const modificarSector = (id: number, datos: SectorDatos) =>
  apiPut<Sector>(`/salon/sectores/${id}`, datos)

export const eliminarSector = (id: number) => apiDelete(`/salon/sectores/${id}`)

// --- Mesas (HU-01b) ---

export const listarMesas = (sectorId?: number) =>
  apiGet<Mesa[]>('/salon/mesas' + (sectorId ? '?sector_id=' + sectorId : ''))

export const crearMesa = (datos: MesaDatos) => apiPost<Mesa>('/salon/mesas', datos)

export const modificarMesa = (id: number, datos: MesaDatos) =>
  apiPut<Mesa>(`/salon/mesas/${id}`, datos)

export const eliminarMesa = (id: number) => apiDelete(`/salon/mesas/${id}`)
