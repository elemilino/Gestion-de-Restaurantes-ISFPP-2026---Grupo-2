import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '../../api/client'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { FilterChip } from '../../components/FilterChip'
import { Icon } from '../../components/Icon'
import { StatusBadge } from '../../components/StatusBadge'
import type { Tono } from '../../components/tonos'
import { cambiarEstadoPromocion, listarPromociones } from './api'
import { PromocionForm } from './PromocionForm'
import type { EstadoPromocion, FiltroPromocion, Promocion } from './types'
import { estadoPromocion, formatearFecha } from './validaciones'

function mensajeDe(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'PROMOCION_YA_VENCIDA') {
      return 'No se puede activar una promoción vencida.'
    }
    if (e.code === 'PROMOCION_SUPERPUESTA') {
      return 'Ya existe una promoción activa para uno de esos productos en ese período.'
    }
    return e.message
  }
  return 'Ocurrió un error inesperado'
}

interface Filtro {
  valor: FiltroPromocion
  etiqueta: string
  estado?: EstadoPromocion
}

const FILTROS: Filtro[] = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'vigentes', etiqueta: 'Vigentes', estado: 'vigente' },
  { valor: 'programadas', etiqueta: 'Programadas', estado: 'programada' },
  { valor: 'vencidas', etiqueta: 'Vencidas', estado: 'vencida' },
  { valor: 'inactivas', etiqueta: 'Inactivas', estado: 'inactiva' },
]

const TONO_ESTADO: Record<EstadoPromocion, Tono> = {
  vigente: 'libre',
  programada: 'reservado',
  vencida: 'pendiente',
  inactiva: 'inactivo',
}

const ETIQUETA_ESTADO: Record<EstadoPromocion, string> = {
  vigente: 'Vigente',
  programada: 'Programada',
  vencida: 'Vencida',
  inactiva: 'Inactiva',
}

/** Formulario abierto: `null` cerrado, `'nuevo'` alta, o la promoción a editar. */
type EstadoForm = null | 'nuevo' | Promocion

