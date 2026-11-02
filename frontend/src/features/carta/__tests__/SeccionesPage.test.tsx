import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import { crearSeccion, eliminarSeccion, listarSecciones } from '../api'
import { SeccionesPage } from '../SeccionesPage'

vi.mock('../api')

const SECCIONES = [
  { id: 1, nombre: 'Entradas', orden: 1, cantidad_productos: 2 },
  { id: 2, nombre: 'Pastas', orden: 2, cantidad_productos: 5 },
]

describe('SeccionesPage', () => {
  beforeEach(() => {
    vi.mocked(listarSecciones).mockReset().mockResolvedValue(SECCIONES)
    vi.mocked(crearSeccion).mockReset()
    vi.mocked(eliminarSeccion).mockReset()
  })

  it('muestra las secciones en orden con su cantidad de productos', async () => {
    render(<SeccionesPage />)
    const filas = await screen.findAllByRole('row')
    // Encabezado + 2 secciones
    expect(filas).toHaveLength(3)
    expect(filas[1]).toHaveTextContent('1Entradas2')
    expect(filas[2]).toHaveTextContent('2Pastas5')
  })

  it('muestra el estado vacío si no hay secciones', async () => {
    vi.mocked(listarSecciones).mockResolvedValue([])
    render(<SeccionesPage />)
    expect(await screen.findByText('Todavía no hay secciones. Creá la primera')).toBeInTheDocument()
  })

  it('muestra el error del backend al crear (CA2)', async () => {
    vi.mocked(crearSeccion).mockRejectedValue(
      new ApiError(409, 'Ya existe una sección con ese nombre', 'SECCION_DUPLICADA'),
    )
    render(<SeccionesPage />)
    fireEvent.click(await screen.findByText('Nueva sección'))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'entradas' } })
    fireEvent.click(screen.getByText('Guardar'))
    expect(await screen.findByText('Ya existe una sección con ese nombre')).toBeInTheDocument()
    expect(crearSeccion).toHaveBeenCalledWith({ nombre: 'entradas' })
  })

  it('no envía un nombre de 2 caracteres (CA3)', async () => {
    render(<SeccionesPage />)
    fireEvent.click(await screen.findByText('Nueva sección'))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'ab' } })
    fireEvent.click(screen.getByText('Guardar'))
    expect(
      await screen.findByText('El nombre debe tener entre 3 y 50 caracteres'),
    ).toBeInTheDocument()
    expect(crearSeccion).not.toHaveBeenCalled()
  })

  it('muestra el motivo si la eliminación está bloqueada (CA6)', async () => {
    vi.mocked(eliminarSeccion).mockRejectedValue(
      new ApiError(
        409,
        'No se puede eliminar la sección Pastas: tiene 5 productos activos',
        'SECCION_CON_PRODUCTOS',
      ),
    )
    render(<SeccionesPage />)
    fireEvent.click(await screen.findByLabelText('Eliminar Pastas'))
    expect(screen.getByText('¿Eliminar la sección Pastas?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await waitFor(() =>
      expect(
        screen.getByText('No se puede eliminar la sección Pastas: tiene 5 productos activos'),
      ).toBeInTheDocument(),
    )
  })
})
