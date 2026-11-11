import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../../auth/useAuth'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { StatusBadge } from '../../components/StatusBadge'
import { mensajeDe } from '../../lib/errores'
import { formatMoneda } from '../../lib/format'
import { Rol } from '../../lib/roles'
import { verCarta } from '../carta/api'
import type { SeccionCarta } from '../carta/types'
import { listarMozos } from '../mozos/api'
import type { Mozo } from '../mozos/types'
import {
  agregarProducto,
  anularComanda,
  cambiarCantidad,
  cerrarComanda,
  eliminarComanda,
  entregarProducto,
  modificarComanda,
  obtenerComanda,
  quitarProducto,
  reabrirComanda,
} from './api'
import { ESTADOS_COMANDA, fechaHora, totalComanda } from './estados'
import type { Comanda } from './types'

const INPUT = CLASE_INPUT.replace('h-12', 'h-9')

interface Props {
  comandaId: number | null
  onCerrar: () => void
  /** Se llama después de cada cambio, para refrescar el tablero o el listado. */
  onCambio?: () => void
}

/**
 * Detalle y operación de una comanda: productos (HU-05b), entrega (HU-06),
 * cierre (HU-05c), reapertura (HU-05d, administrador), eliminación (HU-05e) y
 * anulación con motivo (HU-06 CA3).
 */
