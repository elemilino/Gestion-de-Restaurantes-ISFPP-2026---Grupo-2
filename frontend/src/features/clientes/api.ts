import { apiDelete, apiGet, apiPost, apiPut } from '../../api/client'
import type { Cliente, ClienteCreate, ClienteUpdate } from './types'

/**
 * Lista los clientes activos. El backend acepta `busqueda` (DNI, nombre o apellido),
 * pero la pantalla filtra en memoria para que la búsqueda sea instantánea.
 */
export const listarClientes = (busqueda?: string) => {
  const consulta = busqueda?.trim() ? `?busqueda=${encodeURIComponent(busqueda.trim())}` : ''
  return apiGet<Cliente[]>(`/clientes${consulta}`)
}

export const obtenerCliente = (id: number) => apiGet<Cliente>(`/clientes/${id}`)

export const crearCliente = (datos: ClienteCreate) => apiPost<Cliente>('/clientes', datos)

export const modificarCliente = (id: number, datos: ClienteUpdate) =>
  apiPut<Cliente>(`/clientes/${id}`, datos)

export const eliminarCliente = (id: number) => apiDelete<void>(`/clientes/${id}`)
