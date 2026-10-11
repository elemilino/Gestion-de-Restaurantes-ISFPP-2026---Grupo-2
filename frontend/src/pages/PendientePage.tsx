import { useLocation } from 'react-router'

import { Icon } from '../components/Icon'
import { navItemDeRuta } from '../layout/navItems'

/**
 * Lugar reservado para una sección que todavía no se implementó.
 * Muestra qué HU la completan y quién es responsable (datos de navItems.ts).
 * Cada HU reemplaza esta página por la suya en App.tsx.
 */
export function PendientePage() {
  const item = navItemDeRuta(useLocation().pathname)

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-borde p-10 max-w-md w-full flex flex-col items-center gap-3 text-center shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
          <Icon name={item?.icono ?? 'construction'} className="text-3xl" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">{item?.etiqueta ?? 'Sección'}</h1>
        <p className="text-sm text-slate-500">Esta sección todavía no está implementada.</p>
        {item && (
          <dl className="text-xs text-slate-700 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-left">
            <dt className="font-bold text-slate-500">HU</dt>
            <dd>{item.hu}</dd>
            <dt className="font-bold text-slate-500">Responsable</dt>
            <dd>{item.responsable}</dd>
          </dl>
        )}
      </div>
    </div>
  )
}
