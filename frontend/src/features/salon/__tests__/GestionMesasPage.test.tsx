import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import { crearMesa, eliminarMesa, listarMesas, listarSectores, modificarMesa } from '../api'
import { GestionMesasPage } from '../GestionMesasPage'
import type { Mesa } from '../types'

vi.mock('../api')

const SECTORES = [
  { id: 1, nombre: 'Salón Principal', descripcion: null, cantidad_mesas: 2 },
  { id: 2, nombre: 'Terraza', descripcion: null, cantidad_mesas: 1 },
]

const MESAS: Mesa[] = [
  {
    id: 1,
    numero: 1,
    capacidad: 4,
    sector_id: 1,
    sector_nombre: 'Salón Principal',
    disponibilidad: 'OCUPADA',
  },
  {
    id: 2,
    numero: 2,
    capacidad: 2,
    sector_id: 1,
    sector_nombre: 'Salón Principal',
    disponibilidad: 'LIBRE',
  },
  {
    id: 3,
    numero: 3,
    capacidad: 6,
    sector_id: 2,
    sector_nombre: 'Terraza',
    disponibilidad: 'RESERVADA',
  },
]

describe('GestionMesasPage', () => {
  beforeEach(() => {
    vi.mocked(listarSectores).mockReset().mockResolvedValue(SECTORES)
    vi.mocked(listarMesas).mockReset().mockResolvedValue(MESAS)
    vi.mocked(crearMesa).mockReset()
    vi.mocked(modificarMesa).mockReset()
    vi.mocked(eliminarMesa).mockReset()
  })

  it('lista número, capacidad, sector y disponibilidad (CA8)', async () => {
    render(<GestionMesasPage />)
    const filas = await screen.findAllByRole('row')
    expect(filas).toHaveLength(4)
    expect(filas[1]).toHaveTextContent('14 personasSalón PrincipalOcupada')
    expect(filas[3]).toHaveTextContent('36 personasTerrazaReservada')
  })

  it('filtra por sector (CA8)', async () => {
    render(<GestionMesasPage />)
    await screen.findAllByRole('row')
    await screen.findByRole('option', { name: 'Terraza' })
    fireEvent.change(screen.getByLabelText('Filtrar por sector'), { target: { value: '2' } })
    await waitFor(() => expect(listarMesas).toHaveBeenLastCalledWith(2))
  })

  it('informa que el listado está vacío (CA8)', async () => {
    vi.mocked(listarMesas).mockResolvedValue([])
    render(<GestionMesasPage />)
    expect(await screen.findByText('El listado de mesas está vacío')).toBeInTheDocument()
  })

  it('no deja crear mesas si no hay sectores', async () => {
    vi.mocked(listarSectores).mockResolvedValue([])
    vi.mocked(listarMesas).mockResolvedValue([])
    render(<GestionMesasPage />)
    expect(await screen.findByText(/primero creá un sector/)).toBeInTheDocument()
    expect(screen.getByText('Nueva mesa').closest('button')).toBeDisabled()
  })

  it('crea una mesa (CA1)', async () => {
    vi.mocked(crearMesa).mockResolvedValue({ ...MESAS[1], id: 4, numero: 9 })
    render(<GestionMesasPage />)
    await screen.findByRole('option', { name: 'Terraza' })
    fireEvent.click(screen.getByText('Nueva mesa'))
    fireEvent.change(screen.getByLabelText('Número'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Capacidad'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Sector'), { target: { value: '2' } })
    fireEvent.click(screen.getByText('Guardar'))
    await waitFor(() =>
      expect(crearMesa).toHaveBeenCalledWith({ numero: 9, capacidad: 4, sector_id: 2 }),
    )
  })

  it('no envía una capacidad de 0 (CA3)', async () => {
    render(<GestionMesasPage />)
    fireEvent.click(await screen.findByLabelText('Editar mesa 2'))
    fireEvent.change(screen.getByLabelText('Capacidad'), { target: { value: '0' } })
    fireEvent.click(screen.getByText('Guardar'))
    expect(await screen.findByText('La capacidad debe ser mayor a 0')).toBeInTheDocument()
    expect(modificarMesa).not.toHaveBeenCalled()
  })

  it('muestra el error del backend por número duplicado (CA2)', async () => {
    vi.mocked(modificarMesa).mockRejectedValue(
      new ApiError(409, 'Ya existe una mesa activa con el número 1', 'MESA_DUPLICADA'),
    )
    render(<GestionMesasPage />)
    fireEvent.click(await screen.findByLabelText('Editar mesa 2'))
    fireEvent.change(screen.getByLabelText('Número'), { target: { value: '1' } })
    fireEvent.click(screen.getByText('Guardar'))
    expect(await screen.findByText('Ya existe una mesa activa con el número 1')).toBeInTheDocument()
    expect(modificarMesa).toHaveBeenCalledWith(2, { numero: 1, capacidad: 2, sector_id: 1 })
  })

  it('informa que se dio de baja la mesa (CA6)', async () => {
    vi.mocked(eliminarMesa).mockResolvedValue(undefined)
    render(<GestionMesasPage />)
    fireEvent.click(await screen.findByLabelText('Eliminar mesa 2'))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText('Se dio de baja la mesa 2')).toBeInTheDocument()
    expect(eliminarMesa).toHaveBeenCalledWith(2)
  })

  it('muestra las reservas o comandas que bloquean la eliminación (CA7)', async () => {
    const mensaje =
      'No se puede eliminar la mesa 3: tiene la reserva #1 del 04/11/2026 21:00 activa'
    vi.mocked(eliminarMesa).mockRejectedValue(new ApiError(409, mensaje, 'MESA_EN_USO'))
    render(<GestionMesasPage />)
    fireEvent.click(await screen.findByLabelText('Eliminar mesa 3'))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText(mensaje)).toBeInTheDocument()
  })
})
