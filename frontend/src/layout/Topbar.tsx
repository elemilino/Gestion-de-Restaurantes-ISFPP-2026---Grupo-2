import { Icon } from '../components/Icon'
import { formatMoneda } from '../lib/format'

/*
 * MOCK: los sectores, el turno y la caja son fijos del prototipo.
 * Sectores → HU-01a; turno → HU-02/HU-05; caja del turno → HU-08.
 */
const CAJA_TURNO = 1842500
const SECTORES = ['Salón Principal', 'Terraza', 'Patio']

export function Topbar() {
  return (
    <header className="sticky top-0 h-16 bg-white/95 backdrop-blur-md border-b border-amber-100/80 z-40 px-6 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-4">
        <div className="flex items-center p-1 rounded-xl bg-amber-50/80 border border-amber-200/70">
          {SECTORES.map((sector, i) => (
            <button
              key={sector}
              type="button"
              className={
                i === 0
                  ? 'px-3.5 py-1.5 rounded-lg bg-white text-brand-900 font-bold text-xs shadow-xs border border-amber-200/40 flex items-center gap-1.5'
                  : 'px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold text-xs transition-colors'
              }
            >
              {i === 0 && <span className="w-2 h-2 rounded-full bg-brand-500" />}
              {sector}
            </button>
          ))}
        </div>
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-900 text-xs font-semibold">
          <Icon name="restaurant" className="text-sm text-brand-600" />
          <span>Turno: Restaurante</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-56 sm:w-64">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg"
          />
          <input
            type="text"
            placeholder="Buscar mesa o mozo…"
            className="w-full h-9 pl-9 pr-3 bg-amber-50/50 hover:bg-white focus:bg-white border border-amber-200/80 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-brand-50 border border-brand-200/70">
          <span className="text-[10px] font-bold text-brand-800 uppercase tracking-wider">
            Caja turno:
          </span>
          <span className="text-sm font-extrabold text-brand-900 whitespace-nowrap tabular">
            {formatMoneda(CAJA_TURNO)}
          </span>
        </div>
        <button
          type="button"
          title="Avisos"
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white hover:bg-amber-50 text-slate-700 border border-amber-200/70 transition-colors"
        >
          <Icon name="notifications" className="text-lg" />
        </button>
      </div>
    </header>
  )
}
