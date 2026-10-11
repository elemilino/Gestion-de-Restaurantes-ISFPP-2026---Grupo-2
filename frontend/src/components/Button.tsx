import type { ButtonHTMLAttributes } from 'react'

import { Icon } from './Icon'

type Variante = 'primario' | 'secundario' | 'reserva'

const ESTILOS: Record<Variante, string> = {
  primario: 'bg-brand-600 hover:bg-brand-700 text-white shadow-xs',
  secundario:
    'bg-brand-50 hover:bg-brand-600 hover:text-white text-brand-900 border border-brand-200/80 hover:border-transparent',
  reserva: 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  icono?: string
}

/** Botón con los estilos de Stitch. Por defecto es `type="button"`. */
export function Button({
  variante = 'primario',
  icono,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`h-9 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:pointer-events-none ${ESTILOS[variante]} ${className}`}
      {...props}
    >
      {icono && <Icon name={icono} className="text-base" />}
      {children}
    </button>
  )
}
