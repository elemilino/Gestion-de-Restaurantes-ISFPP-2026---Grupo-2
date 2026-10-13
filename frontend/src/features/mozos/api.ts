import { apiDelete, apiGet, apiPost, apiPut } from '../../api/client'
import type {
  Mozo,
  MozoCreate,
  MozoUpdate,
  ReasignarComandasResponse,
  SectorSimple,
  ValidarMesaResponse,
} from './types'

export const listarMozos = () => apiGet<Mozo[]>('/mozos')

export const listarSectoresDisponibles = () => apiGet<SectorSimple[]>('/mozos/sectores')

export const obtenerMiPerfilMozo = () => apiGet<Mozo>('/mozos/mi-perfil')

export const crearMozo = (datos: MozoCreate) => apiPost<Mozo>('/mozos', datos)

export const modificarMozo = (id: number, datos: MozoUpdate) => apiPut<Mozo>(`/mozos/${id}`, datos)

export const eliminarMozo = (id: number) => apiDelete<void>(`/mozos/${id}`)

export const reasignarComandas = (id: number, nuevoMozoId: number) =>
  apiPost<ReasignarComandasResponse>(`/mozos/${id}/reasignar-comandas`, {
    nuevo_mozo_id: nuevoMozoId,
  })

export const validarMesa = (mesaId: number) =>
  apiPost<ValidarMesaResponse>(`/mozos/validar-mesa/${mesaId}`)
