import type { Rol } from '../lib/roles'

export interface Usuario {
  id: number
  username: string
  nombre: string
  rol: Rol
}

export interface Sesion {
  token: string
  usuario: Usuario
}

const CLAVE = 'sesion'

export function leerSesion(): Sesion | null {
  try {
    const guardada = localStorage.getItem(CLAVE)
    return guardada ? (JSON.parse(guardada) as Sesion) : null
  } catch {
    return null
  }
}

export function guardarSesion(sesion: Sesion): void {
  localStorage.setItem(CLAVE, JSON.stringify(sesion))
}

export function borrarSesion(): void {
  localStorage.removeItem(CLAVE)
}
