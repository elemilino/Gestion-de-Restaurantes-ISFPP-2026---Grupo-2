import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import { crearBebida, crearPlato, crearPostre, modificarPlato } from '../api'
import { ProductoForm } from '../ProductoForm'
import type { Producto, Seccion } from '../types'

vi.mock('../api')

const SECCIONES: Seccion[] = [{ id: 7, nombre: 'Pastas', orden: 1, cantidad_productos: 0 }]

function renderForm(producto: Producto | null = null) {
  const onGuardado = vi.fn()
  render(
    <ProductoForm
      producto={producto}
      secciones={SECCIONES}
      onCerrar={() => {}}
      onGuardado={onGuardado}
    />,
  )
  return onGuardado
}

function completar(campo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(campo), { target: { value: valor } })
}

describe('ProductoForm', () => {
  beforeEach(() => {
    vi.mocked(crearPlato).mockReset()
    vi.mocked(crearPostre).mockReset()
    vi.mocked(crearBebida).mockReset()
    vi.mocked(modificarPlato).mockReset()
  })

  it('crea un plato con los datos cargados', async () => {
    vi.mocked(crearPlato).mockResolvedValue({} as Producto)
    const onGuardado = renderForm()
    completar('Nombre', 'Ñoquis con salsa')
    completar('Precio ($)', '5000')
    completar('Sección', '7')
    completar('Porción en gramos (opcional)', '350')
    fireEvent.click(screen.getByText('Guardar'))
    await vi.waitFor(() => expect(onGuardado).toHaveBeenCalled())
    expect(crearPlato).toHaveBeenCalledWith({
      nombre: 'Ñoquis con salsa',
      descripcion: null,
      precio: '5000',
      seccion_id: 7,
      porcion_gramos: 350,
    })
  })

  it('muestra cada error debajo de su campo y no envía (CA3)', () => {
    renderForm()
    completar('Nombre', 'ab')
    completar('Porción en gramos (opcional)', '0')
    fireEvent.click(screen.getByText('Guardar'))
    expect(screen.getByText('El nombre debe tener entre 3 y 60 caracteres')).toBeInTheDocument()
    expect(screen.getByText('El precio debe ser mayor a 0')).toBeInTheDocument()
    expect(screen.getByText('Elegí una sección')).toBeInTheDocument()
    expect(screen.getByText('La porción debe ser un número entero mayor a 0')).toBeInTheDocument()
    expect(crearPlato).not.toHaveBeenCalled()
  })

  it('muestra el error del backend (CA2)', async () => {
    vi.mocked(crearPlato).mockRejectedValue(
      new ApiError(409, 'Ya existe un plato con ese nombre', 'PRODUCTO_DUPLICADO'),
    )
    renderForm()
    completar('Nombre', 'Ñoquis con salsa')
    completar('Precio ($)', '5000')
    completar('Sección', '7')
    fireEvent.click(screen.getByText('Guardar'))
    expect(await screen.findByText('Ya existe un plato con ese nombre')).toBeInTheDocument()
  })

  it('en edición carga los datos, no deja cambiar el tipo y llama a modificar', async () => {
    vi.mocked(modificarPlato).mockResolvedValue({} as Producto)
    renderForm({
      id: 3,
      nombre: 'Ravioles',
      descripcion: null,
      precio: '4500.00',
      tipo: 'PLATO',
      seccion_id: 7,
      porcion_gramos: null,
      volumen_ml: null,
      alcoholica: null,
      disponible: true,
      stock: null,
      disponible_efectivo: true,
    })
    expect(screen.getByLabelText('Nombre')).toHaveValue('Ravioles')
    expect(screen.getByRole('radio', { name: /Postre/ })).toBeDisabled()
    completar('Precio ($)', '4800')
    fireEvent.click(screen.getByText('Guardar'))
    await vi.waitFor(() =>
      expect(modificarPlato).toHaveBeenCalledWith(3, expect.objectContaining({ precio: '4800' })),
    )
  })

  it('al elegir Postre muestra la porción y llama a crearPostre (HU-04b)', async () => {
    vi.mocked(crearPostre).mockResolvedValue({} as Producto)
    const onGuardado = renderForm()
    fireEvent.click(screen.getByRole('radio', { name: /Postre/ }))
    expect(screen.getByRole('radio', { name: /Postre/ })).toHaveAttribute('aria-checked', 'true')
    completar('Nombre', 'Flan casero')
    completar('Precio ($)', '3000')
    completar('Sección', '7')
    completar('Porción en gramos (opcional)', '120')
    fireEvent.click(screen.getByText('Guardar'))
    await vi.waitFor(() => expect(onGuardado).toHaveBeenCalled())
    expect(crearPostre).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Flan casero', porcion_gramos: 120 }),
    )
    expect(crearPlato).not.toHaveBeenCalled()
  })

  it('al elegir Bebida muestra volumen y alcohólica en lugar de la porción (HU-04c)', async () => {
    vi.mocked(crearBebida).mockResolvedValue({} as Producto)
    const onGuardado = renderForm()
    expect(screen.getByLabelText('Porción en gramos (opcional)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Bebida/ }))
    expect(screen.queryByLabelText('Porción en gramos (opcional)')).not.toBeInTheDocument()
    completar('Nombre', 'Cerveza tirada')
    completar('Precio ($)', '4000')
    completar('Sección', '7')
    fireEvent.click(screen.getByText('Guardar'))
    expect(screen.getByText('El volumen debe ser un número entero mayor a 0')).toBeInTheDocument()
    completar('Volumen (ml)', '500')
    fireEvent.click(screen.getByLabelText('¿Es alcohólica?'))
    fireEvent.click(screen.getByText('Guardar'))
    await vi.waitFor(() => expect(onGuardado).toHaveBeenCalled())
    expect(crearBebida).toHaveBeenCalledWith({
      nombre: 'Cerveza tirada',
      descripcion: null,
      precio: '4000',
      seccion_id: 7,
      volumen_ml: 500,
      alcoholica: true,
    })
  })
})
