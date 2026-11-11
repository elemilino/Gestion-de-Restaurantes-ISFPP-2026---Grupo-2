import type { ReactNode } from 'react'

import { Alert } from '../../components/Alert'
import { Icon } from '../../components/Icon'
import { fechaLarga } from './formato'

/** Tarjeta blanca de un reporte: título, período y contenido. */
export function Tarjeta({
  titulo,
  hu,
  periodo,
  acciones,
  children,
}: {
  titulo: string
  hu: string
  periodo?: { desde: string; hasta: string }
  acciones?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="bg-white rounded-2xl p-5 border border-borde shadow-xs flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {hu}
            {periodo && (
              <>
                {' '}
                · Del {fechaLarga(periodo.desde)} al {fechaLarga(periodo.hasta)}
              </>
            )}
          </p>
        </div>
        {acciones && <div className="flex flex-wrap items-end gap-2">{acciones}</div>}
      </header>
      {children}
    </section>
  )
}

/** Cifra destacada (KPI) de un reporte. */
export function Cifra({
  etiqueta,
  valor,
  ayuda,
}: {
  etiqueta: string
  valor: string
  ayuda?: string
}) {
  return (
    <div className="rounded-xl border border-borde bg-canvas/60 px-4 py-3 flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {etiqueta}
      </span>
      <span className="text-xl font-extrabold text-slate-900 tabular">{valor}</span>
      {ayuda && <span className="text-[11px] text-slate-500">{ayuda}</span>}
    </div>
  )
}

/** Cargando, error o mensaje de "sin datos"; si no, el contenido. */
export function Estado({
  cargando,
  error,
  mensaje,
  children,
}: {
  cargando: boolean
  error: string | null
  mensaje?: string | null
  children: ReactNode
}) {
  if (cargando) {
    return (
      <div className="py-10 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
        <Icon name="progress_activity" className="text-2xl animate-spin text-brand-600" />
        <span>Generando el reporte…</span>
      </div>
    )
  }
  if (error) return <Alert tono="error">{error}</Alert>
  return (
    <>
      {mensaje && <Alert tono="info">{mensaje}</Alert>}
      {children}
    </>
  )
}

/** Marca para lo dado de baja que sigue apareciendo en los reportes. */
export function MarcaBaja({ texto = 'Dado de baja' }: { texto?: string }) {
  return (
    <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500 text-[10px] font-bold uppercase tracking-wide">
      {texto}
    </span>
  )
}
