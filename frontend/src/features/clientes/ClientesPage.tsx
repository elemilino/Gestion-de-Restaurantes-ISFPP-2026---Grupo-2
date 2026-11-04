import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '../../api/client'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { StatusBadge } from '../../components/StatusBadge'
import { eliminarCliente, listarClientes } from './api'
import { ClienteForm } from './ClienteForm'
import type { Cliente } from './types'

function mensajeDe(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Ocurrió un error inesperado'
}

/** Minúsculas y sin tildes, para buscar nombres en español como el backend. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Formulario abierto: `null` cerrado, `'nuevo'` alta, o el cliente a editar. */
type EstadoForm = null | 'nuevo' | Cliente

/** HU-10: gestión de la base de clientes (Administrador y Recepcionista). */
export function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const [form, setForm] = useState<EstadoForm>(null)

  const [aEliminar, setAEliminar] = useState<Cliente | null>(null)
  const [errorBaja, setErrorBaja] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState(false)

  async function recargar() {
    try {
      setClientes(await listarClientes())
      setErrorCarga(null)
    } catch (e) {
      setErrorCarga(mensajeDe(e))
    }
  }

  useEffect(() => {
    let montado = true
    listarClientes()
      .then((lista) => montado && setClientes(lista))
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

  function mostrarExito(mensaje: string) {
    setMensajeExito(mensaje)
  }

  const cerrarForm = useCallback(() => setForm(null), [])
  const cerrarBaja = useCallback(() => setAEliminar(null), [])

  async function alGuardar(guardado: Cliente) {
    const esAlta = form === 'nuevo'
    setForm(null)
    mostrarExito(
      esAlta
        ? `Cliente ${guardado.nombre} ${guardado.apellido} registrado correctamente`
        : `Cliente ${guardado.nombre} ${guardado.apellido} modificado correctamente`,
    )
    await recargar()
  }

  function pedirBaja(cliente: Cliente) {
    setErrorBaja(null)
    setAEliminar(cliente)
  }

  async function confirmarBaja() {
    if (!aEliminar) return
    setEliminando(true)
    setErrorBaja(null)
    try {
      await eliminarCliente(aEliminar.id)
      const eliminado = aEliminar
      setAEliminar(null)
      mostrarExito(`Cliente ${eliminado.nombre} ${eliminado.apellido} dado de baja correctamente`)
      await recargar()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CLIENTE_CON_RESERVAS') {
        setErrorBaja('No se puede eliminar el cliente: posee reservas asociadas.')
      } else {
        setErrorBaja(mensajeDe(e))
      }
    } finally {
      setEliminando(false)
    }
  }

  const texto = normalizar(busqueda.trim())
  const visibles = clientes.filter((cliente) => {
    if (!texto) return true
    return (
      normalizar(`${cliente.nombre} ${cliente.apellido}`).includes(texto) ||
      normalizar(`${cliente.apellido} ${cliente.nombre}`).includes(texto) ||
      cliente.dni.includes(texto)
    )
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl p-6 border border-borde shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700">
              <Icon name="badge" className="text-xl" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">Gestión de Clientes</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Base de clientes del restaurante: registro, consulta, modificación y baja (HU-10).
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
              placeholder="Buscar por nombre, apellido o DNI…"
              aria-label="Buscar cliente"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-amber-50/40 focus:bg-white border border-amber-200/80 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>
          <Button icono="person_add" onClick={() => setForm('nuevo')} disabled={cargando}>
            Nuevo cliente
          </Button>
        </div>
      </div>

      {mensajeExito && <Alert tono="exito">{mensajeExito}</Alert>}
      {errorCarga && <Alert tono="error">{errorCarga}</Alert>}

      <div className="bg-white rounded-2xl border border-borde shadow-xs overflow-hidden">
        {cargando ? (
          <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <Icon name="progress_activity" className="text-2xl animate-spin text-brand-600" />
            <span>Cargando clientes…</span>
          </div>
        ) : visibles.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <Icon name="group_off" className="text-3xl text-slate-300" />
            <span>
              {clientes.length === 0
                ? 'Todavía no hay clientes registrados'
                : 'No se encontraron clientes con esa búsqueda'}
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-amber-50/50 border-b border-borde text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">DNI</th>
                  <th className="py-3.5 px-4">Teléfono</th>
                  <th className="py-3.5 px-4">Correo</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {visibles.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-brand-50 border border-brand-200/60 text-brand-800 font-bold flex items-center justify-center text-xs">
                          {cliente.nombre.charAt(0)}
                          {cliente.apellido.charAt(0)}
                        </span>
                        <span>
                          {cliente.apellido}, {cliente.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 tabular">{cliente.dni}</td>
                    <td className="py-3 px-4 text-slate-500">{cliente.telefono}</td>
                    <td className="py-3 px-4 text-slate-500">{cliente.email ?? '—'}</td>
                    <td className="py-3 px-4">
                      <StatusBadge tono={cliente.eliminado ? 'inactivo' : 'libre'}>
                        {cliente.eliminado ? 'Inactivo' : 'Activo'}
                      </StatusBadge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setForm(cliente)}
                          aria-label={`Editar ${cliente.nombre} ${cliente.apellido}`}
                          title="Editar cliente"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-brand-700 hover:bg-amber-100/70 transition-colors"
                        >
                          <Icon name="edit" className="text-base" />
                        </button>
                        <button
                          type="button"
                          onClick={() => pedirBaja(cliente)}
                          aria-label={`Eliminar ${cliente.nombre} ${cliente.apellido}`}
                          title="Dar de baja"
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

      {form !== null && (
        <ClienteForm
          cliente={form === 'nuevo' ? null : form}
          onCerrar={cerrarForm}
          onGuardado={alGuardar}
        />
      )}

      <Modal
        abierto={aEliminar !== null}
        onCerrar={cerrarBaja}
        titulo="Dar de baja cliente"
        acciones={
          <>
            <Button variante="secundario" onClick={cerrarBaja}>
              Cancelar
            </Button>
            <button
              type="button"
              onClick={confirmarBaja}
              disabled={eliminando}
              className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Icon name="delete" className="text-base" />
              {eliminando ? 'Dando de baja…' : 'Dar de baja'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm text-slate-700">
          <p>
            ¿Dar de baja a{' '}
            <strong className="text-slate-900">
              {aEliminar?.nombre} {aEliminar?.apellido}
            </strong>{' '}
            (DNI: {aEliminar?.dni})? Dejará de aparecer en la base de clientes.
          </p>
          {errorBaja && <Alert tono="error">{errorBaja}</Alert>}
        </div>
      </Modal>
    </div>
  )
}
