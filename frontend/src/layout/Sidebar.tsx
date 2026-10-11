import { NavLink } from 'react-router'

import { useAuth } from '../auth/useAuth'
import { Icon } from '../components/Icon'
import { NOMBRE_ROL } from '../lib/roles'
import { navItems } from './navItems'

function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .map((parte) => parte[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function Sidebar() {
  const { usuario, logout } = useAuth()
  const visibles = navItems.filter((item) => usuario && item.roles.includes(usuario.rol))

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-amber-100 shadow-sm z-50 flex flex-col justify-between select-none">
      <div className="flex flex-col">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-amber-100/70">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Icon name="dinner_dining" className="text-2xl" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg text-slate-900 tracking-tight leading-none">
              GastroPOS
            </span>
            <span className="text-[10px] text-brand-700 uppercase font-bold tracking-wider mt-1">
              Sala &amp; Servicio
            </span>
          </div>
        </div>

        <nav className="px-3 pt-4 flex flex-col gap-1.5">
          {visibles.map((item) => (
            <NavLink
              key={item.ruta}
              to={item.ruta}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-500 text-white font-bold shadow-md shadow-brand-500/25'
                    : 'text-slate-600 font-medium hover:bg-amber-50 hover:text-brand-800'
                }`
              }
            >
              <Icon name={item.icono} className="text-xl" />
              <span>{item.etiqueta}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {usuario && (
        <div className="p-3 m-3 rounded-2xl bg-amber-50/70 border border-amber-200/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-100 border-2 border-brand-400 flex items-center justify-center text-brand-800 font-bold text-sm shrink-0">
            {iniciales(usuario.nombre)}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-bold text-xs text-slate-900 truncate">{usuario.nombre}</span>
            <span className="text-[11px] text-brand-800 font-semibold truncate">
              {NOMBRE_ROL[usuario.rol]}
            </span>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Cerrar sesión"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-white text-rose-600 hover:bg-rose-50 border border-amber-200/70 transition-colors shrink-0"
          >
            <Icon name="logout" className="text-base" />
          </button>
        </div>
      )}
    </aside>
  )
}
