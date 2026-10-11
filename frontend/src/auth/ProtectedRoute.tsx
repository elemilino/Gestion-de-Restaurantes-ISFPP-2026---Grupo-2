import { Navigate, Outlet, useLocation } from 'react-router'

import { navItemDeRuta, navItems } from '../layout/navItems'
import { useAuth } from './useAuth'

/**
 * Protege las rutas hijas:
 * - sin sesión → redirige a /login;
 * - con sesión, si la ruta pertenece a un ítem del menú cuyo rol no tiene el usuario
 *   → redirige a la primera sección que sí puede ver.
 * Los roles de cada sección se definen en layout/navItems.ts.
 */
export function ProtectedRoute() {
  const { usuario } = useAuth()
  const { pathname } = useLocation()

  if (!usuario) {
    return <Navigate to="/login" replace state={{ desde: pathname }} />
  }

  const item = navItemDeRuta(pathname)
  if (item && !item.roles.includes(usuario.rol)) {
    const permitido = navItems.find((i) => i.roles.includes(usuario.rol))
    return <Navigate to={permitido?.ruta ?? '/login'} replace />
  }

  return <Outlet />
}
