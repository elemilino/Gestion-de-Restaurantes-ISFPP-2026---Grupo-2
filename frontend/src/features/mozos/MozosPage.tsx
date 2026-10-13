import { useEffect, useState } from 'react'

import { ApiError } from '../../api/client'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { StatusBadge } from '../../components/StatusBadge'
import {
  crearMozo,
  eliminarMozo,
  listarMozos,
  listarSectoresDisponibles,
  modificarMozo,
  reasignarComandas,
} from './api'
import type { Mozo, MozoCreate, MozoUpdate, SectorSimple } from './types'

export function MozosPage() {
  const [mozos, setMozos] = useState<Mozo[]>([])
  const [sectores, setSectores] = useState<SectorSimple[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  // Estado para Modal de Alta / Edición
  const [modalAbierto, setModalAbierto] = useState(false)
  const [mozoEditando, setMozoEditando] = useState<Mozo | null>(null)
  const [formNombre, setFormNombre] = useState('')
  const [formApellido, setFormApellido] = useState('')
  const [formDni, setFormDni] = useState('')
  const [formTelefono, setFormTelefono] = useState('')
  const [formSectorId, setFormSectorId] = useState<number | ''>('')
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Estado para Modal de Baja (CA3)
  const [modalBajaAbierto, setModalBajaAbierto] = useState(false)
  const [mozoAEliminar, setMozoAEliminar] = useState<Mozo | null>(null)
  const [errorBaja, setErrorBaja] = useState<string | null>(null)
  const [bloqueoComandas, setBloqueoComandas] = useState(false)
  const [mozoDestinoId, setMozoDestinoId] = useState<number | ''>('')
  const [eliminando, setEliminando] = useState(false)

  async function recargar() {
    setCargando(true)
    try {
      const [listaMozos, listaSectores] = await Promise.all([
        listarMozos(),
        listarSectoresDisponibles(),
      ])
      setMozos(listaMozos)
      setSectores(listaSectores)
    } catch (e) {
      console.error('Error cargando datos de mozos:', e)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    let montado = true
    Promise.all([listarMozos(), listarSectoresDisponibles()])
      .then(([listaMozos, listaSectores]) => {
        if (!montado) return
        setMozos(listaMozos)
        setSectores(listaSectores)
        setCargando(false)
      })
      .catch((e) => {
        if (!montado) return
        console.error('Error cargando datos de mozos:', e)
        setCargando(false)
      })
    return () => {
      montado = false
    }
  }, [])

  function mostrarNotificacion(mensaje: string) {
    setMensajeExito(mensaje)
    setTimeout(() => setMensajeExito(null), 4000)
  }

  function abrirModalNuevo() {
    setMozoEditando(null)
    setFormNombre('')
    setFormApellido('')
    setFormDni('')
    setFormTelefono('')
    setFormSectorId(sectores.length > 0 ? sectores[0].id : '')
    setFormUsername('')
    setFormPassword('')
    setFormError(null)
    setModalAbierto(true)
  }

  function abrirModalEditar(mozo: Mozo) {
    setMozoEditando(mozo)
    setFormNombre(mozo.nombre)
    setFormApellido(mozo.apellido)
    setFormDni(mozo.dni)
    setFormTelefono(mozo.telefono ?? '')
    setFormSectorId(mozo.sector_id ?? '')
    setFormUsername(mozo.username ?? '')
    setFormPassword('')
    setFormError(null)
    setModalAbierto(true)
  }

  async function guardarMozo(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setGuardando(true)

    try {
      if (mozoEditando) {
        // Modificación (CA1)
        const updateData: MozoUpdate = {
          nombre: formNombre.trim(),
          apellido: formApellido.trim(),
          telefono: formTelefono.trim() || null,
          sector_id: formSectorId === '' ? null : Number(formSectorId),
        }
        await modificarMozo(mozoEditando.id, updateData)
        mostrarNotificacion(`Mozo ${formNombre} modificado correctamente`)
      } else {
        // Alta (CA1)
        const createData: MozoCreate = {
          nombre: formNombre.trim(),
          apellido: formApellido.trim(),
          dni: formDni.trim(),
          telefono: formTelefono.trim() || null,
          sector_id: formSectorId === '' ? null : Number(formSectorId),
          username: formUsername.trim(),
          password: formPassword,
        }
        await crearMozo(createData)
        mostrarNotificacion(`Mozo ${formNombre} registrado correctamente`)
      }
      setModalAbierto(false)
      await recargar()
    } catch (e) {
      if (e instanceof ApiError) {
        setFormError(e.message)
      } else {
        setFormError('Ocurrió un error inesperado al guardar')
      }
    } finally {
      setGuardando(false)
    }
  }

  function abrirModalBaja(mozo: Mozo) {
    setMozoAEliminar(mozo)
    setErrorBaja(null)
    setBloqueoComandas(false)
    // Preseleccionar otro mozo como destino potencial
    const otros = mozos.filter((m) => m.id !== mozo.id && m.activo)
    setMozoDestinoId(otros.length > 0 ? otros[0].id : '')
    setModalBajaAbierto(true)
  }

  async function ejecutarBaja() {
    if (!mozoAEliminar) return
    setErrorBaja(null)
    setEliminando(true)

    try {
      await eliminarMozo(mozoAEliminar.id)
      mostrarNotificacion(`Mozo ${mozoAEliminar.nombre} dado de baja exitosamente`)
      setModalBajaAbierto(false)
      await recargar()
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'MOZO_CON_COMANDAS_ACTIVAS') {
          setBloqueoComandas(true)
        }
        setErrorBaja(e.message)
      } else {
        setErrorBaja('Ocurrió un error al intentar dar de baja al mozo')
      }
    } finally {
      setEliminando(false)
    }
  }

  async function reasignarYDarDeBaja() {
    if (!mozoAEliminar || mozoDestinoId === '') return
    setErrorBaja(null)
    setEliminando(true)

    try {
      await reasignarComandas(mozoAEliminar.id, Number(mozoDestinoId))
      await eliminarMozo(mozoAEliminar.id)
      mostrarNotificacion(
        `Comandas reasignadas y mozo ${mozoAEliminar.nombre} dado de baja exitosamente`,
      )
      setModalBajaAbierto(false)
      await recargar()
    } catch (e) {
      if (e instanceof ApiError) {
        setErrorBaja(e.message)
      } else {
        setErrorBaja('Error durante la reasignación y baja')
      }
    } finally {
      setEliminando(false)
    }
  }

  const mozosFiltrados = mozos.filter((m) => {
    const texto = busqueda.toLowerCase().trim()
    if (!texto) return true
    return (
      m.nombre.toLowerCase().includes(texto) ||
      m.apellido.toLowerCase().includes(texto) ||
      m.dni.includes(texto) ||
      (m.sector_nombre && m.sector_nombre.toLowerCase().includes(texto)) ||
      (m.username && m.username.toLowerCase().includes(texto))
    )
  })

  const otrosMozos = mozos.filter((m) => mozoAEliminar && m.id !== mozoAEliminar.id && m.activo)

  return (
    <div className="flex flex-col gap-6">
      {/* Notificación Toast flotante */}
      {mensajeExito && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold animate-in slide-in-from-top-4 duration-200">
          <Icon name="check_circle" className="text-lg" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {/* Encabezado */}
      <div className="bg-white rounded-2xl p-6 border border-borde shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700">
              <Icon name="badge" className="text-xl" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Gestión de Mozos</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Administración de mozos y asignación de sectores del salón (HU-02).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base"
            />
            <input
              type="text"
              placeholder="Buscar mozo, DNI, sector…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-amber-50/40 focus:bg-white border border-amber-200/80 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>
          <Button icono="person_add" onClick={abrirModalNuevo}>
            Nuevo Mozo
          </Button>
        </div>
      </div>

      {/* Listado / Tabla de Mozos */}
      <div className="bg-white rounded-2xl border border-borde shadow-xs overflow-hidden">
        {cargando ? (
          <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <Icon name="progress_activity" className="text-2xl animate-spin text-brand-600" />
            <span>Cargando listado de mozos…</span>
          </div>
        ) : mozosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <Icon name="group_off" className="text-3xl text-slate-300" />
            <span>No se encontraron mozos activos</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-amber-50/50 border-b border-borde text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Mozo</th>
                  <th className="py-3.5 px-4">DNI</th>
                  <th className="py-3.5 px-4">Teléfono</th>
                  <th className="py-3.5 px-4">Sector Asignado (CA1)</th>
                  <th className="py-3.5 px-4">Usuario</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {mozosFiltrados.map((mozo) => (
                  <tr key={mozo.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-brand-50 border border-brand-200/60 text-brand-800 font-bold flex items-center justify-center text-xs">
                          {mozo.nombre.charAt(0)}
                          {mozo.apellido.charAt(0)}
                        </span>
                        <span>
                          {mozo.apellido}, {mozo.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 tabular">{mozo.dni}</td>
                    <td className="py-3 px-4 text-slate-500">{mozo.telefono ?? '—'}</td>
                    <td className="py-3 px-4">
                      {mozo.sector_nombre ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100/70 border border-amber-200 text-brand-900 font-bold text-[11px]">
                          <Icon name="meeting_room" className="text-xs text-brand-600" />
                          {mozo.sector_nombre}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 text-stone-500 text-[10px] italic">
                          Sin sector asignado
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {mozo.username ? `@${mozo.username}` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge tono={mozo.activo ? 'libre' : 'inactivo'}>
                        {mozo.activo ? 'Activo' : 'Inactivo'}
                      </StatusBadge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => abrirModalEditar(mozo)}
                          title="Editar mozo y sector"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-brand-700 hover:bg-amber-100/70 transition-colors"
                        >
                          <Icon name="edit" className="text-base" />
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirModalBaja(mozo)}
                          title="Dar de baja mozo"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Icon name="delete" className="text-base" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Alta / Edición (CA1) */}
      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo={mozoEditando ? `Editar Mozo: ${mozoEditando.nombre}` : 'Registrar Nuevo Mozo'}
        ancho="max-w-md"
      >
        <form onSubmit={guardarMozo} className="flex flex-col gap-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-status-busy-bg border border-status-busy-border text-status-busy-text font-medium flex items-center gap-2">
              <Icon name="error" className="text-base shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nombre *</label>
              <input
                type="text"
                required
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Ej. Juan"
                className="w-full h-9 px-3 bg-canvas border border-borde rounded-xl text-slate-900 focus:bg-white outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Apellido *</label>
              <input
                type="text"
                required
                value={formApellido}
                onChange={(e) => setFormApellido(e.target.value)}
                placeholder="Ej. Pérez"
                className="w-full h-9 px-3 bg-canvas border border-borde rounded-xl text-slate-900 focus:bg-white outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">DNI *</label>
              <input
                type="text"
                required
                disabled={mozoEditando !== null}
                value={formDni}
                onChange={(e) => setFormDni(e.target.value)}
                placeholder="7 u 8 dígitos"
                pattern="^\d{7,8}$"
                title="DNI de 7 u 8 dígitos numéricos"
                className="w-full h-9 px-3 bg-canvas border border-borde rounded-xl text-slate-900 focus:bg-white outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Teléfono</label>
              <input
                type="text"
                value={formTelefono}
                onChange={(e) => setFormTelefono(e.target.value)}
                placeholder="Opcional"
                className="w-full h-9 px-3 bg-canvas border border-borde rounded-xl text-slate-900 focus:bg-white outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>

          {/* Selector de Sector (CA1) */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Sector Asignado (CA1) *
              <span className="text-[10px] font-normal text-slate-500 block">
                El mozo sólo podrá operar mesas de este sector.
              </span>
            </label>
            <select
              value={formSectorId}
              onChange={(e) => setFormSectorId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full h-9 px-3 bg-canvas border border-borde rounded-xl text-slate-900 focus:bg-white outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            >
              <option value="">-- Sin sector asignado --</option>
              {sectores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Credenciales de Acceso (Solo en Alta) */}
          {!mozoEditando && (
            <div className="pt-2 border-t border-borde flex flex-col gap-3">
              <span className="font-bold text-slate-700 flex items-center gap-1.5 text-xs">
                <Icon name="lock" className="text-base text-brand-600" />
                Cuenta de Usuario para Iniciar Sesión
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Usuario *</label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="Ej. jperez"
                    className="w-full h-9 px-3 bg-canvas border border-borde rounded-xl text-slate-900 focus:bg-white outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contraseña *</label>
                  <input
                    type="password"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    minLength={4}
                    className="w-full h-9 px-3 bg-canvas border border-borde rounded-xl text-slate-900 focus:bg-white outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-borde">
            <button
              type="button"
              onClick={() => setModalAbierto(false)}
              className="h-9 px-4 rounded-xl border border-borde text-slate-600 font-bold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : mozoEditando ? 'Guardar Cambios' : 'Crear Mozo'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Baja / Eliminación con Comandas Activas (CA3) */}
      <Modal
        abierto={modalBajaAbierto}
        onCerrar={() => setModalBajaAbierto(false)}
        titulo="Confirmar Baja de Mozo"
        ancho="max-w-md"
      >
        <div className="flex flex-col gap-4 text-xs">
          {mozoAEliminar && (
            <p className="text-slate-700 leading-relaxed">
              ¿Estás seguro de que deseás inhabilitar al mozo{' '}
              <strong className="text-slate-900">
                {mozoAEliminar.nombre} {mozoAEliminar.apellido}
              </strong>{' '}
              (DNI: {mozoAEliminar.dni})? Esta acción deshabilitará su perfil y su usuario de
              acceso.
            </p>
          )}

          {errorBaja && (
            <div className="p-3.5 rounded-xl bg-status-busy-bg border border-status-busy-border text-status-busy-text font-medium flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <Icon name="warning" className="text-base shrink-0" />
                <span>Bloqueo de eliminación (CA3)</span>
              </div>
              <p className="text-slate-700">{errorBaja}</p>
            </div>
          )}

          {/* Interfaz de Reasignación si está bloqueado por comandas activas */}
          {bloqueoComandas && otrosMozos.length > 0 && (
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200/80 flex flex-col gap-2">
              <label className="font-bold text-slate-800">
                Reasignar comandas activas a otro mozo:
              </label>
              <select
                value={mozoDestinoId}
                onChange={(e) => setMozoDestinoId(Number(e.target.value))}
                className="w-full h-9 px-3 bg-white border border-amber-200 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {otrosMozos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.apellido}, {m.nombre} ({m.sector_nombre ?? 'Sin sector'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-borde">
            <button
              type="button"
              onClick={() => setModalBajaAbierto(false)}
              className="h-9 px-4 rounded-xl border border-borde text-slate-600 font-bold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>

            {bloqueoComandas ? (
              <Button
                variante="primario"
                icono="swap_horiz"
                disabled={eliminando || mozoDestinoId === ''}
                onClick={reasignarYDarDeBaja}
              >
                {eliminando ? 'Reasignando…' : 'Reasignar y Dar de Baja'}
              </Button>
            ) : (
              <button
                type="button"
                disabled={eliminando}
                onClick={ejecutarBaja}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Icon name="delete" className="text-base" />
                {eliminando ? 'Inhabilitando…' : 'Inhabilitar Mozo'}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
