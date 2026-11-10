/**
 * Roles del sistema. Deben coincidir con `Rol` de backend/app/core/enums.py
 * (lista cerrada de actores acordada por el grupo).
 */
export const Rol = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  MOZO: 'MOZO',
  CAJERO: 'CAJERO',
  RECEPCIONISTA: 'RECEPCIONISTA',
  ENCARGADO_GENERAL: 'ENCARGADO_GENERAL',
  COCINERO: 'COCINERO',
} as const

export type Rol = (typeof Rol)[keyof typeof Rol]

export const NOMBRE_ROL: Record<Rol, string> = {
  ADMINISTRADOR: 'Administrador',
  MOZO: 'Mozo',
  CAJERO: 'Cajero',
  RECEPCIONISTA: 'Recepcionista',
  ENCARGADO_GENERAL: 'Encargado general',
  COCINERO: 'Cocinero',
}
