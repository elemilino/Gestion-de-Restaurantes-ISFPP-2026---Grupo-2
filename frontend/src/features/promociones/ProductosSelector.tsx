import { useState } from 'react'

import { Alert } from '../../components/Alert'
import { Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import type { Producto, Seccion } from '../carta/types'
import type { Promocion, PromocionProducto } from './types'

/** Minúsculas y sin tildes, para buscar productos en español. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

interface ProductosSelectorProps {
  productos: Producto[]
  secciones: Seccion[]
  seleccionados: number[]
  /** Productos ya vinculados a la promoción, aunque hoy no estén activos. */
  productosDePromocion: PromocionProducto[]
  conflictos: Map<number, Promocion[]>
  cargando: boolean
  error: string | null
  errorSeleccion?: string
  onAlternar: (id: number) => void
  onSeleccionarVisibles: (ids: number[]) => void
  onLimpiar: () => void
}

/**
 * Búsqueda y selección de productos de la carta, agrupados por sección.
 * Marca los productos que chocan con otra promoción y los que ya no están activos.
 */
export function ProductosSelector({
  productos,
  secciones,
  seleccionados,
  productosDePromocion,
  conflictos,
  cargando,
  error,
  errorSeleccion,
  onAlternar,
  onSeleccionarVisibles,
  onLimpiar,
}: ProductosSelectorProps) {
  const [busqueda, setBusqueda] = useState('')
  const seleccionadosSet = new Set(seleccionados)
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
  const inactivos = productosDePromocion
    .filter((p) => !productos.some((activo) => activo.id === p.id))
    .filter((p) => !texto || normalizar(p.nombre).includes(texto))

  function detalleConflicto(id: number): string | undefined {
    const lista = conflictos.get(id)
    if (!lista || lista.length === 0) return undefined
    return `Ya en: ${lista.map((p) => p.descripcion).join(', ')}`
  }

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
          checked={seleccionadosSet.has(id)}
          onChange={() => onAlternar(id)}
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
    <Field
      label={`Productos (${seleccionados.length} seleccionados)`}
      error={errorSeleccion}
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
            onClick={() => onSeleccionarVisibles(visibles.map((p) => p.id))}
            className="text-[11px] font-bold text-brand-700 hover:underline shrink-0"
          >
            Seleccionar visibles
          </button>
          <button
            type="button"
            onClick={onLimpiar}
            className="text-[11px] font-bold text-slate-500 hover:underline shrink-0"
          >
            Limpiar
          </button>
        </div>

        {cargando ? (
          <p className="p-6 text-center text-xs text-slate-400">Cargando productos…</p>
        ) : error ? (
          <Alert tono="error">{error}</Alert>
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
  )
}
