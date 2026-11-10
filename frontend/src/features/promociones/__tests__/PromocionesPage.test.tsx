import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import { listarProductos, listarSecciones } from '../../carta/api'
import type { Producto, Seccion } from '../../carta/types'
import {
  cambiarEstadoPromocion,
  crearPromocion,
  listarPromociones,
  modificarPromocion,
} from '../api'
import { PromocionesPage } from '../PromocionesPage'
import type { Promocion } from '../types'
import { formatearFecha } from '../validaciones'

vi.mock('../api')
vi.mock('../../carta/api')

/** Fecha ISO a `dias` de hoy, calculada en hora local. */
function fecha(dias: number): string {
  const hoy = new Date()
  const local = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias)
  const mes = String(local.getMonth() + 1).padStart(2, '0')
  const dia = String(local.getDate()).padStart(2, '0')
  return `${local.getFullYear()}-${mes}-${dia}`
}

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

const VIGENTE: Promocion = {
  id: 1,
  descripcion: '2x1 en hamburguesas',
  fecha_inicio: fecha(-1),
  fecha_fin: fecha(5),
  descuento: '50.00',
  activo: true,
  vigente: true,
  productos: [{ id: 10, nombre: 'Hamburguesa' }],
}

const PROGRAMADA: Promocion = {
  id: 2,
  descripcion: 'Postres al 20%',
  fecha_inicio: fecha(5),
  fecha_fin: fecha(10),
  descuento: '20.00',
  activo: true,
  vigente: false,
  productos: [{ id: 11, nombre: 'Flan' }],
}

const VENCIDA: Promocion = {
  id: 3,
  descripcion: 'Promo vencida',
  fecha_inicio: fecha(-10),
  fecha_fin: fecha(-1),
  descuento: '10.00',
  activo: false,
  vigente: false,
  productos: [{ id: 12, nombre: 'Pizza' }],
}

const INACTIVA: Promocion = {
  id: 4,
  descripcion: 'Promo pausada',
  fecha_inicio: fecha(-1),
  fecha_fin: fecha(5),
  descuento: '15.00',
  activo: false,
  vigente: false,
  productos: [{ id: 13, nombre: 'Empanada' }],
}

const PROMOCIONES = [VIGENTE, PROGRAMADA, VENCIDA, INACTIVA]

function renderPagina() {
  render(<PromocionesPage />)
}

function completar(campo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(campo), { target: { value: valor } })
}