/** HU-09a: gestión de promociones de la carta (solo Administrador). */
export function PromocionesPage() {
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroPromocion>('todas')
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const [form, setForm] = useState<EstadoForm>(null)

  const [cambiando, setCambiando] = useState<number | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  async function recargar() {
    try {
      setPromociones(await listarPromociones())
      setErrorCarga(null)
    } catch (e) {
      setErrorCarga(mensajeDe(e))
    }
  }

  useEffect(() => {
    let montado = true
    listarPromociones()
      .then((lista) => montado && setPromociones(lista))
      .catch((e) => montado && setErrorCarga(mensajeDe(e)))
      .finally(() => montado && setCargando(false))
    return () => {
      montado = false
    }
  }, [])

  useEffect(() => {
    if (!mensajeExito) return
    const id = window.setTimeout(() => setMensajeExito(null), 4000)
    return () => window.clearTimeout(id)
  }, [mensajeExito])

  const cerrarForm = useCallback(() => setForm(null), [])

  async function alGuardar(guardada: Promocion) {
    const esAlta = form === 'nuevo'
    setForm(null)
    setMensajeExito(
      esAlta
        ? `Promoción "${guardada.descripcion}" registrada correctamente`
        : `Promoción "${guardada.descripcion}" modificada correctamente`,
    )
    await recargar()
  }

  async function alternarActiva(promocion: Promocion) {
    setErrorAccion(null)
    setCambiando(promocion.id)
    try {
      const actualizada = await cambiarEstadoPromocion(promocion.id, !promocion.activo)
      setPromociones((lista) => lista.map((p) => (p.id === actualizada.id ? actualizada : p)))
      setMensajeExito(
        actualizada.activo
          ? `Promoción "${actualizada.descripcion}" activada`
          : `Promoción "${actualizada.descripcion}" desactivada`,
      )
    } catch (e) {
      setErrorAccion(mensajeDe(e))
    } finally {
      setCambiando(null)
    }
  }

  const estadoDelFiltro = FILTROS.find((f) => f.valor === filtro)?.estado
  const visibles = estadoDelFiltro
    ? promociones.filter((p) => estadoPromocion(p) === estadoDelFiltro)
    : promociones

  function cantidad(f: Filtro): number {
    return f.estado
      ? promociones.filter((p) => estadoPromocion(p) === f.estado).length
      : promociones.length
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl p-6 border border-borde shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700">
                <Icon name="local_offer" className="text-xl" />
              </span>
              <h1 className="text-xl font-bold text-slate-900">Gestión de Promociones</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Promociones de la carta: registro, vigencia, modificación y baja (HU-09a).
            </p>
          </div>

          <Button icono="add_circle" onClick={() => setForm('nuevo')} disabled={cargando}>
            Nueva promoción
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTROS.map((f) => (
            <FilterChip
              key={f.valor}
              etiqueta={f.etiqueta}
              cantidad={cantidad(f)}
              tono={f.estado ? TONO_ESTADO[f.estado] : undefined}
              activo={filtro === f.valor}
              onClick={() => setFiltro(f.valor)}
            />
          ))}
        </div>

        {mensajeExito && <Alert tono="exito">{mensajeExito}</Alert>}
        {errorCarga && <Alert tono="error">{errorCarga}</Alert>}
        {errorAccion && <Alert tono="error">{errorAccion}</Alert>}
      </div>

      <div className="bg-white rounded-2xl border border-borde shadow-xs overflow-hidden">
        {cargando ? (
          <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <Icon name="progress_activity" className="text-2xl animate-spin text-brand-600" />
            <span>Cargando promociones…</span>
          </div>
        ) : visibles.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <Icon name="local_offer" className="text-3xl text-slate-300" />
            <span>
              {promociones.length === 0
                ? 'Todavía no hay promociones registradas'
                : 'No hay promociones con este filtro'}
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-amber-50/50 border-b border-borde text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Descripción</th>
                  <th className="py-3.5 px-4 text-right">Descuento</th>
                  <th className="py-3.5 px-4">Vigencia</th>
                  <th className="py-3.5 px-4">Productos</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {visibles.map((promocion) => {
                  const estado = estadoPromocion(promocion)
                  const nombres = promocion.productos.map((p) => p.nombre)
                  const resumen =
                    nombres.length <= 2
                      ? nombres.join(', ')
                      : `${nombres.slice(0, 2).join(', ')} +${nombres.length - 2}`

                  return (
                    <tr key={promocion.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {promocion.descripcion}
                      </td>
                      <td className="py-3 px-4 text-right tabular font-semibold text-slate-900">
                        {Number(promocion.descuento).toLocaleString('es-AR', {
                          maximumFractionDigits: 2,
                        })}
                        %
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="block">Del {formatearFecha(promocion.fecha_inicio)}</span>
                        <span className="block text-slate-400">
                          al {formatearFecha(promocion.fecha_fin)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="block max-w-[16rem] truncate" title={nombres.join(', ')}>
                          {resumen}
                        </span>
                        <span className="block text-slate-400">
                          {nombres.length} {nombres.length === 1 ? 'producto' : 'productos'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge tono={TONO_ESTADO[estado]}>
                          {ETIQUETA_ESTADO[estado]}
                        </StatusBadge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={promocion.activo}
                            aria-label={`${promocion.descripcion} activa`}
                            title={
                              estado === 'vencida'
                                ? 'No se puede activar una promoción vencida'
                                : promocion.activo
                                  ? 'Desactivar promoción'
                                  : 'Activar promoción'
                            }
                            disabled={estado === 'vencida' || cambiando === promocion.id}
                            onClick={() => alternarActiva(promocion)}
                            className={`relative w-10 h-6 rounded-full transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                              promocion.activo ? 'bg-status-free' : 'bg-stone-300'
                            }`}
                          >
                            <span
                              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                promocion.activo ? 'translate-x-4' : ''
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => setForm(promocion)}
                            aria-label={`Editar ${promocion.descripcion}`}
                            title="Editar promoción"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-brand-700 hover:bg-amber-100/70 transition-colors"
                          >
                            <Icon name="edit" className="text-base" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form !== null && (
        <PromocionForm
          promocion={form === 'nuevo' ? null : form}
          onCerrar={cerrarForm}
          onGuardado={alGuardar}
        />
      )}
    </div>
  )
}
