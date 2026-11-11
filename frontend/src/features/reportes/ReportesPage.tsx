import { useState } from 'react'

import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { FilterChip } from '../../components/FilterChip'
import { Icon } from '../../components/Icon'
import type { FiltroPeriodo, Periodo } from './types'
import {
  CobrosReporte,
  MozosReporte,
  OcupacionReporte,
  ProductosReporte,
  ReservasReporte,
  VentasReporte,
} from './vistas'

const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: 'HOY', etiqueta: 'Hoy' },
  { valor: 'SEMANA', etiqueta: 'Semana actual' },
  { valor: 'MES', etiqueta: 'Mes actual' },
  { valor: 'PERSONALIZADO', etiqueta: 'Personalizado' },
]

const REPORTES = [
  { id: 'ventas', etiqueta: 'Ventas', icono: 'payments', Vista: VentasReporte },
  { id: 'productos', etiqueta: 'Más vendidos', icono: 'trending_up', Vista: ProductosReporte },
  { id: 'mozos', etiqueta: 'Mozos', icono: 'badge', Vista: MozosReporte },
  { id: 'ocupacion', etiqueta: 'Ocupación', icono: 'table_restaurant', Vista: OcupacionReporte },
  { id: 'reservas', etiqueta: 'Reservas', icono: 'event_seat', Vista: ReservasReporte },
  { id: 'cobros', etiqueta: 'Cobros', icono: 'point_of_sale', Vista: CobrosReporte },
] as const

type IdReporte = (typeof REPORTES)[number]['id']

function hoyIso(): string {
  const hoy = new Date()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia = String(hoy.getDate()).padStart(2, '0')
  return `${hoy.getFullYear()}-${mes}-${dia}`
}

/** HU-12a a HU-12f: los 6 reportes del encargado general (y del administrador). */
export function ReportesPage() {
  const [filtro, setFiltro] = useState<FiltroPeriodo>({ periodo: 'MES' })
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [personalizado, setPersonalizado] = useState(false)
  const [reporte, setReporte] = useState<IdReporte>('ventas')

  const elegido = personalizado ? 'PERSONALIZADO' : filtro.periodo
  const actual = REPORTES.find((r) => r.id === reporte)!

  function elegirPeriodo(periodo: Periodo) {
    if (periodo === 'PERSONALIZADO') {
      setPersonalizado(true)
      return
    }
    setPersonalizado(false)
    setFiltro({ periodo })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl p-5 border border-borde shadow-xs flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700">
                <Icon name="query_stats" className="text-xl" />
              </span>
              <h1 className="text-xl font-bold text-slate-900">Reportes</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Ventas, productos, mozos, ocupación, reservas y cobros (HU-12a a HU-12f).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período">
            {PERIODOS.map((p) => (
              <FilterChip
                key={p.valor}
                etiqueta={p.etiqueta}
                activo={elegido === p.valor}
                onClick={() => elegirPeriodo(p.valor)}
              />
            ))}
          </div>
        </div>
        {personalizado && (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              setFiltro({ periodo: 'PERSONALIZADO', desde, hasta })
            }}
          >
            <Field label="Desde" htmlFor="periodo-desde">
              <input
                id="periodo-desde"
                type="date"
                max={hoyIso()}
                className={CLASE_INPUT.replace('h-12', 'h-9')}
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                required
              />
            </Field>
            <Field label="Hasta" htmlFor="periodo-hasta">
              <input
                id="periodo-hasta"
                type="date"
                max={hoyIso()}
                className={CLASE_INPUT.replace('h-12', 'h-9')}
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" icono="filter_alt">
              Aplicar período
            </Button>
          </form>
        )}
        <nav className="flex flex-wrap gap-1.5 border-t border-borde pt-3" aria-label="Reportes">
          {REPORTES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={reporte === r.id}
              onClick={() => setReporte(r.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                reporte === r.id
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-amber-50 hover:text-brand-800'
              }`}
            >
              <Icon name={r.icono} className="text-base" />
              {r.etiqueta}
            </button>
          ))}
        </nav>
      </div>
      <actual.Vista filtro={filtro} />
    </div>
  )
}
