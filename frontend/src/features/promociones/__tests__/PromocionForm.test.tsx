import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import { listarProductos, listarSecciones } from '../../carta/api'
import type { Producto, Seccion } from '../../carta/types'
import { crearPromocion, listarPromociones, modificarPromocion } from '../api'
import { PromocionForm } from '../PromocionForm'
import type { Promocion } from '../types'

vi.mock('../api')
vi.mock('../../carta/api')

const SECCIONES: Seccion[] = [{ id: 1, nombre: 'Platos', orden: 1, cantidad_productos: 2 }]

const PRODUCTOS: Producto[] = [
  {
    id: 10,
    nombre: 'Hamburguesa',
    descripcion: null,
    precio: '5000',
    tipo: 'PLATO',
    seccion_id: 1,
    porcion_gramos: 300,
    volumen_ml: null,
    alcoholica: null,
    disponible: true,
    stock: null,
    disponible_efectivo: true,
  },
  {
    id: 11,
    nombre: 'Pizza',
    descripcion: null,
    precio: '4500',
    tipo: 'PLATO',
    seccion_id: 1,
    porcion_gramos: 400,
    volumen_ml: null,
    alcoholica: null,
    disponible: true,
    stock: null,
    disponible_efectivo: true,
  },
]

const PROMOCION: Promocion = {
  id: 5,
  descripcion: 'Promo vieja',
  fecha_inicio: '2026-11-01',
  fecha_fin: '2026-11-30',
  descuento: '20.00',
  activo: true,
  vigente: true,
  productos: [{ id: 10, nombre: 'Hamburguesa' }],
}

function renderForm(promocion: Promocion | null = null) {
  const onGuardado = vi.fn()
  render(<PromocionForm promocion={promocion} onCerrar={() => {}} onGuardado={onGuardado} />)
  return onGuardado
}

function completar(campo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(campo), { target: { value: valor } })
}

