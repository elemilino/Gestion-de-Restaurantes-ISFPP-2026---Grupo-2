import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { ApiError } from '../../api/client'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { crearSector, eliminarSector, listarSectores, modificarSector } from './api'
import type { Sector } from './types'

interface Errores {
  nombre?: string
  descripcion?: string
}

/** Mismas reglas que SectorCreate/SectorUpdate del backend. */
function validar(nombre: string, descripcion: string): Errores {
  const errores: Errores = {}
  const largo = nombre.trim().length
  if (largo === 0) errores.nombre = 'El nombre es obligatorio'
  else if (largo > 50) errores.nombre = 'El nombre puede tener hasta 50 caracteres'
  if (descripcion.trim().length > 200)
    errores.descripcion = 'La descripción puede tener hasta 200 caracteres'
  return errores
}

function mensajeDe(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Ocurrió un error inesperado'
}

/** HU-01a: ABM de sectores del salón (solo Administrador). */
export function SectoresPage() {
  const [sectores, setSectores] = useState<Sector[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // Alta / edición
  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState<Sector | null>(null)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Eliminación
  const [aEliminar, setAEliminar] = useState<Sector | null>(null)
  const [errorBaja, setErrorBaja] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState(false)

  async function recargar() {
    try {
      setSectores(await listarSectores())
      setErrorCarga(null)
    } catch (e) {
      setErrorCarga(mensajeDe(e))
    }
  }

  useEffect(() => {
    let montado = true
    listarSectores()
      .then((lista) => montado && setSectores(lista))
      .catch((e) => montado && setErrorCarga(mensajeDe(e)))
      .finally(() => montado && setCargando(false))
    return () => {
      montado = false
    }
  }, [])

  function abrirAlta() {
    setEditando(null)
    setNombre('')
    setDescripcion('')
    setErrores({})
    setErrorForm(null)
    setFormAbierto(true)
  }

  function abrirEdicion(sector: Sector) {
    setEditando(sector)
    setNombre(sector.nombre)
    setDescripcion(sector.descripcion ?? '')
    setErrores({})
    setErrorForm(null)
    setFormAbierto(true)
  }

  const cerrarForm = useCallback(() => setFormAbierto(false), [])
  const cerrarBaja = useCallback(() => setAEliminar(null), [])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setErrorForm(null)
    const nuevosErrores = validar(nombre, descripcion)
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    const datos = { nombre: nombre.trim(), descripcion: descripcion.trim() || null }
    setGuardando(true)
    try {
      if (editando) await modificarSector(editando.id, datos)
      else await crearSector(datos)
      setFormAbierto(false)
      await recargar()
    } catch (e) {
      setErrorForm(mensajeDe(e))
    } finally {
      setGuardando(false)
    }
  }

  function pedirBaja(sector: Sector) {
    setErrorBaja(null)
    setAEliminar(sector)
  }

  async function confirmarBaja() {
    if (!aEliminar) return
    setEliminando(true)
    setErrorBaja(null)
    try {
      await eliminarSector(aEliminar.id)
      setAEliminar(null)
      await recargar()
    } catch (e) {
      setErrorBaja(mensajeDe(e))
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-borde shadow-xs overflow-hidden">
      <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-borde">
        <div>
          <h2 className="text-base font-bold text-slate-900">Sectores del salón</h2>
          <p className="text-xs text-slate-500">Organizan la distribución física de las mesas.</p>
        </div>
        <Button icono="add_circle" onClick={abrirAlta}>
          Nuevo sector
        </Button>
      </div>

      {errorCarga && (
        <div className="p-4">
          <Alert tono="error">{errorCarga}</Alert>
        </div>
      )}

      {cargando ? (
        <p className="p-12 text-center text-sm text-slate-400">Cargando sectores…</p>
      ) : sectores.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
          <Icon name="floor" className="text-3xl text-slate-300" />
          <span>Todavía no hay sectores. Creá el primero</span>
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-amber-50/50 border-b border-borde text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Nombre</th>
              <th className="py-3 px-4">Descripción</th>
              <th className="py-3 px-4">Mesas</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {sectores.map((s) => (
              <tr key={s.id} className="hover:bg-amber-50/30 transition-colors">
                <td className="py-3 px-4 font-semibold text-slate-900">{s.nombre}</td>
                <td className="py-3 px-4 text-slate-600">
                  {s.descripcion ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="py-3 px-4 tabular text-slate-600">{s.cantidad_mesas}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => abrirEdicion(s)}
                      aria-label={`Editar ${s.nombre}`}
                      title="Editar"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-brand-700 hover:bg-amber-100/70 transition-colors"
                    >
                      <Icon name="edit" className="text-base" />
                    </button>
                    <button
                      type="button"
                      onClick={() => pedirBaja(s)}
                      aria-label={`Eliminar ${s.nombre}`}
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
        titulo={editando ? `Editar sector ${editando.nombre}` : 'Nuevo sector'}
        acciones={
          <>
            <Button variante="secundario" onClick={cerrarForm}>
              Cancelar
            </Button>
            <Button type="submit" form="form-sector" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="form-sector" onSubmit={guardar} noValidate className="flex flex-col gap-4">
          {errorForm && <Alert tono="error">{errorForm}</Alert>}
          <Field label="Nombre" htmlFor="sector-nombre" error={errores.nombre}>
            <input
              id="sector-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Terraza"
              aria-invalid={errores.nombre ? true : undefined}
              className={CLASE_INPUT}
              autoFocus
            />
          </Field>
          <Field
            label="Descripción"
            htmlFor="sector-descripcion"
            error={errores.descripcion}
            ayuda="Opcional"
          >
            <textarea
              id="sector-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. Primer piso, al aire libre"
              rows={3}
              aria-invalid={errores.descripcion ? true : undefined}
              className={`${CLASE_INPUT} h-auto py-2`}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        abierto={aEliminar !== null}
        onCerrar={cerrarBaja}
        titulo="Eliminar sector"
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
          <p>¿Eliminar el sector {aEliminar?.nombre}?</p>
          {errorBaja && <Alert tono="error">{errorBaja}</Alert>}
        </div>
      </Modal>
    </div>
  )
}
