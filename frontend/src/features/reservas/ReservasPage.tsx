import { useCallback, useEffect, useState } from 'react'

import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { StatusBadge } from '../../components/StatusBadge'
import type { Tono } from '../../components/tonos'
import { mensajeDe } from '../../lib/errores'
import { formatMoneda } from '../../lib/format'
import { cancelarReserva, listarReservas, registrarAusencia, registrarLlegada } from './api'
import { ReservaForm } from './ReservaForm'
import type { EstadoReserva, FiltrosReservas, Reserva } from './types'

const INPUT = CLASE_INPUT.replace('h-12', 'h-9')

const ESTADOS: Record<EstadoReserva, { etiqueta: string; tono: Tono }> = {
  ACTIVA: { etiqueta: 'Activa', tono: 'reservado' },
  CUMPLIDA: { etiqueta: 'Cumplida', tono: 'libre' },
  CANCELADA: { etiqueta: 'Cancelada', tono: 'inactivo' },
  AUSENTE: { etiqueta: 'Ausente', tono: 'ocupado' },
}

function fechaLarga(iso: string): string {
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

type EstadoForm = null | 'nueva' | Reserva

/** HU-11a (registro) y HU-11b (atención): reservas del restaurante. */
export function ReservasPage() {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [filtros, setFiltros] = useState<FiltrosReservas>({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [form, setForm] = useState<EstadoForm>(null)

  const recargar = useCallback(async (f: FiltrosReservas) => {
    try {
      setReservas(await listarReservas(f))
      setError(null)
    } catch (e) {
      setError(mensajeDe(e))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    let vigente = true
    listarReservas({})
      .then((r) => vigente && setReservas(r))
      .catch((e) => vigente && setError(mensajeDe(e)))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [])

  const cerrarForm = useCallback(() => setForm(null), [])

  function filtrar(cambio: Partial<FiltrosReservas>) {
    const nuevos = { ...filtros, ...cambio }
    setFiltros(nuevos)
    recargar(nuevos)
  }

  async function accion(hacer: () => Promise<Reserva>, exito: string) {
    setError(null)
    setAviso(null)
    try {
      await hacer()
      setAviso(exito)
      await recargar(filtros)
    } catch (e) {
      setError(mensajeDe(e))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl p-5 border border-borde shadow-xs flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700">
              <Icon name="event_seat" className="text-xl" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Reservas</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Registro con seña y menú acordado (HU-11a) y atención de reservas (HU-11b).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Fecha" htmlFor="reservas-fecha">
            <input
              id="reservas-fecha"
              type="date"
              className={INPUT}
              value={filtros.fecha ?? ''}
              onChange={(e) => filtrar({ fecha: e.target.value || undefined })}
            />
          </Field>
          <Field label="Estado" htmlFor="reservas-estado">
            <select
              id="reservas-estado"
              className={INPUT}
              value={filtros.estado ?? ''}
              onChange={(e) =>
                filtrar({ estado: (e.target.value || undefined) as EstadoReserva | undefined })
              }
            >
              <option value="">Todos</option>
              {Object.entries(ESTADOS).map(([valor, { etiqueta }]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </Field>
          <Button icono="add" onClick={() => setForm('nueva')}>
            Nueva reserva
          </Button>
        </div>
      </div>

      {error && <Alert tono="error">{error}</Alert>}
      {aviso && <Alert tono="exito">{aviso}</Alert>}

      <div className="bg-white rounded-2xl border border-borde shadow-xs overflow-hidden">
        {cargando ? (
          <p className="p-10 text-center text-sm text-slate-400">Cargando reservas…</p>
        ) : reservas.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">
            El listado de reservas está vacío
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-amber-50/50 border-b border-borde text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Fecha y hora</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Comensales</th>
                  <th className="py-3 px-4">Mesas</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Seña</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {reservas.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 px-4 font-bold tabular">{r.nro_reserva}</td>
                    <td className="py-2.5 px-4 tabular">
                      {fechaLarga(r.fecha)} {r.hora.slice(0, 5)}
                    </td>
                    <td className="py-2.5 px-4">
                      {r.cliente ? `${r.cliente.apellido}, ${r.cliente.nombre}` : '—'}
                      {r.menu_acordado.length > 0 && (
                        <span className="ml-1.5 text-[10px] font-bold text-brand-700">
                          Menú acordado
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 tabular">{r.cantidad_comensales}</td>
                    <td className="py-2.5 px-4">{r.mesas.map((m) => m.numero).join(', ')}</td>
                    <td className="py-2.5 px-4">
                      <StatusBadge tono={ESTADOS[r.estado].tono}>
                        {ESTADOS[r.estado].etiqueta}
                      </StatusBadge>
                    </td>
                    <td className="py-2.5 px-4 text-right tabular">
                      {r.sena ? formatMoneda(r.sena.monto) : '—'}
                      {r.sena?.devuelta && (
                        <span className="block text-[10px] text-slate-400">Devuelta</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {r.estado === 'ACTIVA' && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            variante="reserva"
                            onClick={() =>
                              accion(
                                () => registrarLlegada(r.id),
                                `Llegada registrada: reserva #${r.id} cumplida`,
                              )
                            }
                          >
                            Llegó
                          </Button>
                          <Button
                            variante="secundario"
                            onClick={() =>
                              accion(
                                () => registrarAusencia(r.id),
                                `Reserva #${r.id} marcada como ausente`,
                              )
                            }
                          >
                            Ausente
                          </Button>
                          <Button variante="secundario" onClick={() => setForm(r)}>
                            Editar
                          </Button>
                          <Button
                            variante="secundario"
                            onClick={() =>
                              accion(
                                () => cancelarReserva(r.id),
                                `Reserva #${r.id} cancelada: la seña se devuelve`,
                              )
                            }
                          >
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form !== null && (
        <ReservaForm
          reserva={form === 'nueva' ? null : form}
          onCerrar={cerrarForm}
          onGuardada={async (r) => {
            setForm(null)
            setAviso(form === 'nueva' ? `Reserva #${r.id} creada` : `Reserva #${r.id} modificada`)
            await recargar(filtros)
          }}
        />
      )}
    </div>
  )
}
