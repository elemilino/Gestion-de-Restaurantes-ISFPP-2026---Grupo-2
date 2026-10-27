import type { ReactNode } from 'react'

import { Icon } from './Icon'

type TonoAlert = 'error' | 'info' | 'exito'

const ESTILOS: Record<TonoAlert, { clases: string; icono: string }> = {
  error: {
    clases: 'bg-status-busy-bg border-status-busy-border text-status-busy-text',
    icono: 'error',
  },
  info: {
    clases: 'bg-status-reserved-bg border-status-reserved-border text-status-reserved-text',
    icono: 'info',
  },
  exito: {
    clases: 'bg-status-free-bg border-status-free-border text-status-free-text',
    icono: 'check_circle',
  },
}

/** Mensaje destacado: error (rojo), info (azul) o éxito (verde). */
export function Alert({ tono = 'info', children }: { tono?: TonoAlert; children: ReactNode }) {
  const estilo = ESTILOS[tono]
  return (
    <div
      role={tono === 'error' ? 'alert' : 'status'}
      className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2 ${estilo.clases}`}
    >
      <Icon name={estilo.icono} className="text-base shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  )
}
