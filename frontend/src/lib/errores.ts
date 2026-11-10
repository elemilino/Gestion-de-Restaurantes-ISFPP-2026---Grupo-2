import { ApiError } from '../api/client'

/** Mensaje para mostrar al usuario a partir de un error de la API. */
export function mensajeDe(e: unknown, porDefecto = 'Ocurrió un error inesperado'): string {
  return e instanceof ApiError ? e.message : porDefecto
}
