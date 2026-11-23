import { Icon } from '../../components/Icon'
import { StatusBadge } from '../../components/StatusBadge'
import { formatMoneda } from '../../lib/format'
import { TIPOS_CARTA } from './tiposProducto'
import type { ProductoCarta } from './types'

/** Tarjeta de un producto en "Ver carta" (HU-03b). Atenuada si no está disponible. */
export function ProductoCard({ producto }: { producto: ProductoCarta }) {
  const tipo = TIPOS_CARTA[producto.tipo]
  const descuento = producto.descuento_porcentaje ? Number(producto.descuento_porcentaje) : 0
  const tienePromo = descuento > 0
  const precioFinal =
    tienePromo && producto.precio_final
      ? producto.precio_final
      : tienePromo
        ? String((Number(producto.precio) * (100 - descuento)) / 100)
        : producto.precio

  return (
    <article
      aria-label={producto.nombre}
      className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all p-4 flex flex-col gap-2 ${
        tienePromo ? 'border-emerald-300 ring-1 ring-emerald-200/60' : 'border-borde'
      } ${producto.disponible ? '' : 'opacity-60'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="font-bold text-sm text-slate-900">{producto.nombre}</h3>
          {tienePromo && (
            <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase tracking-wider">
              <Icon name="local_offer" className="text-xs" />-{descuento}%
              {producto.promocion_descripcion ? ` · ${producto.promocion_descripcion}` : ''}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end shrink-0 tabular">
          {tienePromo ? (
            <>
              <span
                aria-label="Precio original"
                className="text-xs text-slate-400 line-through font-semibold"
              >
                {formatMoneda(producto.precio)}
              </span>
              <span
                aria-label="Precio con descuento"
                className="font-extrabold text-sm text-emerald-700"
              >
                {formatMoneda(precioFinal)}
              </span>
            </>
          ) : (
            <span className="font-extrabold text-sm text-slate-900">
              {formatMoneda(producto.precio)}
            </span>
          )}
        </div>
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
