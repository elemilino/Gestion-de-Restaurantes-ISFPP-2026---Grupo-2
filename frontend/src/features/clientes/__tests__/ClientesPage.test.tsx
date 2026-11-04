import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import { crearCliente, eliminarCliente, listarClientes, modificarCliente } from '../api'
import { ClientesPage } from '../ClientesPage'
import type { Cliente } from '../types'

vi.mock('../api')

const CLIENTES: Cliente[] = [
  {
    id: 1,
    nombre: 'Juan',
    apellido: 'Pérez',
    telefono: '1122334455',
    dni: '30123456',
    email: 'juan.perez@example.com',
    eliminado: false,
  },
  {
    id: 2,
    nombre: 'Laura',
    apellido: 'Gómez',
    telefono: '1144556677',
    dni: '33444555',
    email: null,
    eliminado: false,
  },
]

function renderPagina() {
  render(<ClientesPage />)
}

function completar(campo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(campo), { target: { value: valor } })
}

describe('ClientesPage', () => {
  beforeEach(() => {
    vi.mocked(listarClientes).mockReset().mockResolvedValue(CLIENTES)
    vi.mocked(crearCliente).mockReset()
    vi.mocked(modificarCliente).mockReset()
    vi.mocked(eliminarCliente).mockReset()
  })

  it('lista los clientes con sus datos de contacto', async () => {
    renderPagina()
    const fila = (await screen.findByText('Pérez, Juan')).closest('tr')!
    expect(fila).toHaveTextContent('30123456')
    expect(fila).toHaveTextContent('1122334455')
    expect(fila).toHaveTextContent('juan.perez@example.com')
    expect(screen.getByText('Gómez, Laura').closest('tr')).toHaveTextContent('—')
  })

  it('muestra el estado vacío si no hay clientes', async () => {
    vi.mocked(listarClientes).mockResolvedValue([])
    renderPagina()
    expect(await screen.findByText('Todavía no hay clientes registrados')).toBeInTheDocument()
  })

  it('busca por nombre, apellido y DNI sin distinguir tildes', async () => {
    renderPagina()
    await screen.findByText('Pérez, Juan')
    const buscador = screen.getByLabelText('Buscar cliente')

    fireEvent.change(buscador, { target: { value: 'perez' } })
    expect(screen.getByText('Pérez, Juan')).toBeInTheDocument()
    expect(screen.queryByText('Gómez, Laura')).not.toBeInTheDocument()

    fireEvent.change(buscador, { target: { value: 'laura' } })
    expect(screen.queryByText('Pérez, Juan')).not.toBeInTheDocument()
    expect(screen.getByText('Gómez, Laura')).toBeInTheDocument()

    fireEvent.change(buscador, { target: { value: '3344' } })
    expect(screen.getByText('Gómez, Laura')).toBeInTheDocument()
    expect(screen.queryByText('Pérez, Juan')).not.toBeInTheDocument()
  })

  it('registra un cliente nuevo (CA1)', async () => {
    vi.mocked(crearCliente).mockResolvedValue({ ...CLIENTES[0], id: 3, dni: '30999888' })
    renderPagina()
    fireEvent.click(await screen.findByText('Nuevo cliente'))

    completar('Nombre', 'Ana')
    completar('Apellido', 'López')
    completar('DNI', '30999888')
    completar('Teléfono', '1100001111')
    completar('Correo electrónico (opcional)', 'ana@example.com')
    fireEvent.click(screen.getByText('Guardar'))

    await waitFor(() =>
      expect(crearCliente).toHaveBeenCalledWith({
        nombre: 'Ana',
        apellido: 'López',
        telefono: '1100001111',
        dni: '30999888',
        email: 'ana@example.com',
      }),
    )
  })

  it('edita un cliente con los datos precargados (CA4)', async () => {
    vi.mocked(modificarCliente).mockResolvedValue({ ...CLIENTES[0], telefono: '1199998888' })
    renderPagina()
    fireEvent.click(await screen.findByLabelText('Editar Juan Pérez'))

    expect(screen.getByLabelText('Nombre')).toHaveValue('Juan')
    expect(screen.getByLabelText('DNI')).toHaveValue('30123456')
    completar('Teléfono', '1199998888')
    fireEvent.click(screen.getByText('Guardar'))

    await waitFor(() =>
      expect(modificarCliente).toHaveBeenCalledWith(1, {
        nombre: 'Juan',
        apellido: 'Pérez',
        telefono: '1199998888',
        dni: '30123456',
        email: 'juan.perez@example.com',
      }),
    )
  })

  it('pide confirmación y da de baja un cliente (CA5)', async () => {
    vi.mocked(eliminarCliente).mockResolvedValue(undefined)
    renderPagina()
    fireEvent.click(await screen.findByLabelText('Eliminar Laura Gómez'))
    expect(screen.getByText(/¿Dar de baja a/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dar de baja' }))
    await waitFor(() => expect(eliminarCliente).toHaveBeenCalledWith(2))
  })

  it('muestra el error de DNI duplicado (CA3)', async () => {
    vi.mocked(crearCliente).mockRejectedValue(
      new ApiError(409, 'Ya existe un cliente asociado a ese DNI', 'CLIENTE_DNI_DUPLICADO'),
    )
    renderPagina()
    fireEvent.click(await screen.findByText('Nuevo cliente'))

    completar('Nombre', 'Ana')
    completar('Apellido', 'López')
    completar('DNI', '30123456')
    completar('Teléfono', '1100001111')
    fireEvent.click(screen.getByText('Guardar'))

    expect(await screen.findByText('Ya existe un cliente asociado a ese DNI')).toBeInTheDocument()
  })

  it('muestra el bloqueo de baja por reservas asociadas (CA6)', async () => {
    vi.mocked(eliminarCliente).mockRejectedValue(
      new ApiError(
        409,
        'No se puede eliminar el cliente: posee reservas asociadas',
        'CLIENTE_CON_RESERVAS',
      ),
    )
    renderPagina()
    fireEvent.click(await screen.findByLabelText('Eliminar Laura Gómez'))
    fireEvent.click(screen.getByRole('button', { name: 'Dar de baja' }))

    expect(
      await screen.findByText('No se puede eliminar el cliente: posee reservas asociadas.'),
    ).toBeInTheDocument()
  })
})
