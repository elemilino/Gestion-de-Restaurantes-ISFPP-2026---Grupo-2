import { useCallback, useEffect, useState } from 'react'

import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { StatusBadge } from '../../components/StatusBadge'
import { mensajeDe } from '../../lib/errores'
import { formatMoneda } from '../../lib/format'
import { listarComandas } from './api'
import { ComandaPanel } from './ComandaPanel'
import { ESTADOS_COMANDA, fechaHora, totalComanda } from './estados'
import type { Comanda, FiltrosComandas } from './types'

const INPUT = CLASE_INPUT.replace('h-12', 'h-9')

/** HU-05f: listado de comandas filtrado por mozo, fechas de apertura y estado. */
export function HistorialPage() {
  const [comandas, setComandas] = useState<Comanda[]>([])
  const [filtros, setFiltros] = useState<FiltrosComandas>({})
  const [dni, setDni] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [estado, setEstado] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comandaId, setComandaId] = useState<number | null>(null)

  const buscar = useCallback(async (f: FiltrosComandas) => {
    setCargando(true)
    try {
      setComandas(await listarComandas(f))
      setError(null)
    } catch (e) {
      setComandas([])
      setError(mensajeDe(e))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    let vigente = true
    listarComandas({})
      .then((c) => vigente && setComandas(c))
      .catch((e) => vigente && setError(mensajeDe(e)))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [])

  const cerrarPanel = useCallback(() => setComandaId(null), [])

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl p-5 border border-borde shadow-xs flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700">
              <Icon name="receipt_long" className="text-xl" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Historial de comandas</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Comandas por mozo, fechas y estado (HU-05f).
          </p>
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            const nuevos: FiltrosComandas = {
              dni_mozo: dni.trim() || undefined,
              fecha_desde: desde || undefined,
              fecha_hasta: hasta || undefined,
              abierta: estado === '' ? undefined : estado === 'abiertas',
            }
            setFiltros(nuevos)
            buscar(nuevos)
          }}
        >
          <Field label="DNI del mozo" htmlFor="historial-dni">
            <input
              id="historial-dni"
              className={INPUT}
              inputMode="numeric"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
            />
          </Field>
          <Field label="Desde" htmlFor="historial-desde">
            <input
              id="historial-desde"
              type="date"
              className={INPUT}
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </Field>
          <Field label="Hasta" htmlFor="historial-hasta">
            <input
              id="historial-hasta"
              type="date"
              className={INPUT}
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </Field>
          <Field label="Estado" htmlFor="historial-estado">
            <select
              id="historial-estado"
              className={INPUT}
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="abiertas">Abiertas</option>
              <option value="cerradas">Cerradas, facturadas o anuladas</option>
            </select>
          </Field>
          <Button type="submit" icono="search">
            Buscar
          </Button>
        </form>
      </div>

      {error && <Alert tono="error">{error}</Alert>}

      <div className="bg-white rounded-2xl border border-borde shadow-xs overflow-hidden">
        {cargando ? (
          <p className="p-10 text-center text-sm text-slate-400">Cargando comandas…</p>
        ) : comandas.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">
            No hay comandas con esos filtros
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-amber-50/50 border-b border-borde text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Apertura</th>
                  <th className="py-3 px-4">Cierre</th>
                  <th className="py-3 px-4">Mesas</th>
                  <th className="py-3 px-4">Mozo</th>
                  <th className="py-3 px-4">Comensales</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {comandas.map((c) => (
                  <tr key={c.id} className="hover:bg-amber-50/30">
                    <td className="py-2.5 px-4 font-bold tabular">{c.id}</td>
                    <td className="py-2.5 px-4 tabular">{fechaHora(c.fecha_hora_apertura)}</td>
                    <td className="py-2.5 px-4 tabular">{fechaHora(c.fecha_hora_cierre)}</td>
                    <td className="py-2.5 px-4">{c.mesas.map((m) => m.numero).join(', ')}</td>
                    <td className="py-2.5 px-4">
                      {c.mozo.apellido}, {c.mozo.nombre}
                    </td>
                    <td className="py-2.5 px-4 tabular">{c.cantidad_comensales}</td>
                    <td className="py-2.5 px-4">
                      <StatusBadge tono={ESTADOS_COMANDA[c.estado].tono}>
                        {ESTADOS_COMANDA[c.estado].etiqueta}
                      </StatusBadge>
                    </td>
                    <td className="py-2.5 px-4 text-right tabular font-semibold">
                      {formatMoneda(totalComanda(c))}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Button variante="secundario" onClick={() => setComandaId(c.id)}>
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ComandaPanel comandaId={comandaId} onCerrar={cerrarPanel} onCambio={() => buscar(filtros)} />
    </div>
  )
}
