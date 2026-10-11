import { TONOS, type Tono } from './tonos'

interface FilterChipProps {
  etiqueta: string
  cantidad?: number
  /** Sin tono, el chip es neutro (ej. "Todas"). */
  tono?: Tono
  activo?: boolean
  onClick?: () => void
}

/** Chip de filtro con contador, como los filtros de estado de la pantalla de Mesas. */
export function FilterChip({ etiqueta, cantidad, tono, activo = false, onClick }: FilterChipProps) {
  const estilo = activo
    ? 'bg-slate-900 text-white'
    : tono
      ? `${TONOS[tono].badge} border border-black/5 hover:brightness-95`
      : 'bg-white text-slate-600 border border-borde hover:bg-canvas'

  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors ${estilo}`}
    >
      {tono && !activo && <span className={`w-2 h-2 rounded-full ${TONOS[tono].punto}`} />}
      <span>{etiqueta}</span>
      {cantidad !== undefined && (
        <span className="bg-black/10 px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none">
          {cantidad}
        </span>
      )}
    </button>
  )
}
