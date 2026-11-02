import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

import type { Rol } from '../lib/roles'
import { useAuth } from './useAuth'

interface RequiereRolProps {
  roles: Rol[]
  /** Adónde ir si el usuario no tiene el rol (por defecto, el inicio). */
  redirigirA?: string
  children: ReactNode
}

/**
 * Muestra `children` solo si el usuario tiene alguno de los roles. Sirve para subrutas
 * con permisos distintos a los de su sección (ej. /carta/secciones solo para Admin).
 */
export function RequiereRol({ roles, redirigirA = '/', children }: RequiereRolProps) {
  const { usuario } = useAuth()
  if (!usuario || !roles.includes(usuario.rol)) {
    return <Navigate to={redirigirA} replace />
  }
  return <>{children}</>
}
