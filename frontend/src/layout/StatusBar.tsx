/* MOCK: el turno es fijo hasta que HU-02/HU-05 definan cómo se calcula. */
export function StatusBar() {
  return (
    <footer className="sticky bottom-0 z-30 px-6 py-3 bg-white/95 backdrop-blur-md border-t border-amber-200/80 shadow-md flex items-center gap-2 text-xs font-semibold text-slate-700">
      <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse" />
      <span>
        Turno: <strong className="text-slate-900">Restaurante</strong>
      </span>
    </footer>
  )
}
