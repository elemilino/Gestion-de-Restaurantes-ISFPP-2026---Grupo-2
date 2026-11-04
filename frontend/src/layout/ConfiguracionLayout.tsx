import { NavLink, Outlet } from 'react-router'

import { Icon } from '../components/Icon'

interface Pestania {
  ruta: string
  etiqueta: string
  icono: string
}

/**
 * Pestañas de /configuracion (toda la sección es solo para Administrador).
 * Para sumar una (ej. Medios de pago, HU-07), agregarla acá y su ruta en App.tsx.
 */
const PESTANIAS: Pestania[] = [
  { ruta: '/configuracion/mozos', etiqueta: 'Mozos', icono: 'badge' },
  { ruta: '/configuracion/sectores', etiqueta: 'Sectores', icono: 'floor' },
  { ruta: '/configuracion/mesas', etiqueta: 'Mesas', icono: 'table_restaurant' },
]

/** Encabezado "Configuración" con pestañas; debajo, la página de la subruta. */
export function ConfiguracionLayout() {
  return (
    <>
      <div className="bg-white rounded-2xl p-4 border border-borde shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700">
            <Icon name="settings" className="text-xl" />
          </span>
          <h1 className="text-xl font-bold text-slate-900">Configuración</h1>
        </div>
        <nav
          className="flex flex-wrap items-center gap-1.5"
          aria-label="Secciones de configuración"
        >
          {PESTANIAS.map((p) => (
            <NavLink
              key={p.ruta}
              to={p.ruta}
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
      </div>
      <Outlet />
    </>
  )
}
