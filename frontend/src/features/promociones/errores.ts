import { ApiError } from '../../api/client'

/** Mensaje visible para un error de la API de promociones (HU-09a). */
export function mensajeDeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'PROMOCION_YA_VENCIDA') {
      return 'No se puede activar una promoción vencida.'
    }
    if (e.code === 'PROMOCION_SUPERPUESTA') {
      return 'Ya existe una promoción activa para uno de esos productos en ese período.'
    }
    return e.message
  }
  return 'Ocurrió un error inesperado'
}
