import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import { crearSector, eliminarSector, listarSectores, modificarSector } from '../api'
import { SectoresPage } from '../SectoresPage'

vi.mock('../api')

const SECTORES = [
  { id: 1, nombre: 'Patio', descripcion: null, cantidad_mesas: 0 },
  { id: 2, nombre: 'Terraza', descripcion: 'Al aire libre', cantidad_mesas: 3 },
]

describe('SectoresPage', () => {
  beforeEach(() => {
    vi.mocked(listarSectores).mockReset().mockResolvedValue(SECTORES)
    vi.mocked(crearSector).mockReset()
    vi.mocked(modificarSector).mockReset()
    vi.mocked(eliminarSector).mockReset()
  })

  it('lista nombre, descripción y cantidad de mesas (CA6)', async () => {
    render(<SectoresPage />)
    const filas = await screen.findAllByRole('row')
    expect(filas).toHaveLength(3)
    expect(filas[1]).toHaveTextContent('Patio—0')
    expect(filas[2]).toHaveTextContent('TerrazaAl aire libre3')
  })

  it('muestra el estado vacío si no hay sectores', async () => {
    vi.mocked(listarSectores).mockResolvedValue([])
    render(<SectoresPage />)
    expect(await screen.findByText('Todavía no hay sectores. Creá el primero')).toBeInTheDocument()
  })

  it('crea un sector con descripción opcional (CA1)', async () => {
    vi.mocked(crearSector).mockResolvedValue({
      id: 3,
      nombre: 'Barra',
      descripcion: null,
      cantidad_mesas: 0,
    })
    render(<SectoresPage />)
    fireEvent.click(await screen.findByText('Nuevo sector'))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  Barra ' } })
    fireEvent.click(screen.getByText('Guardar'))
    await waitFor(() =>
      expect(crearSector).toHaveBeenCalledWith({ nombre: 'Barra', descripcion: null }),
    )
  })

  it('no envía un nombre vacío', async () => {
    render(<SectoresPage />)
    fireEvent.click(await screen.findByText('Nuevo sector'))
    fireEvent.click(screen.getByText('Guardar'))
    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument()
    expect(crearSector).not.toHaveBeenCalled()
  })

  it('muestra el error del backend por nombre duplicado (CA2)', async () => {
    vi.mocked(crearSector).mockRejectedValue(
      new ApiError(409, 'Ya existe un sector con ese nombre', 'SECTOR_DUPLICADO'),
    )
    render(<SectoresPage />)
    fireEvent.click(await screen.findByText('Nuevo sector'))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'terraza' } })
    fireEvent.click(screen.getByText('Guardar'))
    expect(await screen.findByText('Ya existe un sector con ese nombre')).toBeInTheDocument()
  })

  it('edita un sector con sus datos cargados (CA3)', async () => {
    vi.mocked(modificarSector).mockResolvedValue({ ...SECTORES[1], nombre: 'Terraza alta' })
    render(<SectoresPage />)
    fireEvent.click(await screen.findByLabelText('Editar Terraza'))
    expect(screen.getByLabelText('Descripción')).toHaveValue('Al aire libre')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Terraza alta' } })
    fireEvent.click(screen.getByText('Guardar'))
    await waitFor(() =>
      expect(modificarSector).toHaveBeenCalledWith(2, {
        nombre: 'Terraza alta',
        descripcion: 'Al aire libre',
      }),
    )
  })

  it('muestra el motivo si la eliminación está bloqueada (CA5)', async () => {
    const mensaje =
      'No se puede eliminar el sector Terraza: tiene 3 mesas activas. ' +
      'Primero reubicá o eliminá sus mesas'
    vi.mocked(eliminarSector).mockRejectedValue(new ApiError(409, mensaje, 'SECTOR_CON_MESAS'))
    render(<SectoresPage />)
    fireEvent.click(await screen.findByLabelText('Eliminar Terraza'))
    expect(screen.getByText('¿Eliminar el sector Terraza?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText(mensaje)).toBeInTheDocument()
  })
})