describe('PromocionesPage', () => {
  beforeEach(() => {
    vi.mocked(listarPromociones).mockReset().mockResolvedValue(PROMOCIONES)
    vi.mocked(crearPromocion).mockReset()
    vi.mocked(modificarPromocion).mockReset()
    vi.mocked(cambiarEstadoPromocion).mockReset()
    vi.mocked(listarProductos).mockReset().mockResolvedValue(PRODUCTOS)
    vi.mocked(listarSecciones).mockReset().mockResolvedValue(SECCIONES)
  })

  it('lista las promociones con descuento, vigencia en dd/mm/aaaa y estado', async () => {
    renderPagina()

    const fila = (await screen.findByText('2x1 en hamburguesas')).closest('tr')!
    expect(fila).toHaveTextContent(/50\s*%/)
    expect(fila).toHaveTextContent(`Del ${formatearFecha(VIGENTE.fecha_inicio)}`)
    expect(fila).toHaveTextContent(`al ${formatearFecha(VIGENTE.fecha_fin)}`)
    expect(fila).toHaveTextContent('Vigente')

    expect(screen.getByText('Postres al 20%').closest('tr')).toHaveTextContent('Programada')
    expect(screen.getByText('Promo vencida').closest('tr')).toHaveTextContent('Vencida')
    expect(screen.getByText('Promo pausada').closest('tr')).toHaveTextContent('Inactiva')
  })

  it('muestra el estado vacío si no hay promociones', async () => {
    vi.mocked(listarPromociones).mockResolvedValue([])
    renderPagina()

    expect(await screen.findByText('Todavía no hay promociones registradas')).toBeInTheDocument()
  })

  it('filtra por estado', async () => {
    renderPagina()
    await screen.findByText('2x1 en hamburguesas')

    fireEvent.click(screen.getByRole('button', { name: /^Vigentes/ }))
    expect(screen.getByText('2x1 en hamburguesas')).toBeInTheDocument()
    expect(screen.queryByText('Postres al 20%')).not.toBeInTheDocument()
    expect(screen.queryByText('Promo vencida')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Programadas/ }))
    expect(screen.getByText('Postres al 20%')).toBeInTheDocument()
    expect(screen.queryByText('2x1 en hamburguesas')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Todas/ }))
    expect(screen.getByText('2x1 en hamburguesas')).toBeInTheDocument()
    expect(screen.getByText('Postres al 20%')).toBeInTheDocument()
  })

  it('registra una promoción nueva (CA1)', async () => {
    vi.mocked(crearPromocion).mockResolvedValue({
      ...VIGENTE,
      id: 9,
      descripcion: 'Nueva promo',
    })
    renderPagina()
    fireEvent.click(await screen.findByText('Nueva promoción'))
    await screen.findByLabelText('Hamburguesa')

    completar('Descripción', 'Nueva promo')
    completar('Descuento (%)', '30')
    completar('Desde', '01/12/2099')
    completar('Hasta', '10/12/2099')
    fireEvent.click(screen.getByLabelText('Hamburguesa'))
    fireEvent.click(screen.getByText('Guardar'))

    await waitFor(() =>
      expect(crearPromocion).toHaveBeenCalledWith({
        descripcion: 'Nueva promo',
        descuento: '30',
        fecha_inicio: '2099-12-01',
        fecha_fin: '2099-12-10',
        productos_ids: [10],
      }),
    )
    expect(await screen.findByText(/registrada correctamente/)).toBeInTheDocument()
  })

  it('edita una promoción con los datos precargados (CA4)', async () => {
    vi.mocked(modificarPromocion).mockResolvedValue({
      ...VIGENTE,
      descripcion: 'Promo editada',
    })
    renderPagina()
    fireEvent.click(await screen.findByLabelText('Editar 2x1 en hamburguesas'))
    await screen.findByLabelText('Hamburguesa')

    expect(screen.getByLabelText('Descripción')).toHaveValue('2x1 en hamburguesas')
    expect(screen.getByLabelText('Desde')).toHaveValue(formatearFecha(VIGENTE.fecha_inicio))
    expect(screen.getByLabelText('Hasta')).toHaveValue(formatearFecha(VIGENTE.fecha_fin))

    completar('Descripción', 'Promo editada')
    fireEvent.click(screen.getByText('Guardar'))

    await waitFor(() =>
      expect(modificarPromocion).toHaveBeenCalledWith(1, { descripcion: 'Promo editada' }),
    )
    expect(await screen.findByText(/modificada correctamente/)).toBeInTheDocument()
  })

  it('activa y desactiva una promoción (CA5)', async () => {
    vi.mocked(cambiarEstadoPromocion).mockResolvedValue({
      ...VIGENTE,
      activo: false,
      vigente: false,
    })
    renderPagina()

    fireEvent.click(await screen.findByLabelText('2x1 en hamburguesas activa'))

    await waitFor(() => expect(cambiarEstadoPromocion).toHaveBeenCalledWith(1, false))
    expect(await screen.findByText(/desactivada/)).toBeInTheDocument()
  })

  it('muestra el error de superposición al activar (CA5)', async () => {
    vi.mocked(cambiarEstadoPromocion).mockRejectedValue(
      new ApiError(409, 'Conflicto', 'PROMOCION_SUPERPUESTA'),
    )
    renderPagina()

    fireEvent.click(await screen.findByLabelText('Promo pausada activa'))

    expect(
      await screen.findByText(
        'Ya existe una promoción activa para uno de esos productos en ese período.',
      ),
    ).toBeInTheDocument()
  })

  it('muestra el error de carga', async () => {
    vi.mocked(listarPromociones).mockRejectedValue(
      new ApiError(500, 'No se pudieron cargar las promociones'),
    )
    renderPagina()

    expect(await screen.findByText('No se pudieron cargar las promociones')).toBeInTheDocument()
  })
})
