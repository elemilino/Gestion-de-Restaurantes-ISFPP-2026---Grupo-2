import { TONOS, type Tono } from './tonos'

export function StatusBadge({ tono, children }: { tono: Tono; children: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 shrink-0 ${TONOS[tono].badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONOS[tono].punto}`} />
      <span className="truncate">{children}</span>
    </span>
  )
}