export function ComandaPanel({ comandaId, onCerrar, onCambio }: Props) {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === Rol.ADMINISTRADOR
  const [comanda, setComanda] = useState<Comanda | null>(null)
  const [carta, setCarta] = useState<SeccionCarta[]>([])
  const [mozos, setMozos] = useState<Mozo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [comensales, setComensales] = useState('')
  const [anulando, setAnulando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [confirmarBaja, setConfirmarBaja] = useState(false)

  useEffect(() => {
    if (comandaId === null) return
    let vigente = true
    obtenerComanda(comandaId)
      .then((c) => {
        if (!vigente) return
        setComanda(c)
        setComensales(String(c.cantidad_comensales))
      })
      .catch((e) => vigente && setError(mensajeDe(e)))
    verCarta()
      .then((c) => vigente && setCarta(c.secciones))
      .catch(() => vigente && setCarta([]))
    if (esAdmin) {
      listarMozos()
        .then((m) => vigente && setMozos(m.filter((x) => x.activo)))
        .catch(() => vigente && setMozos([]))
    }
    return () => {
      vigente = false
    }
  }, [comandaId, esAdmin])

  const cerrar = useCallback(() => {
    setComanda(null)
    setError(null)
    setAviso(null)
    setAnulando(false)
    setConfirmarBaja(false)
    onCerrar()
  }, [onCerrar])

  async function ejecutar(accion: () => Promise<Comanda | void>, exito?: string) {
    setOcupado(true)
    setError(null)
    setAviso(null)
    try {
      const resultado = await accion()
      if (resultado) {
        setComanda(resultado)
        setComensales(String(resultado.cantidad_comensales))
      }
      if (exito) setAviso(exito)
      onCambio?.()
      return true
    } catch (e) {
      setError(mensajeDe(e))
      return false
    } finally {
      setOcupado(false)
    }
  }

  if (comandaId === null) return null
  const abierta = comanda?.estado === 'ABIERTA'
  const estado = comanda ? ESTADOS_COMANDA[comanda.estado] : null
  const productos = carta.flatMap((s) => s.productos.map((p) => ({ ...p, seccion: s.nombre })))

  return (
    <Modal abierto onCerrar={cerrar} titulo={`Comanda #${comandaId}`} ancho="max-w-3xl">
      {!comanda ? (
        error ? (
          <Alert tono="error">{error}</Alert>
        ) : (
          <p className="text-sm text-slate-500">Cargando comanda…</p>
        )
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
            {estado && <StatusBadge tono={estado.tono}>{estado.etiqueta}</StatusBadge>}
            <span>
              <strong className="text-slate-900">Mesas:</strong>{' '}
              {comanda.mesas.map((m) => m.numero).join(', ')}
            </span>
            <span>
              <strong className="text-slate-900">Mozo:</strong> {comanda.mozo.nombre}{' '}
              {comanda.mozo.apellido}
            </span>
            <span>
              <strong className="text-slate-900">Apertura:</strong>{' '}
              {fechaHora(comanda.fecha_hora_apertura)}
            </span>
            {comanda.fecha_hora_cierre && (
              <span>
                <strong className="text-slate-900">Cierre:</strong>{' '}
                {fechaHora(comanda.fecha_hora_cierre)}
              </span>
            )}
            {comanda.reserva_id && <span>Reserva #{comanda.reserva_id}</span>}
          </div>
          {comanda.motivo_anulacion && (
            <Alert tono="info">Anulada: {comanda.motivo_anulacion}</Alert>
          )}
          {error && <Alert tono="error">{error}</Alert>}
          {aviso && <Alert tono="exito">{aviso}</Alert>}

          <div className="overflow-x-auto border border-borde rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-amber-50/50 border-b border-borde text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3">Producto</th>
                  <th className="py-2.5 px-3">Cantidad</th>
                  <th className="py-2.5 px-3 text-right">Precio</th>
                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                  <th className="py-2.5 px-3">Entrega</th>
                  {abierta && <th className="py-2.5 px-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {comanda.detalles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Todavía no hay productos cargados
                    </td>
                  </tr>
                )}
                {comanda.detalles.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2 px-3 font-semibold text-slate-800">{d.producto.nombre}</td>
                    <td className="py-2 px-3">
                      {abierta ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Restar una unidad de ${d.producto.nombre}`}
                            disabled={ocupado || d.cantidad <= 1}
                            onClick={() =>
                              ejecutar(() => cambiarCantidad(comanda.id, d.id, d.cantidad - 1))
                            }
                            className="w-6 h-6 rounded-lg border border-borde hover:bg-amber-50 disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="w-6 text-center tabular font-bold">{d.cantidad}</span>
                          <button
                            type="button"
                            aria-label={`Sumar una unidad de ${d.producto.nombre}`}
                            disabled={ocupado}
                            onClick={() =>
                              ejecutar(() => cambiarCantidad(comanda.id, d.id, d.cantidad + 1))
                            }
                            className="w-6 h-6 rounded-lg border border-borde hover:bg-amber-50 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="tabular">{d.cantidad}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular">
                      {formatMoneda(d.precio_unitario)}
                    </td>
                    <td className="py-2 px-3 text-right tabular font-semibold">
                      {formatMoneda(d.cantidad * Number(d.precio_unitario))}
                    </td>
                    <td className="py-2 px-3">
                      {d.entregado ? (
                        <span className="text-status-free-text font-bold flex items-center gap-1">
                          <Icon name="check_circle" className="text-sm" /> Entregado
                        </span>
                      ) : abierta ? (
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => ejecutar(() => entregarProducto(comanda.id, d.id))}
                          className="px-2 py-1 rounded-lg bg-status-free-bg text-status-free-text font-bold hover:brightness-95"
                        >
                          Marcar entregado
                        </button>
                      ) : (
                        <span className="text-slate-500">Pendiente</span>
                      )}
                    </td>
                    {abierta && (
                      <td className="py-2 px-3 text-right">
                        {!d.entregado && (
                          <button
                            type="button"
                            aria-label={`Quitar ${d.producto.nombre}`}
                            disabled={ocupado}
                            onClick={() => ejecutar(() => quitarProducto(comanda.id, d.id))}
                            className="text-slate-400 hover:text-status-busy-text"
                          >
                            <Icon name="delete" className="text-base" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-borde">
                  <td colSpan={3} className="py-2.5 px-3 text-right font-bold text-slate-600">
                    Total
                  </td>
                  <td className="py-2.5 px-3 text-right text-base font-extrabold text-slate-900 tabular">
                    {formatMoneda(totalComanda(comanda))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {abierta && (
            <form
              className="grid grid-cols-1 sm:grid-cols-[1fr_6rem_auto] gap-3 items-end"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!productoId) return
                const ok = await ejecutar(() =>
                  agregarProducto(comanda.id, Number(productoId), Number(cantidad)),
                )
                if (ok) {
                  setProductoId('')
                  setCantidad('1')
                }
              }}
            >
              <Field label="Producto de la carta" htmlFor="comanda-producto">
                <select
                  id="comanda-producto"
                  className={INPUT}
                  value={productoId}
                  onChange={(e) => setProductoId(e.target.value)}
                >
                  <option value="">Elegí un producto…</option>
                  {carta.map((s) => (
                    <optgroup key={s.id} label={s.nombre}>
                      {s.productos.map((p) => (
                        <option key={p.id} value={p.id} disabled={!p.disponible}>
                          {p.nombre} · {formatMoneda(p.precio)}
                          {!p.disponible ? ' (no disponible)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Cantidad" htmlFor="comanda-cantidad">
                <input
                  id="comanda-cantidad"
                  type="number"
                  min={1}
                  className={INPUT}
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                />
              </Field>
              <Button
                type="submit"
                icono="add"
                disabled={ocupado || !productoId || productos.length === 0}
              >
                Agregar
              </Button>
            </form>
          )}

          {abierta && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  ejecutar(
                    () => modificarComanda(comanda.id, { cantidad_comensales: Number(comensales) }),
                    'Comensales actualizados',
                  )
                }}
              >
                <Field label="Comensales" htmlFor="comanda-comensales">
                  <input
                    id="comanda-comensales"
                    type="number"
                    min={1}
                    className={INPUT}
                    value={comensales}
                    onChange={(e) => setComensales(e.target.value)}
                  />
                </Field>
                <Button type="submit" variante="secundario" disabled={ocupado}>
                  Guardar
                </Button>
              </form>
              {esAdmin && mozos.length > 0 && (
                <Field label="Cambiar mozo" htmlFor="comanda-mozo">
                  <select
                    id="comanda-mozo"
                    className={INPUT}
                    value={comanda.mozo.dni}
                    onChange={(e) =>
                      ejecutar(
                        () => modificarComanda(comanda.id, { dni_mozo: e.target.value }),
                        'Mozo actualizado',
                      )
                    }
                  >
                    {mozos.map((m) => (
                      <option key={m.id} value={m.dni}>
                        {m.nombre} {m.apellido} ({m.sector_nombre ?? 'sin sector'})
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          )}

          {anulando && (
            <form
              className="flex flex-col gap-3 p-4 rounded-xl border border-status-busy-border bg-status-busy-bg/50"
              onSubmit={async (e) => {
                e.preventDefault()
                const ok = await ejecutar(
                  () => anularComanda(comanda.id, motivo),
                  'Comanda anulada',
                )
                if (ok) setAnulando(false)
              }}
            >
              <Field label="Motivo de la anulación" htmlFor="comanda-motivo">
                <input
                  id="comanda-motivo"
                  className={INPUT}
                  placeholder="Ej.: el cliente se retiró sin pedir"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </Field>
              <div className="flex gap-2 justify-end">
                <Button variante="secundario" onClick={() => setAnulando(false)}>
                  Volver
                </Button>
                <Button type="submit" disabled={ocupado || motivo.trim().length < 3}>
                  Confirmar anulación
                </Button>
              </div>
            </form>
          )}

          {confirmarBaja && (
            <Alert tono="error">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>La comanda se elimina del sistema. ¿Confirmás?</span>
                <div className="flex gap-2">
                  <Button variante="secundario" onClick={() => setConfirmarBaja(false)}>
                    No
                  </Button>
                  <Button
                    onClick={async () => {
                      const ok = await ejecutar(() => eliminarComanda(comanda.id))
                      if (ok) cerrar()
                    }}
                  >
                    Sí, eliminar
                  </Button>
                </div>
              </div>
            </Alert>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-borde pt-4">
            {abierta && (
              <>
                <Button
                  variante="secundario"
                  icono="delete"
                  disabled={ocupado}
                  onClick={() => setConfirmarBaja(true)}
                >
                  Eliminar
                </Button>
                <Button
                  variante="secundario"
                  icono="block"
                  disabled={ocupado}
                  onClick={() => setAnulando(true)}
                >
                  Anular
                </Button>
                <Button
                  icono="lock"
                  disabled={ocupado}
                  onClick={() =>
                    ejecutar(
                      () => cerrarComanda(comanda.id),
                      'Comanda cerrada: lista para facturar',
                    )
                  }
                >
                  Cerrar comanda
                </Button>
              </>
            )}
            {comanda.estado === 'CERRADA' && esAdmin && (
              <Button
                variante="secundario"
                icono="lock_open"
                disabled={ocupado}
                onClick={() => ejecutar(() => reabrirComanda(comanda.id), 'Comanda reabierta')}
              >
                Reabrir
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
