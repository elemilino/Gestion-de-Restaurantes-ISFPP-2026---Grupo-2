/**
 * Cliente HTTP para el backend. Todas las rutas son relativas a /api/v1.
 *
 * Ejemplo (en features/carta/api.ts):
 *   export const listarSecciones = () => apiGet<Seccion[]>('/carta/secciones')
 *
 * Si el backend responde con error, se lanza un ApiError con el `detail` y el `code`
 * del formato común del backend, listo para mostrar al usuario.
 */
import { borrarSesion, leerSesion } from '../auth/sesion'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api/v1'

export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, detail: string, code?: string) {
    super(detail)
    this.status = status
    this.code = code
  }
}

async function request<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const token = leerSesion()?.token
  const respuesta = await fetch(BASE + ruta, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  })

  if (respuesta.status === 401 && token) {
    // Sesión vencida: se vuelve al login.
    borrarSesion()
    window.location.assign('/login')
  }
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({}))
    // Los errores de validación de FastAPI traen `detail` como lista.
    const detail = Array.isArray(cuerpo.detail)
      ? cuerpo.detail.map((e: { msg: string }) => e.msg).join('. ')
      : (cuerpo.detail ?? 'Error inesperado del servidor')
    throw new ApiError(respuesta.status, detail, cuerpo.code)
  }
  return (respuesta.status === 204 ? undefined : await respuesta.json()) as T
}

export const apiGet = <T>(ruta: string) => request<T>(ruta)

export const apiPost = <T>(ruta: string, datos?: unknown) =>
  request<T>(ruta, { method: 'POST', body: JSON.stringify(datos) })

export const apiPut = <T>(ruta: string, datos?: unknown) =>
  request<T>(ruta, { method: 'PUT', body: JSON.stringify(datos) })

export const apiPatch = <T>(ruta: string, datos?: unknown) =>
  request<T>(ruta, { method: 'PATCH', body: JSON.stringify(datos) })

export const apiDelete = <T = void>(ruta: string) => request<T>(ruta, { method: 'DELETE' })
