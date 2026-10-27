import type { ReactNode } from 'react'

/** Clases comunes para inputs, selects y textareas de los formularios. */
export const CLASE_INPUT =
  'w-full h-12 px-3 bg-white border border-borde rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent disabled:opacity-60 aria-[invalid=true]:border-status-busy'

interface FieldProps {
  label: string
  /** id del input, para asociarlo con el label. */
  htmlFor?: string
  /** Mensaje de error (en rojo, debajo del campo). */
  error?: string
  /** Texto de ayuda (en gris, debajo del campo si no hay error). */
  ayuda?: string
  children: ReactNode
}

/** Campo de formulario: label, input (children) y mensaje de error o ayuda. */
export function Field({ label, htmlFor, error, ayuda, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-bold text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-status-busy-text">{error}</p>
      ) : (
        ayuda && <p className="text-xs text-slate-500">{ayuda}</p>
      )}
    </div>
  )
}
