import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { COMANDA } from '../../comandas/__tests__/datos'
import type { MesaTablero } from '../../comandas/types'
import { MesaCard } from '../MesaCard'
import { aVista, urgenciaReserva } from '../mesaVista'

const AHORA = new Date('2026-11-23T14:00:00')

function mesa(cambios: Partial<MesaTablero> = {}): MesaTablero {
  return {
    id: 1,
    numero: 1,
    capacidad: 4,
    sector_id: 1,
    sector_nombre: 'Salón Principal',
    estado_mesa: 'libre',
    comanda: null,
    reserva_hoy: null,
    ...cambios,
  }
}

function reserva(fecha_hora: string) {
  return { id: 9, fecha_hora, cliente: 'Pérez, Juan', cantidad_comensales: 4 }
}

describe('urgenciaReserva', () => {
  it('escala por cercanía: > 60 normal, ≤ 60 próxima, ≤ 15 inminente', () => {
    expect(urgenciaReserva(61)).toBe('normal')
    expect(urgenciaReserva(60)).toBe('proxima')
    expect(urgenciaReserva(16)).toBe('proxima')
    expect(urgenciaReserva(15)).toBe('inminente')
    expect(urgenciaReserva(0)).toBe('inminente')
  })
})

describe('MesaCard (estado operativo + aviso de reserva)', () => {
  it('mesa libre sin reserva: verde y botón Abrir comanda', () => {
    render(<MesaCard mesa={aVista(mesa(), AHORA)} />)
    expect(screen.getByText('Libre')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Abrir comanda/ })).toBeInTheDocument()
    expect(screen.queryByText(/Reserva/)).not.toBeInTheDocument()
  })

  it('mesa libre con reserva lejana: sigue libre y usable, con aviso azul', () => {
    const vista = aVista(mesa({ reserva_hoy: reserva('2026-11-23T21:00:00') }), AHORA)
    render(<MesaCard mesa={vista} />)
    expect(screen.getByText('Libre')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Abrir comanda/ })).toBeInTheDocument()
    const aviso = screen.getByText(/Reserva 21:00/)
    expect(aviso.textContent).toContain('4 pers.')
    expect(aviso.textContent).toContain('en 7h 0m')
    expect(aviso.closest('.rounded-xl')?.className).toContain('bg-blue-50')
    expect(screen.getAllByText('Pérez, Juan').length).toBeGreaterThan(0)
  })

  it('mesa libre con reserva en menos de una hora: aviso ámbar', () => {
    const vista = aVista(mesa({ reserva_hoy: reserva('2026-11-23T14:45:00') }), AHORA)
    render(<MesaCard mesa={vista} />)
    const aviso = screen.getByText(/Reserva 14:45/)
    expect(aviso.textContent).toContain('en 45 min')
    expect(aviso.closest('.rounded-xl')?.className).toContain('bg-amber-50')
    expect(screen.getByRole('button', { name: /Abrir comanda/ })).toBeInTheDocument()
  })

  it('mesa ocupada con reserva inminente: aviso rojo para liberar la mesa', () => {
    const vista = aVista(
      mesa({
        estado_mesa: 'ocupada',
        comanda: COMANDA,
        reserva_hoy: reserva('2026-11-23T14:10:00'),
      }),
      AHORA,
    )
    render(<MesaCard mesa={vista} />)
    expect(screen.getByText('Ocupada')).toBeInTheDocument()
    expect(screen.getByText('Liberar mesa antes de las 14:10')).toBeInTheDocument()
    const aviso = screen.getByText(/Reserva 14:10/)
    expect(aviso.closest('.rounded-xl')?.className).toContain('bg-rose-50')
    expect(screen.getByRole('button', { name: /Ver comanda/ })).toBeInTheDocument()
  })

  it('mesa ocupada con reserva lejana: muestra el titular sin pedir liberar', () => {
    const vista = aVista(
      mesa({
        estado_mesa: 'ocupada',
        comanda: COMANDA,
        reserva_hoy: reserva('2026-11-23T21:00:00'),
      }),
      AHORA,
    )
    render(<MesaCard mesa={vista} />)
    expect(screen.queryByText(/Liberar mesa/)).not.toBeInTheDocument()
    expect(screen.getByText(/Reserva 21:00/)).toBeInTheDocument()
  })

  it('mesa esperando cobro con reserva: mantiene su estado y suma el aviso', () => {
    const vista = aVista(
      mesa({
        estado_mesa: 'esperando_cobro',
        comanda: { ...COMANDA, estado: 'CERRADA', abierta: false },
        reserva_hoy: reserva('2026-11-23T21:00:00'),
      }),
      AHORA,
    )
    render(<MesaCard mesa={vista} />)
    expect(screen.getByText('Esperando cobro')).toBeInTheDocument()
    expect(screen.getByText(/Reserva 21:00/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ver comanda/ })).toBeInTheDocument()
  })
})
