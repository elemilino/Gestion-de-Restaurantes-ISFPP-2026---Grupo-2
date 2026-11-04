import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import { crearCliente, modificarCliente } from '../api'
import { ClienteForm } from '../ClienteForm'
import type { Cliente } from '../types'

vi.mock('../api')

function renderForm(cliente: Cliente | null = null) {
  const onGuardado = vi.fn()
  render(<ClienteForm cliente={cliente} onCerrar={() => {}} onGuardado={onGuardado} />)
  return onGuardado
}

function completar(campo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(campo), { target: { value: valor } })
}

describe('ClienteForm', () => {
  beforeEach(() => {
    vi.mocked(crearCliente).mockReset()
    vi.mocked(modificarCliente).mockReset()
  })

  it('crea un cliente con los datos cargados (CA1)', async () => {
    vi.mocked(crearCliente).mockResolvedValue({} as Cliente)
    const onGuardado = renderForm()

    completar('Nombre', 'Ana')
    completar('Apellido', 'López')
    completar('DNI', '30999888')
    completar('Teléfono', '1100001111')
    completar('Correo electrónico (opcional)', 'ana@example.com')
    fireEvent.click(screen.getByText('Guardar'))

    await vi.waitFor(() => expect(onGuardado).toHaveBeenCalled())
    expect(crearCliente).toHaveBeenCalledWith({
      nombre: 'Ana',
      apellido: 'López',
      telefono: '1100001111',
      dni: '30999888',
      email: 'ana@example.com',
    })
  })

  it('permite registrar un cliente sin email (CA1)', async () => {
    vi.mocked(crearCliente).mockResolvedValue({} as Cliente)
    const onGuardado = renderForm()

    completar('Nombre', 'Ana')
    completar('Apellido', 'López')
    completar('DNI', '30999888')
    completar('Teléfono', '1100001111')
    fireEvent.click(screen.getByText('Guardar'))

    await vi.waitFor(() => expect(onGuardado).toHaveBeenCalled())
    expect(crearCliente).toHaveBeenCalledWith(expect.objectContaining({ email: null }))
  })

  it('muestra cada error debajo de su campo y no envía (CA2)', () => {
    renderForm()
    completar('Nombre', 'A')
    completar('Apellido', 'B')
    completar('DNI', '123')
    completar('Teléfono', '123')
    completar('Correo electrónico (opcional)', 'no-es-email')
    fireEvent.click(screen.getByText('Guardar'))

    expect(screen.getByText('El nombre debe tener entre 2 y 50 caracteres')).toBeInTheDocument()
    expect(screen.getByText('El apellido debe tener entre 2 y 50 caracteres')).toBeInTheDocument()
    expect(screen.getByText('El DNI debe tener 7 u 8 dígitos')).toBeInTheDocument()
    expect(
      screen.getByText('El teléfono debe tener entre 6 y 20 caracteres válidos'),
    ).toBeInTheDocument()
    expect(screen.getByText('El correo electrónico no es válido')).toBeInTheDocument()
    expect(crearCliente).not.toHaveBeenCalled()
  })

  it('rechaza los campos obligatorios vacíos (CA2)', () => {
    renderForm()
    fireEvent.click(screen.getByText('Guardar'))

    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument()
    expect(screen.getByText('El apellido es obligatorio')).toBeInTheDocument()
    expect(screen.getByText('El DNI es obligatorio')).toBeInTheDocument()
    expect(screen.getByText('El teléfono es obligatorio')).toBeInTheDocument()
    expect(crearCliente).not.toHaveBeenCalled()
  })

  it('rechaza números en nombre y apellido (CA2)', () => {
    renderForm()
    completar('Nombre', 'Juan123')
    completar('Apellido', 'Pérez1')
    completar('DNI', '30999888')
    completar('Teléfono', '1100001111')
    fireEvent.click(screen.getByText('Guardar'))

    expect(
      screen.getByText('El nombre solo puede contener letras, espacios, apóstrofes y guiones'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('El apellido solo puede contener letras, espacios, apóstrofes y guiones'),
    ).toBeInTheDocument()
    expect(crearCliente).not.toHaveBeenCalled()
  })

  it('acepta nombres compuestos con tildes, ñ, apóstrofes y guiones (CA1)', async () => {
    vi.mocked(crearCliente).mockResolvedValue({} as Cliente)
    const onGuardado = renderForm()

    completar('Nombre', 'María José')
    completar('Apellido', "O'Connor-Pérez")
    completar('DNI', '30999888')
    completar('Teléfono', '1100001111')
    fireEvent.click(screen.getByText('Guardar'))

    await vi.waitFor(() => expect(onGuardado).toHaveBeenCalled())
    expect(crearCliente).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'María José',
        apellido: "O'Connor-Pérez",
      }),
    )
  })

  it('en edición rechaza números en el nombre (CA4)', () => {
    renderForm({
      id: 5,
      nombre: 'Laura',
      apellido: 'Gómez',
      telefono: '1144556677',
      dni: '33444555',
      email: null,
      eliminado: false,
    })

    completar('Nombre', 'Laura2')
    fireEvent.click(screen.getByText('Guardar'))

    expect(
      screen.getByText('El nombre solo puede contener letras, espacios, apóstrofes y guiones'),
    ).toBeInTheDocument()
    expect(modificarCliente).not.toHaveBeenCalled()
  })

  it('muestra el error del backend (CA3)', async () => {
    vi.mocked(crearCliente).mockRejectedValue(
      new ApiError(409, 'Ya existe un cliente asociado a ese DNI', 'CLIENTE_DNI_DUPLICADO'),
    )
    renderForm()

    completar('Nombre', 'Ana')
    completar('Apellido', 'López')
    completar('DNI', '30123456')
    completar('Teléfono', '1100001111')
    fireEvent.click(screen.getByText('Guardar'))

    expect(await screen.findByText('Ya existe un cliente asociado a ese DNI')).toBeInTheDocument()
  })

  it('en edición precarga los datos y llama a modificar (CA4)', async () => {
    vi.mocked(modificarCliente).mockResolvedValue({} as Cliente)
    const onGuardado = renderForm({
      id: 5,
      nombre: 'Laura',
      apellido: 'Gómez',
      telefono: '1144556677',
      dni: '33444555',
      email: null,
      eliminado: false,
    })

    expect(screen.getByLabelText('Nombre')).toHaveValue('Laura')
    expect(screen.getByLabelText('Correo electrónico (opcional)')).toHaveValue('')
    completar('Teléfono', '1199998888')
    fireEvent.click(screen.getByText('Guardar'))

    await vi.waitFor(() => expect(onGuardado).toHaveBeenCalled())
    expect(modificarCliente).toHaveBeenCalledWith(5, {
      nombre: 'Laura',
      apellido: 'Gómez',
      telefono: '1199998888',
      dni: '33444555',
      email: null,
    })
  })
})
