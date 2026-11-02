import { useEffect, type ReactNode } from 'react'

import { Icon } from './Icon'

interface ModalProps {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  children: ReactNode
  ancho?: string
  /** Botones del pie (ej. Cancelar / Guardar). */
  acciones?: ReactNode
}

/** Diálogo centrado. Cierra con Escape o con la X. */
export function Modal({
  abierto,
  onCerrar,
  titulo,
  children,
  ancho = 'max-w-md',
  acciones,
}: ModalProps) {
  useEffect(() => {
    function manejarEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    if (abierto) {
      document.addEventListener('keydown', manejarEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', manejarEscape)
      document.body.style.overflow = ''
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`bg-white w-full ${ancho} rounded-2xl shadow-xl border border-amber-100 flex flex-col overflow-hidden max-h-[90vh]`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <header className="px-6 py-4 border-b border-amber-100/80 flex items-center justify-between bg-amber-50/40">
          <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-amber-100/50 transition-colors"
            title="Cerrar"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </header>
        <div className="p-6 overflow-y-auto">{children}</div>
        {acciones && (
          <footer className="px-6 py-4 border-t border-borde flex items-center justify-end gap-2">
            {acciones}
          </footer>
        )}
      </div>
    </div>
  )
}
