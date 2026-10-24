import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { ApiError } from '../../api/client'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { FilterChip } from '../../components/FilterChip'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { formatMoneda } from '../../lib/format'
import { eliminarProducto, listarProductos, listarSecciones } from './api'
import { ProductoForm } from './ProductoForm'
import { TIPOS_PRODUCTO } from './tiposProducto'
import type { Producto, Seccion, TipoProducto } from './types'

function mensajeDe(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Ocurrió un error inesperado'
}

/** Formulario abierto: `null` cerrado, `'nuevo'` alta, o el producto a editar. */
type EstadoForm = null | 'nuevo' | Producto

/** HU-04a: administración de productos de la carta (solo Administrador). */
export function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const [filtroTipo, setFiltroTipo] = useState<TipoProducto | null>(null)
  const [filtroSeccion, setFiltroSeccion] = useState<number | null>(null)

  const [form, setForm] = useState<EstadoForm>(null)

  const [aEliminar, setAEliminar] = useState<Producto | null>(null)
  const [errorBaja, setErrorBaja] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState(false)

  async function recargar() {
    try {
      const [listaProductos, listaSecciones] = await Promise.all([
        listarProductos(),
        listarSecciones(),
      ])
      setProductos(listaProductos)
      setSecciones(listaSecciones)
      setErrorCarga(null)
    } catch (e) {
      setErrorCarga(mensajeDe(e))
    }
  }

  useEffect(() => {
    let montado = true
    Promise.all([listarProductos(), listarSecciones()])
      .then(([listaProductos, listaSecciones]) => {
        if (!montado) return
        setProductos(listaProductos)
        setSecciones(listaSecciones)
      })
      .catch((e) => montado && setErrorCarga(mensajeDe(e)))
      .finally(() => montado && setCargando(false))
    return () => {
      montado = false
    }
  }, [])

  const nombreSeccion = useMemo(() => new Map(secciones.map((s) => [s.id, s.nombre])), [secciones])

  const visibles = productos.filter(
    (p) =>
      (filtroTipo === null || p.tipo === filtroTipo) &&
      (filtroSeccion === null || p.seccion_id === filtroSeccion),
  )

  const cerrarForm = useCallback(() => setForm(null), [])
  const cerrarBaja = useCallback(() => setAEliminar(null), [])

  async function alGuardar() {
    setForm(null)
    await recargar()
  }

  function pedirBaja(producto: Producto) {
    setErrorBaja(null)
    setAEliminar(producto)
  }

  async function confirmarBaja() {
    if (!aEliminar) return
    setEliminando(true)
    setErrorBaja(null)
    try {
      await eliminarProducto(aEliminar.id)
      setAEliminar(null)
      await recargar()
    } catch (e) {
      setErrorBaja(mensajeDe(e))
    } finally {
      setEliminando(false)
    }
  }

  const sinSecciones = !cargando && !errorCarga && secciones.length === 0

  return (
    <>
      <div className="bg-white rounded-2xl p-4 border border-borde shadow-xs flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              etiqueta="Todos"
              cantidad={productos.length}
              activo={filtroTipo === null}
              onClick={() => setFiltroTipo(null)}
            />
            {(Object.keys(TIPOS_PRODUCTO) as TipoProducto[]).map((t) => (
              <FilterChip
                key={t}
                etiqueta={TIPOS_PRODUCTO[t].etiqueta}
                cantidad={productos.filter((p) => p.tipo === t).length}
                activo={filtroTipo === t}
                onClick={() => setFiltroTipo(t)}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="filtro-seccion" className="sr-only">
              Filtrar por sección
            </label>
            <select
              id="filtro-seccion"
              value={filtroSeccion ?? ''}
              onChange={(e) => setFiltroSeccion(e.target.value ? Number(e.target.value) : null)}
              className="h-9 px-3 bg-white border border-borde rounded-xl text-xs text-slate-700 outline-none focus:ring-2 focus:ring-brand-600"
            >
              <option value="">Todas las secciones</option>
              {secciones.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            {!sinSecciones && (
              <Button icono="add_circle" onClick={() => setForm('nuevo')} disabled={cargando}>
                Nuevo producto
              </Button>
            )}
          </div>
        </div>
        {sinSecciones && (
          <Alert tono="info">
            Primero tenés que crear una sección de la carta.{' '}
            <Link to="/carta/secciones" className="font-bold underline">
              Ir a Secciones
            </Link>
          </Alert>
        )}
        {errorCarga && <Alert tono="error">{errorCarga}</Alert>}
      </div>

      <div className="bg-white rounded-2xl border border-borde shadow-xs overflow-hidden">
        {cargando ? (
          <p className="p-12 text-center text-sm text-slate-400">Cargando productos…</p>
        ) : visibles.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
            <Icon name="restaurant" className="text-3xl text-slate-300" />
            <span>
              {productos.length === 0
                ? 'Todavía no hay productos cargados'
                : 'No hay productos con estos filtros'}
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-amber-50/50 border-b border-borde text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Sección</th>
                  <th className="py-3 px-4 text-right">Precio</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {visibles.map((p) => (
                  <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900">
                        {p.volumen_ml ? `${p.nombre} · ${p.volumen_ml} ml` : p.nombre}
                      </span>
                      {p.descripcion && (
                        <span className="block text-xs text-slate-500 truncate max-w-xs">
                          {p.descripcion}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon
                          name={TIPOS_PRODUCTO[p.tipo].icono}
                          className="text-base text-brand-600"
                        />
                        {TIPOS_PRODUCTO[p.tipo].etiqueta}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {nombreSeccion.get(p.seccion_id) ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-right tabular font-semibold text-slate-900">
                      {formatMoneda(p.precio)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setForm(p)}
                          aria-label={`Editar ${p.nombre}`}
                          title="Editar"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-brand-700 hover:bg-amber-100/70 transition-colors"
                        >
                          <Icon name="edit" className="text-base" />
                        </button>
                        <button
                          type="button"
                          onClick={() => pedirBaja(p)}
                          aria-label={`Eliminar ${p.nombre}`}
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
          </div>
        )}
      </div>

      {form !== null && (
        <ProductoForm
          producto={form === 'nuevo' ? null : form}
          secciones={secciones}
          onCerrar={cerrarForm}
          onGuardado={alGuardar}
        />
      )}

      <Modal
        abierto={aEliminar !== null}
        onCerrar={cerrarBaja}
        titulo="Eliminar producto"
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
          <p>¿Eliminar {aEliminar?.nombre}? Deja de aparecer en la carta.</p>
          {errorBaja && <Alert tono="error">{errorBaja}</Alert>}
        </div>
      </Modal>
    </>
  )
}
