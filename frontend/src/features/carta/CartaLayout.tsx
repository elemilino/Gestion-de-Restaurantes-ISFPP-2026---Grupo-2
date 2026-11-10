import { NavLink, Outlet } from 'react-router'

import { useAuth } from '../../auth/useAuth'
import { Icon } from '../../components/Icon'
import { Rol } from '../../lib/roles'

interface Pestania {
  ruta: string
  etiqueta: string
  icono: string
  /** Roles que ven la pestaña. */
  roles: Rol[]
}

/** Pestañas de /carta. Para sumar una (ej. Menús o Promociones, HU-09), agregarla acá. */
const PESTANIAS: Pestania[] = [
  {
    ruta: '/carta',
    etiqueta: 'Ver carta',
    icono: 'menu_book',
    roles: [Rol.ADMINISTRADOR, Rol.MOZO],
  },
  {
    ruta: '/carta/secciones',
    etiqueta: 'Secciones',
    icono: 'view_list',
    roles: [Rol.ADMINISTRADOR],
  },
  {
    ruta: '/carta/productos',
    etiqueta: 'Productos',
    icono: 'inventory_2',
    roles: [Rol.ADMINISTRADOR],
  },
  {
    ruta: '/carta/promociones',
    etiqueta: 'Promociones',
    icono: 'local_offer',
    roles: [Rol.ADMINISTRADOR, Rol.ENCARGADO_GENERAL],
  },
]

/** Encabezado "Carta y Menú" con pestañas; debajo, la página de la subruta. */
export function CartaLayout() {
  const { usuario } = useAuth()
  const visibles = PESTANIAS.filter((p) => usuario && p.roles.includes(usuario.rol))

  return (
    <>
      <div className="bg-white rounded-2xl p-4 border border-borde shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700">
            <Icon name="restaurant_menu" className="text-xl" />
          </span>
          <h1 className="text-xl font-bold text-slate-900">Carta y Menú</h1>
        </div>
        {visibles.length > 1 && (
          <nav className="flex flex-wrap items-center gap-1.5" aria-label="Secciones de la carta">
            {visibles.map((p) => (
              <NavLink
                key={p.ruta}
                to={p.ruta}
                end
                className={({ isActive }) =>
                  `px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-amber-50 hover:text-brand-800'
                  }`
                }
              >
                <Icon name={p.icono} className="text-base" />
                {p.etiqueta}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
      <Outlet />
    </>
  )
}
