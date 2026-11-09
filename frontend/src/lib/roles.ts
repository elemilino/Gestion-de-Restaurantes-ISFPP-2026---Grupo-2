/**
 * Roles del sistema. Deben coincidir con `Rol` de backend/app/core/enums.py.
 * Solo están los mínimos; cada HU agrega el suyo (ej. CAJERO en HU-08).
 */
export const Rol = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  MOZO: 'MOZO',
  RECEPCIONISTA: 'RECEPCIONISTA',
} as const

export type Rol = (typeof Rol)[keyof typeof Rol]

export const NOMBRE_ROL: Record<Rol, string> = {
  ADMINISTRADOR: 'Administrador',
  MOZO: 'Mozo',
  RECEPCIONISTA: 'Recepcionista',
}
