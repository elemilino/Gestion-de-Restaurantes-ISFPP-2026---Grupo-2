import { Icon } from '../../components/Icon'
import { StatusBadge } from '../../components/StatusBadge'
import { formatMoneda } from '../../lib/format'
import { TIPOS_CARTA } from './tiposProducto'
import type { ProductoCarta } from './types'

/** Tarjeta de un producto en "Ver carta" (HU-03b). Atenuada si no está disponible. */
export function ProductoCard({ producto }: { producto: ProductoCarta }) {
  const tipo = TIPOS_CARTA[producto.tipo]

  return (
    <article
      aria-label={producto.nombre}
      className={`bg-white rounded-2xl border border-borde shadow-sm hover:shadow-md transition-all p-4 flex flex-col gap-2 ${
        producto.disponible ? '' : 'opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold text-sm text-slate-900">{producto.nombre}</h3>
        <span className="tabular font-extrabold text-sm text-slate-900 shrink-0">
          {formatMoneda(producto.precio)}
        </span>
      </div>

      {producto.descripcion && (
        <p className="text-xs text-slate-500 line-clamp-2">{producto.descripcion}</p>
      )}

      <div className="mt-auto pt-1 flex items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 font-semibold">
            <Icon name={tipo.icono} className="text-base text-brand-600" />
            {tipo.etiqueta}
          </span>
          {producto.porcion_gramos && <span className="tabular">{producto.porcion_gramos} g</span>}
          {producto.volumen_ml && <span className="tabular">{producto.volumen_ml} ml</span>}
          {producto.alcoholica && (
            <span title="Con alcohol" aria-label="Con alcohol" className="inline-flex">
              <Icon name="liquor" className="text-base text-slate-500" />
            </span>
          )}
        </div>
        {!producto.disponible && <StatusBadge tono="inactivo">No disponible</StatusBadge>}
      </div>
    </article>
  )
}