describe('PromocionForm', () => {
  beforeEach(() => {
    vi.mocked(crearPromocion).mockReset()
    vi.mocked(modificarPromocion).mockReset()
    vi.mocked(listarPromociones).mockReset().mockResolvedValue([])
    vi.mocked(listarProductos).mockReset().mockResolvedValue(PRODUCTOS)
    vi.mocked(listarSecciones).mockReset().mockResolvedValue(SECCIONES)
  })

  it('crea una promoción con fechas dd/mm/aaaa y productos seleccionados (CA1)', async () => {
    vi.mocked(crearPromocion).mockResolvedValue({} as Promocion)
    const onGuardado = renderForm()
    await screen.findByLabelText('Hamburguesa')

    completar('Descripción', '2x1 en hamburguesas')
    completar('Descuento (%)', '50')
    completar('Desde', '01/12/2099')
    completar('Hasta', '10/12/2099')
    fireEvent.click(screen.getByLabelText('Hamburguesa'))
    fireEvent.click(screen.getByText('Guardar'))

    await vi.waitFor(() => expect(onGuardado).toHaveBeenCalled())
    expect(crearPromocion).toHaveBeenCalledWith({
      descripcion: '2x1 en hamburguesas',
      descuento: '50',
      fecha_inicio: '2099-12-01',
      fecha_fin: '2099-12-10',
      productos_ids: [10],
    })
  })

  it('valida obligatorios, descuento, fechas y productos (CA2 y CA3)', async () => {
    renderForm()
    await screen.findByLabelText('Hamburguesa')
    fireEvent.click(screen.getByText('Guardar'))

    expect(screen.getByText('La descripción es obligatoria')).toBeInTheDocument()
    expect(screen.getByText('El descuento es obligatorio')).toBeInTheDocument()
    expect(screen.getByText('La fecha de inicio es obligatoria')).toBeInTheDocument()
    expect(screen.getByText('La fecha de fin es obligatoria')).toBeInTheDocument()
    expect(screen.getByText('Seleccioná al menos un producto')).toBeInTheDocument()
    expect(crearPromocion).not.toHaveBeenCalled()
  })

  it('rechaza un descuento fuera de rango y un rango de fechas inválido', async () => {
    renderForm()
    await screen.findByLabelText('Hamburguesa')

    completar('Descripción', 'Promo')
    completar('Descuento (%)', '150')
    completar('Desde', '10/12/2099')
    completar('Hasta', '01/12/2099')
    fireEvent.click(screen.getByLabelText('Hamburguesa'))
    fireEvent.click(screen.getByText('Guardar'))

    expect(
      screen.getByText('El descuento debe ser mayor a 0 y menor o igual a 100'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('La fecha de fin debe ser posterior a la fecha de inicio'),
    ).toBeInTheDocument()
    expect(crearPromocion).not.toHaveBeenCalled()
  })

  it('en edición muestra las fechas como dd/mm/aaaa y envía solo lo modificado (CA4)', async () => {
    vi.mocked(modificarPromocion).mockResolvedValue({
      ...PROMOCION,
      descripcion: 'Promo editada',
    })
    const onGuardado = renderForm(PROMOCION)
    await screen.findByLabelText('Hamburguesa')

    expect(screen.getByLabelText('Desde')).toHaveValue('01/11/2026')
    expect(screen.getByLabelText('Hasta')).toHaveValue('30/11/2026')

    completar('Descripción', 'Promo editada')
    fireEvent.click(screen.getByText('Guardar'))

    await vi.waitFor(() => expect(onGuardado).toHaveBeenCalled())
    expect(modificarPromocion).toHaveBeenCalledWith(5, { descripcion: 'Promo editada' })
  })

  it('muestra el error del backend (CA2)', async () => {
    vi.mocked(crearPromocion).mockRejectedValue(
      new ApiError(422, 'Producto inactivo: Pizza', 'PRODUCTO_INACTIVO'),
    )
    renderForm()
    await screen.findByLabelText('Hamburguesa')

    completar('Descripción', 'Promo')
    completar('Descuento (%)', '10')
    completar('Desde', '01/12/2099')
    completar('Hasta', '10/12/2099')
    fireEvent.click(screen.getByLabelText('Hamburguesa'))
    fireEvent.click(screen.getByText('Guardar'))

    expect(await screen.findByText('Producto inactivo: Pizza')).toBeInTheDocument()
  })

  it('marca los productos en conflicto al recibir PROMOCION_SUPERPUESTA', async () => {
    vi.mocked(crearPromocion).mockRejectedValue(
      new ApiError(
        409,
        'Ya existe una promoción activa para uno de esos productos en ese período',
        'PROMOCION_SUPERPUESTA',
      ),
    )
    vi.mocked(listarPromociones).mockResolvedValue([
      {
        ...PROMOCION,
        id: 9,
        descripcion: 'Promo existente',
        fecha_inicio: '2099-12-01',
        fecha_fin: '2099-12-10',
        productos: [{ id: 10, nombre: 'Hamburguesa' }],
      },
    ])
    const onGuardado = renderForm()
    await screen.findByLabelText('Hamburguesa')

    completar('Descripción', 'Nueva promo')
    completar('Descuento (%)', '10')
    completar('Desde', '01/12/2099')
    completar('Hasta', '10/12/2099')
    fireEvent.click(screen.getByLabelText('Hamburguesa'))
    fireEvent.click(screen.getByText('Guardar'))

    const alerta = await screen.findByText(/Estos productos ya tienen una promoción activa/)
    expect(alerta).toHaveTextContent('Hamburguesa')
    expect(screen.getByText('En conflicto')).toBeInTheDocument()
    expect(screen.getByText('Ya en: Promo existente')).toBeInTheDocument()
    expect(onGuardado).not.toHaveBeenCalled()
  })

  it('muestra un mensaje genérico si el backend no identifica productos en conflicto', async () => {
    vi.mocked(crearPromocion).mockRejectedValue(
      new ApiError(409, 'Conflicto', 'PROMOCION_SUPERPUESTA'),
    )
    vi.mocked(listarPromociones).mockResolvedValue([])
    renderForm()
    await screen.findByLabelText('Hamburguesa')

    completar('Descripción', 'Promo')
    completar('Descuento (%)', '10')
    completar('Desde', '01/12/2099')
    completar('Hasta', '10/12/2099')
    fireEvent.click(screen.getByLabelText('Hamburguesa'))
    fireEvent.click(screen.getByText('Guardar'))

    expect(
      await screen.findByText(
        'Ya existe una promoción activa para uno de esos productos en ese período.',
      ),
    ).toBeInTheDocument()
  })
})
