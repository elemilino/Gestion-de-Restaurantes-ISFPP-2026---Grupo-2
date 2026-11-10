import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'

import { ApiError } from '../../api/client'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { listarProductos, listarSecciones } from '../carta/api'
import type { Producto, Seccion } from '../carta/types'
import { crearPromocion, listarPromociones, modificarPromocion } from './api'
import type { Promocion } from './types'
import {
  aDatosApi,
  aFormulario,
  cambiosRespectoDe,
  conflictosDeProductos,
  FORMULARIO_PROMOCION_VACIO,
  formatearFecha,
  formatearFechaEntrada,
  textoAFecha,
  validarPromocion,
  type ErroresPromocion,
  type FormularioPromocion,
} from './validaciones'

function mensajeDe(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'PROMOCION_SUPERPUESTA') {
      return 'Ya existe una promoción activa para uno de esos productos en ese período.'
    }
    return e.message
  }
  return 'Ocurrió un error inesperado'
}

/** Minúsculas y sin tildes, para buscar productos en español. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

interface CampoFechaProps {
  id: string
  /** Fecha en formato ISO (YYYY-MM-DD), como la maneja el formulario. */
  value: string
  onChange: (iso: string) => void
  ariaInvalid?: true
}

/** Input de fecha que se muestra siempre como dd/mm/aaaa y guarda ISO. */
function CampoFecha({ id, value, onChange, ariaInvalid }: CampoFechaProps) {
  const [texto, setTexto] = useState(() => formatearFecha(value))

  function cambiar(e: ChangeEvent<HTMLInputElement>) {
    const formateado = formatearFechaEntrada(e.target.value)
    setTexto(formateado)
    onChange(textoAFecha(formateado))
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={texto}
      onChange={cambiar}
      placeholder="dd/mm/aaaa"
      maxLength={10}
      aria-invalid={ariaInvalid}
      className={CLASE_INPUT}
    />
  )
}

interface PromocionFormProps {
  /** Promoción a editar; `null` para el alta. */
  promocion: Promocion | null
  onCerrar: () => void
  onGuardado: (promocion: Promocion) => void
}

/**
 * Alta y edición de promociones (HU-09a). Se monta cada vez que se abre, así
 * arranca con los datos de la promoción elegida.
 */
