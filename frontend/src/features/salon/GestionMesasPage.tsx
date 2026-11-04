import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { ApiError } from '../../api/client'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { StatusBadge } from '../../components/StatusBadge'
import type { Tono } from '../../components/tonos'
import { crearMesa, eliminarMesa, listarMesas, listarSectores, modificarMesa } from './api'
import type { Disponibilidad, Mesa, Sector } from './types'

const DISPONIBILIDAD: Record<Disponibilidad, { tono: Tono; etiqueta: string }> = {
  LIBRE: { tono: 'libre', etiqueta: 'Libre' },
  OCUPADA: { tono: 'ocupado', etiqueta: 'Ocupada' },
  RESERVADA: { tono: 'reservado', etiqueta: 'Reservada' },
}

interface Errores {
  numero?: string
  capacidad?: string
  sector?: string
}

const ENTERO = /^-?\d+$/

/** Mismas reglas que MesaCreate/MesaUpdate y el service del backend (CA3). */
function validar(numero: string, capacidad: string, sectorId: string): Errores {
  const errores: Errores = {}
  if (numero.trim() === '') errores.numero = 'El número es obligatorio'
  else if (!ENTERO.test(numero.trim()) || Number(numero) < 1)
    errores.numero = 'El número debe ser un entero mayor a 0'
  if (capacidad.trim() === '') errores.capacidad = 'La capacidad es obligatoria'
  else if (!ENTERO.test(capacidad.trim()))
    errores.capacidad = 'La capacidad debe ser un número entero'
  else if (Number(capacidad) <= 0) errores.capacidad = 'La capacidad debe ser mayor a 0'
  if (sectorId === '') errores.sector = 'Elegí un sector'
  return errores
}

function mensajeDe(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Ocurrió un error inesperado'
}

