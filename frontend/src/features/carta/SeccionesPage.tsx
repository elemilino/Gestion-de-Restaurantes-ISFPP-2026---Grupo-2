import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { ApiError } from '../../api/client'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { crearSeccion, eliminarSeccion, listarSecciones, modificarSeccion } from './api'
import type { Seccion } from './types'

interface Errores {
  nombre?: string
  orden?: string
}

/** Mismas reglas que SeccionCreate/SeccionUpdate del backend (CA3). */
function validar(nombre: string, orden: string, ordenObligatorio: boolean): Errores {
  const errores: Errores = {}
  const largo = nombre.trim().length
  if (largo === 0) errores.nombre = 'El nombre es obligatorio'
  else if (largo < 3 || largo > 50) errores.nombre = 'El nombre debe tener entre 3 y 50 caracteres'
  if (orden.trim() === '') {
    if (ordenObligatorio) errores.orden = 'El orden es obligatorio'
  } else if (!/^\d+$/.test(orden.trim()) || Number(orden) < 1) {
    errores.orden = 'El orden debe ser un número entero mayor o igual a 1'
  }
  return errores
}

function mensajeDe(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Ocurrió un error inesperado'
}

/** HU-03a: ABM de secciones de la carta (solo Administrador). */
export function SeccionesPage() {
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // Alta / edición
  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState<Seccion | null>(null)
  const [nombre, setNombre] = useState('')
  const [orden, setOrden] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Eliminación
  const [aEliminar, setAEliminar] = useState<Seccion | null>(null)
  const [errorBaja, setErrorBaja] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState(false)

  async function recargar() {
    try {
      setSecciones(await listarSecciones())
      setErrorCarga(null)
    } catch (e) {
      setErrorCarga(mensajeDe(e))
    }
  }

  useEffect(() => {
    let montado = true
    listarSecciones()
      .then((lista) => montado && setSecciones(lista))
      .catch((e) => montado && setErrorCarga(mensajeDe(e)))
      .finally(() => montado && setCargando(false))
    return () => {
      montado = false
    }
  }, [])

  function abrirAlta() {
    setEditando(null)
    setNombre('')
    setOrden('')
    setErrores({})
    setErrorForm(null)
    setFormAbierto(true)
  }

  function abrirEdicion(seccion: Seccion) {
    setEditando(seccion)
    setNombre(seccion.nombre)
    setOrden(String(seccion.orden))
    setErrores({})
    setErrorForm(null)
    setFormAbierto(true)
  }

  const cerrarForm = useCallback(() => setFormAbierto(false), [])
  const cerrarBaja = useCallback(() => setAEliminar(null), [])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setErrorForm(null)
    const nuevosErrores = validar(nombre, orden, editando !== null)
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    setGuardando(true)
    try {
      if (editando) {
        await modificarSeccion(editando.id, { nombre: nombre.trim(), orden: Number(orden) })
      } else {
        await crearSeccion({
          nombre: nombre.trim(),
          ...(orden.trim() ? { orden: Number(orden) } : {}),
        })
      }
      setFormAbierto(false)
      await recargar()
    } catch (e) {
      setErrorForm(mensajeDe(e))
    } finally {
      setGuardando(false)
    }
  }

  function pedirBaja(seccion: Seccion) {
    setErrorBaja(null)
    setAEliminar(seccion)
  }

  async function confirmarBaja() {
    if (!aEliminar) return
    setEliminando(true)
    setErrorBaja(null)
    try {
      await eliminarSeccion(aEliminar.id)
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
          <h2 className="text-base font-bold text-slate-900">Secciones de la carta</h2>
          <p className="text-xs text-slate-500">
            Se muestran en este orden en la carta. Editá el número de orden para moverlas.
          </p>
        </div>
        <Button icono="add_circle" onClick={abrirAlta}>
          Nueva sección
        </Button>
      </div>

      {errorCarga && (
        <div className="p-4">
          <Alert tono="error">{errorCarga}</Alert>
        </div>
      )}

      {cargando ? (
        <p className="p-12 text-center text-sm text-slate-400">Cargando secciones…</p>
      ) : secciones.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
          <Icon name="view_list" className="text-3xl text-slate-300" />
          <span>Todavía no hay secciones. Creá la primera</span>
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-amber-50/50 border-b border-borde text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4 w-20">Orden</th>
              <th className="py-3 px-4">Nombre</th>
              <th className="py-3 px-4">Productos activos</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {secciones.map((s) => (
              <tr key={s.id} className="hover:bg-amber-50/30 transition-colors">
                <td className="py-3 px-4 tabular font-bold text-slate-500">{s.orden}</td>
                <td className="py-3 px-4 font-semibold text-slate-900">{s.nombre}</td>
                <td className="py-3 px-4 tabular text-slate-600">{s.cantidad_productos}</td>
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
        titulo={editando ? `Editar sección ${editando.nombre}` : 'Nueva sección'}
        acciones={
          <>
            <Button variante="secundario" onClick={cerrarForm}>
              Cancelar
            </Button>
            <Button type="submit" form="form-seccion" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="form-seccion" onSubmit={guardar} noValidate className="flex flex-col gap-4">
          {errorForm && <Alert tono="error">{errorForm}</Alert>}
          <Field label="Nombre" htmlFor="seccion-nombre" error={errores.nombre}>
            <input
              id="seccion-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Entradas"
              aria-invalid={errores.nombre ? true : undefined}
              className={CLASE_INPUT}
              autoFocus
            />
          </Field>
          <Field
            label="Orden en la carta"
            htmlFor="seccion-orden"
            error={errores.orden}
            ayuda={editando ? undefined : 'Si lo dejás vacío, va al final'}
          >
            <input
              id="seccion-orden"
              type="number"
              min={1}
              step={1}
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
              aria-invalid={errores.orden ? true : undefined}
              className={CLASE_INPUT}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        abierto={aEliminar !== null}
        onCerrar={cerrarBaja}
        titulo="Eliminar sección"
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
          <p>¿Eliminar la sección {aEliminar?.nombre}?</p>
          {errorBaja && <Alert tono="error">{errorBaja}</Alert>}
        </div>
      </Modal>
    </div>
  )
}