export function PromocionForm({ promocion, onCerrar, onGuardado }: PromocionFormProps) {
  const [datos, setDatos] = useState<FormularioPromocion>(() =>
    promocion ? aFormulario(promocion) : FORMULARIO_PROMOCION_VACIO,
  )
  const original = useMemo(() => (promocion ? aFormulario(promocion) : null), [promocion])
  const [errores, setErrores] = useState<ErroresPromocion>({})
  const [errorApi, setErrorApi] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  /** Productos que chocan con otra promoción activa, con las promociones que los usan. */
  const [conflictos, setConflictos] = useState<Map<number, Promocion[]>>(new Map())

  const [productos, setProductos] = useState<Producto[]>([])
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [cargandoProductos, setCargandoProductos] = useState(true)
  const [errorProductos, setErrorProductos] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    let montado = true
    Promise.all([listarProductos(), listarSecciones()])
      .then(([listaProductos, listaSecciones]) => {
        if (!montado) return
        setProductos(listaProductos)
        setSecciones(listaSecciones)
      })
      .catch((e) => montado && setErrorProductos(mensajeDe(e)))
      .finally(() => montado && setCargandoProductos(false))
    return () => {
      montado = false
    }
  }, [])

  const seleccionados = new Set(datos.productos_ids)
  const texto = normalizar(busqueda.trim())

  const visibles = productos.filter((p) => !texto || normalizar(p.nombre).includes(texto))
  const grupos = secciones
    .map((seccion) => ({
      seccion,
      productos: visibles.filter((p) => p.seccion_id === seccion.id),
    }))
    .filter((grupo) => grupo.productos.length > 0)
  const sueltos = visibles.filter((p) => !secciones.some((seccion) => seccion.id === p.seccion_id))

  // Productos ya vinculados que hoy no están activos en la carta.
  const inactivos = (promocion?.productos ?? [])
    .filter((p) => !productos.some((activo) => activo.id === p.id))
    .filter((p) => !texto || normalizar(p.nombre).includes(texto))

  function nombreProducto(id: number): string {
    return (
      productos.find((p) => p.id === id)?.nombre ??
      promocion?.productos.find((p) => p.id === id)?.nombre ??
      `Producto ${id}`
    )
  }

  function detalleConflicto(id: number): string | undefined {
    const lista = conflictos.get(id)
    if (!lista || lista.length === 0) return undefined
    return `Ya en: ${lista.map((p) => p.descripcion).join(', ')}`
  }

  function cambiar(campo: keyof FormularioPromocion, valor: string) {
    setConflictos(new Map())
    setDatos((anteriores) => ({ ...anteriores, [campo]: valor }))
  }

  function alternarProducto(id: number) {
    setConflictos(new Map())
    setDatos((anteriores) => ({
      ...anteriores,
      productos_ids: anteriores.productos_ids.includes(id)
        ? anteriores.productos_ids.filter((productoId) => productoId !== id)
        : [...anteriores.productos_ids, id],
    }))
  }

  function seleccionarVisibles() {
    setConflictos(new Map())
    setDatos((anteriores) => {
      const ids = new Set(anteriores.productos_ids)
      visibles.forEach((p) => ids.add(p.id))
      return { ...anteriores, productos_ids: [...ids] }
    })
  }

  function limpiarSeleccion() {
    setConflictos(new Map())
    setDatos((anteriores) => ({ ...anteriores, productos_ids: [] }))
  }

  /** Al chocar con otra promoción, marca en la lista los productos afectados. */
  async function marcarConflictos(e: unknown) {
    if (!(e instanceof ApiError) || e.code !== 'PROMOCION_SUPERPUESTA') {
      setConflictos(new Map())
      setErrorApi(mensajeDe(e))
      return
    }

    try {
      const actuales = await listarPromociones()
      const mapa = conflictosDeProductos(
        actuales,
        datos.productos_ids,
        datos.fecha_inicio,
        datos.fecha_fin,
        promocion?.id,
      )
      setConflictos(mapa)

      const nombres = [...mapa.keys()].map(nombreProducto)
      setErrorApi(
        nombres.length > 0
          ? `Estos productos ya tienen una promoción activa en ese período: ${nombres.join(', ')}.`
          : mensajeDe(e),
      )
    } catch {
      setConflictos(new Map())
      setErrorApi(mensajeDe(e))
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setErrorApi(null)
    setConflictos(new Map())

    const nuevosErrores = validarPromocion(datos, promocion?.fecha_inicio)
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    setGuardando(true)
    try {
      let guardada: Promocion
      if (promocion && original) {
        const cambios = cambiosRespectoDe(datos, original)
        guardada =
          Object.keys(cambios).length === 0
            ? promocion
            : await modificarPromocion(promocion.id, cambios)
      } else {
        guardada = await crearPromocion(aDatosApi(datos))
      }
      onGuardado(guardada)
    } catch (e) {
      await marcarConflictos(e)
    } finally {
      setGuardando(false)
    }
  }

  const invalido = (campo: keyof FormularioPromocion) => (errores[campo] ? true : undefined)

  function filaProducto(id: number, nombre: string, inactivo = false) {
    const detalle = detalleConflicto(id)
    const enConflicto = detalle !== undefined

    return (
      <label
        key={id}
        className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer ${
          enConflicto ? 'bg-status-busy-bg' : 'hover:bg-amber-50/40'
        }`}
      >
        <input
          type="checkbox"
          checked={seleccionados.has(id)}
          onChange={() => alternarProducto(id)}
          className="mt-0.5 w-4 h-4 rounded border-borde text-brand-600 focus:ring-brand-600"
        />
        <span className="flex-1">
          <span className="block text-sm text-slate-700">{nombre}</span>
          {detalle && (
            <span className="block text-[11px] font-medium text-status-busy-text">{detalle}</span>
          )}
        </span>
        {enConflicto && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-status-busy-text">
            En conflicto
          </span>
        )}
        {inactivo && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-status-busy-text">
            Inactivo
          </span>
        )}
      </label>
    )
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={promocion ? 'Editar promoción' : 'Registrar promoción'}
      ancho="max-w-2xl"
      acciones={
        <>
          <Button variante="secundario" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-promocion" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-promocion" onSubmit={guardar} noValidate className="flex flex-col gap-4">
        {errorApi && <Alert tono="error">{errorApi}</Alert>}

        <Field
          label="Descripción"
          htmlFor="promocion-descripcion"
          error={errores.descripcion}
          ayuda="Ej. 2x1 en hamburguesas"
        >
          <input
            id="promocion-descripcion"
            value={datos.descripcion}
            onChange={(e) => cambiar('descripcion', e.target.value)}
            placeholder="Ej. 2x1 en hamburguesas"
            aria-invalid={invalido('descripcion')}
            className={CLASE_INPUT}
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field
            label="Descuento (%)"
            htmlFor="promocion-descuento"
            error={errores.descuento}
            ayuda="Mayor a 0 y hasta 100"
          >
            <input
              id="promocion-descuento"
              type="number"
              inputMode="decimal"
              min="0.01"
              max="100"
              step="0.01"
              value={datos.descuento}
              onChange={(e) => cambiar('descuento', e.target.value)}
              placeholder="Ej. 15"
              aria-invalid={invalido('descuento')}
              className={`${CLASE_INPUT} tabular`}
            />
          </Field>

          <Field label="Desde" htmlFor="promocion-inicio" error={errores.fecha_inicio}>
            <CampoFecha
              id="promocion-inicio"
              value={datos.fecha_inicio}
              onChange={(iso) => cambiar('fecha_inicio', iso)}
              ariaInvalid={invalido('fecha_inicio')}
            />
          </Field>

          <Field label="Hasta" htmlFor="promocion-fin" error={errores.fecha_fin}>
            <CampoFecha
              id="promocion-fin"
              value={datos.fecha_fin}
              onChange={(iso) => cambiar('fecha_fin', iso)}
              ariaInvalid={invalido('fecha_fin')}
            />
          </Field>
        </div>

        <Field
          label={`Productos (${datos.productos_ids.length} seleccionados)`}
          error={errores.productos_ids}
          ayuda="Solo se listan productos activos de la carta."
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Icon
                  name="search"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base"
                />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar producto…"
                  aria-label="Buscar producto"
                  className="w-full h-10 pl-9 pr-3 bg-white border border-borde rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-brand-600"
                />
              </div>
              <button
                type="button"
                onClick={seleccionarVisibles}
                className="text-[11px] font-bold text-brand-700 hover:underline shrink-0"
              >
                Seleccionar visibles
              </button>
              <button
                type="button"
                onClick={limpiarSeleccion}
                className="text-[11px] font-bold text-slate-500 hover:underline shrink-0"
              >
                Limpiar
              </button>
            </div>

            {cargandoProductos ? (
              <p className="p-6 text-center text-xs text-slate-400">Cargando productos…</p>
            ) : errorProductos ? (
              <Alert tono="error">{errorProductos}</Alert>
            ) : grupos.length === 0 && sueltos.length === 0 && inactivos.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">
                {productos.length === 0
                  ? 'No hay productos activos en la carta.'
                  : 'No se encontraron productos con esa búsqueda.'}
              </p>
            ) : (
              <div className="border border-borde rounded-xl max-h-64 overflow-y-auto divide-y divide-borde">
                {grupos.map(({ seccion, productos: lista }) => (
                  <div key={seccion.id}>
                    <p className="px-3 py-1.5 bg-amber-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {seccion.nombre}
                    </p>
                    {lista.map((p) => filaProducto(p.id, p.nombre))}
                  </div>
                ))}

                {sueltos.length > 0 && (
                  <div>
                    <p className="px-3 py-1.5 bg-amber-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Otras secciones
                    </p>
                    {sueltos.map((p) => filaProducto(p.id, p.nombre))}
                  </div>
                )}

                {inactivos.length > 0 && (
                  <div>
                    <p className="px-3 py-1.5 bg-amber-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Ya no están activos
                    </p>
                    {inactivos.map((p) => filaProducto(p.id, p.nombre, true))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Field>
      </form>
    </Modal>
  )
}
