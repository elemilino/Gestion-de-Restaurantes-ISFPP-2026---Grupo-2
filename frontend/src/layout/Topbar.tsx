import { useAuth } from '../auth/useAuth'
import { NOMBRE_ROL } from '../lib/roles'

export function Topbar() {
  const { usuario } = useAuth()

  return (
    <header className="sticky top-0 h-16 bg-white/95 backdrop-blur-md border-b border-amber-100/80 z-40 px-6 flex items-center justify-end shadow-xs">
      {usuario && (
        <span className="text-xs font-bold text-slate-800">
          {NOMBRE_ROL[usuario.rol]} - {usuario.nombre}
        </span>
      )}
    </header>
  )
}
