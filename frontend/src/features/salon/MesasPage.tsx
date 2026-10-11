import { useState } from 'react'

import { Button } from '../../components/Button'
import { FilterChip } from '../../components/FilterChip'
import type { Tono } from '../../components/tonos'
import { MesaCard } from './MesaCard'
import { MESAS_MOCK, type EstadoMesa } from './mesas.mock'

const FILTROS: { estado: EstadoMesa; etiqueta: string; tono: Tono }[] = [
  { estado: 'libre', etiqueta: 'Libres', tono: 'libre' },
  { estado: 'ocupada', etiqueta: 'Ocupadas', tono: 'ocupado' },
  { estado: 'esperando_cobro', etiqueta: 'Esperando cobro', tono: 'pendiente' },
  { estado: 'reservada', etiqueta: 'Reservadas', tono: 'reservado' },
]

/**
 * Tablero de mesas del salón (pantalla de Stitch) con datos de prueba.
 * Es la referencia de cómo pasar una pantalla de Stitch a React.
 * Los botones todavía no hacen nada: los conectan HU-01b, HU-05, HU-08 y HU-11b.
 */
export function MesasPage() {
  const [filtro, setFiltro] = useState<EstadoMesa | null>(null)
  const mesas = MESAS_MOCK
  const visibles = filtro ? mesas.filter((m) => m.estado === filtro) : mesas

  return (
    <>
      <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            etiqueta="Todas"
            cantidad={mesas.length}
            activo={filtro === null}
            onClick={() => setFiltro(null)}
          />
          {FILTROS.map((f) => (
            <FilterChip
              key={f.estado}
              etiqueta={f.etiqueta}
              tono={f.tono}
              cantidad={mesas.filter((m) => m.estado === f.estado).length}
              activo={filtro === f.estado}
              onClick={() => setFiltro(f.estado)}
            />
          ))}
        </div>
        <Button icono="add_circle" className="shadow-md shadow-brand-600/25">
          Nueva mesa
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visibles.map((mesa) => (
          <MesaCard key={mesa.numero} mesa={mesa} />
        ))}
      </div>
    </>
  )
}
