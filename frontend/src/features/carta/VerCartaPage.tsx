import { useEffect, useState } from 'react'

import { ApiError } from '../../api/client'
import { Alert } from '../../components/Alert'
import { FilterChip } from '../../components/FilterChip'
import { Icon } from '../../components/Icon'
import { verCarta } from './api'
import { ProductoCard } from './ProductoCard'
import type { Carta } from './types'

/** Texto sin mayúsculas ni tildes, para buscar "noquis" y encontrar "Ñoquis". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * HU-03b: la carta agrupada por sección, para cualquier usuario con sesión.
 * Se carga una vez; el filtro por sección y la búsqueda se aplican en el cliente.
 */
export function VerCartaPage() {
  const [carta, setCarta] = useState<Carta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seccionElegida, setSeccionElegida] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    let montado = true
    verCarta()
      .then((datos) => montado && setCarta(datos))
      .catch(
        (e) =>
          montado && setError(e instanceof ApiError ? e.message : 'No se pudo cargar la carta'),
      )
    return () => {
      montado = false
    }
  }, [])

  if (error) return <Alert tono="error">{error}</Alert>
  if (!carta) {
    return <p className="p-12 text-center text-sm text-slate-400">Cargando carta…</p>
  }

  if (carta.secciones.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-borde p-12 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
        <Icon name="menu_book" className="text-3xl text-slate-300" />
        <span>La carta no tiene productos cargados</span>
      </div>
    )
  }

  const texto = normalizar(busqueda)
  const visibles = carta.secciones
    .filter((s) => seccionElegida === null || s.id === seccionElegida)
    .map((s) => ({
      ...s,
      productos: s.productos.filter((p) => normalizar(p.nombre).includes(texto)),
    }))
    .filter((s) => s.productos.length > 0)

  return (
    <>
      <div className="bg-white rounded-2xl p-4 border border-borde shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            etiqueta="Todas"
            cantidad={carta.secciones.reduce((total, s) => total + s.productos.length, 0)}
            activo={seccionElegida === null}
            onClick={() => setSeccionElegida(null)}
          />
          {carta.secciones.map((s) => (
            <FilterChip
              key={s.id}
              etiqueta={s.nombre}
              cantidad={s.productos.length}
              activo={seccionElegida === s.id}
              onClick={() => setSeccionElegida(s.id)}
            />
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base"
          />
          <input
            type="search"
            aria-label="Buscar producto"
            placeholder="Buscar producto…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-white border border-borde rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-brand-600"
          />
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="p-12 text-center text-sm text-slate-500">
          No hay productos que coincidan con la búsqueda
        </p>
      ) : (
        visibles.map((s) => (
          <section key={s.id} aria-label={s.nombre} className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-slate-900">{s.nombre}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {s.productos.map((p) => (
                <ProductoCard key={p.id} producto={p} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  )
}