/** HU-01b: ABM de las mesas de cada sector (solo Administrador). */
export function GestionMesasPage() {
  const [sectores, setSectores] = useState<Sector[] | null>(null)
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [filtroSector, setFiltroSector] = useState('')
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  // Alta / edición
  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState<Mesa | null>(null)
  const [numero, setNumero] = useState('')
  const [capacidad, setCapacidad] = useState('')
  const [sectorId, setSectorId] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Eliminación
  const [aEliminar, setAEliminar] = useState<Mesa | null>(null)
  const [errorBaja, setErrorBaja] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    let montado = true
    listarSectores()
      .then((lista) => montado && setSectores(lista))
      .catch((e) => montado && setErrorCarga(mensajeDe(e)))
    return () => {
      montado = false
    }
  }, [])

  useEffect(() => {
    let montado = true
    listarMesas(filtroSector ? Number(filtroSector) : undefined)
      .then((lista) => {
        if (!montado) return
        setMesas(lista)
        setErrorCarga(null)
      })
      .catch((e) => montado && setErrorCarga(mensajeDe(e)))
      .finally(() => montado && setCargando(false))
    return () => {
      montado = false
    }
  }, [filtroSector])

  async function recargar() {
    try {
      setMesas(await listarMesas(filtroSector ? Number(filtroSector) : undefined))
      setErrorCarga(null)
    } catch (e) {
      setErrorCarga(mensajeDe(e))
    }
  }

  function abrirAlta() {
    setEditando(null)
    setNumero('')
    setCapacidad('')
    setSectorId(filtroSector || (sectores?.length === 1 ? String(sectores[0].id) : ''))
    setErrores({})
    setErrorForm(null)
    setFormAbierto(true)
  }

  function abrirEdicion(mesa: Mesa) {
    setEditando(mesa)
    setNumero(String(mesa.numero))
    setCapacidad(String(mesa.capacidad))
    setSectorId(String(mesa.sector_id))
    setErrores({})
    setErrorForm(null)
    setFormAbierto(true)
  }

  const cerrarForm = useCallback(() => setFormAbierto(false), [])
  const cerrarBaja = useCallback(() => setAEliminar(null), [])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setErrorForm(null)
    const nuevosErrores = validar(numero, capacidad, sectorId)
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    const datos = {
      numero: Number(numero),
      capacidad: Number(capacidad),
      sector_id: Number(sectorId),
    }
    setGuardando(true)
    try {
      if (editando) await modificarMesa(editando.id, datos)
      else await crearMesa(datos)
      setFormAbierto(false)
      setExito(null)
      await recargar()
    } catch (e) {
      setErrorForm(mensajeDe(e))
    } finally {
      setGuardando(false)
    }
  }

  function pedirBaja(mesa: Mesa) {
    setErrorBaja(null)
    setAEliminar(mesa)
  }

  async function confirmarBaja() {
    if (!aEliminar) return
    setEliminando(true)
    setErrorBaja(null)
    try {
      await eliminarMesa(aEliminar.id)
      setExito(`Se dio de baja la mesa ${aEliminar.numero}`)
      setAEliminar(null)
      await recargar()
    } catch (e) {
      setErrorBaja(mensajeDe(e))
    } finally {
      setEliminando(false)
    }
  }

  const sinSectores = sectores?.length === 0

  return (
    <div className="bg-white rounded-2xl border border-borde shadow-xs overflow-hidden">
      <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-borde">
        <div>
          <h2 className="text-base font-bold text-slate-900">Mesas del salón</h2>
          <p className="text-xs text-slate-500">El número de mesa es único en todo el salón.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtroSector}
            onChange={(e) => setFiltroSector(e.target.value)}
            aria-label="Filtrar por sector"
            className={`${CLASE_INPUT} h-9 w-48 text-xs`}
          >
            <option value="">Todos los sectores</option>
            {sectores?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
          <Button icono="add_circle" onClick={abrirAlta} disabled={sinSectores}>
            Nueva mesa
          </Button>
        </div>
      </div>

      {(errorCarga || exito || sinSectores) && (
        <div className="p-4 flex flex-col gap-2">
          {errorCarga && <Alert tono="error">{errorCarga}</Alert>}
          {exito && <Alert tono="exito">{exito}</Alert>}
          {sinSectores && (
            <Alert tono="info">
              Para cargar mesas, primero creá un sector en la pestaña Sectores.
            </Alert>
          )}
        </div>
      )}

      {cargando ? (
        <p className="p-12 text-center text-sm text-slate-400">Cargando mesas…</p>
      ) : mesas.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
          <Icon name="table_restaurant" className="text-3xl text-slate-300" />
          <span>
            {filtroSector ? 'No hay mesas en este sector' : 'El listado de mesas está vacío'}
          </span>
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-amber-50/50 border-b border-borde text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4 w-24">Número</th>
              <th className="py-3 px-4">Capacidad</th>
              <th className="py-3 px-4">Sector</th>
              <th className="py-3 px-4">Disponibilidad</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {mesas.map((m) => (
              <tr key={m.id} className="hover:bg-amber-50/30 transition-colors">
                <td className="py-3 px-4 tabular font-bold text-slate-900">{m.numero}</td>
                <td className="py-3 px-4 tabular text-slate-600">
                  {m.capacidad} {m.capacidad === 1 ? 'persona' : 'personas'}
                </td>
                <td className="py-3 px-4 text-slate-600">{m.sector_nombre}</td>
                <td className="py-3 px-4">
                  <span className="inline-flex">
                    <StatusBadge tono={DISPONIBILIDAD[m.disponibilidad].tono}>
                      {DISPONIBILIDAD[m.disponibilidad].etiqueta}
                    </StatusBadge>
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => abrirEdicion(m)}
                      aria-label={`Editar mesa ${m.numero}`}
                      title="Editar"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-brand-700 hover:bg-amber-100/70 transition-colors"
                    >
                      <Icon name="edit" className="text-base" />
                    </button>
                    <button
                      type="button"
                      onClick={() => pedirBaja(m)}
                      aria-label={`Eliminar mesa ${m.numero}`}
                      title="Eliminar"
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
      )}

      <Modal
        abierto={formAbierto}
        onCerrar={cerrarForm}
        titulo={editando ? `Editar mesa ${editando.numero}` : 'Nueva mesa'}
        acciones={
          <>
            <Button variante="secundario" onClick={cerrarForm}>
              Cancelar
            </Button>
            <Button type="submit" form="form-mesa" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="form-mesa" onSubmit={guardar} noValidate className="flex flex-col gap-4">
          {errorForm && <Alert tono="error">{errorForm}</Alert>}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Número" htmlFor="mesa-numero" error={errores.numero}>
              <input
                id="mesa-numero"
                type="number"
                min={1}
                step={1}
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                aria-invalid={errores.numero ? true : undefined}
                className={CLASE_INPUT}
                autoFocus
              />
            </Field>
            <Field label="Capacidad" htmlFor="mesa-capacidad" error={errores.capacidad}>
              <input
                id="mesa-capacidad"
                type="number"
                min={1}
                step={1}
                value={capacidad}
                onChange={(e) => setCapacidad(e.target.value)}
                aria-invalid={errores.capacidad ? true : undefined}
                className={CLASE_INPUT}
              />
            </Field>
          </div>
          <Field label="Sector" htmlFor="mesa-sector" error={errores.sector}>
            <select
              id="mesa-sector"
              value={sectorId}
              onChange={(e) => setSectorId(e.target.value)}
              aria-invalid={errores.sector ? true : undefined}
              className={CLASE_INPUT}
            >
              <option value="">Elegí un sector…</option>
              {sectores?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </Field>
        </form>
      </Modal>

      <Modal
        abierto={aEliminar !== null}
        onCerrar={cerrarBaja}
        titulo="Eliminar mesa"
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
              {eliminando ? 'Eliminando…' : 'Eliminar'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm text-slate-700">
          <p>¿Eliminar la mesa {aEliminar?.numero}?</p>
          {errorBaja && <Alert tono="error">{errorBaja}</Alert>}
        </div>
      </Modal>
    </div>
  )
}
