/** Colores del semáforo de estados de DESIGN.md (sirve para mesas, comandas y reservas). */
export type Tono = 'libre' | 'ocupado' | 'pendiente' | 'reservado' | 'inactivo'

export const TONOS: Record<Tono, { badge: string; punto: string }> = {
  libre: { badge: 'bg-status-free-bg text-status-free-text', punto: 'bg-status-free' },
  ocupado: { badge: 'bg-status-busy-bg text-status-busy-text', punto: 'bg-status-busy' },
  pendiente: {
    badge: 'bg-brand-100 text-brand-900 border border-brand-200',
    punto: 'bg-status-waiting',
  },
  reservado: {
    badge: 'bg-status-reserved-bg text-status-reserved-text',
    punto: 'bg-status-reserved',
  },
  inactivo: { badge: 'bg-stone-100 text-stone-500', punto: 'bg-status-inactive' },
}
