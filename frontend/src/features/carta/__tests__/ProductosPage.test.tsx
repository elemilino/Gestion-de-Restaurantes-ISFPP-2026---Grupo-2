import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import {
  cambiarDisponibilidad,
  cambiarStock,
  eliminarProducto,
  listarProductos,
  listarSecciones,
} from '../api'
import { ProductosPage } from '../ProductosPage'
import type { Producto, Seccion } from '../types'

vi.mock('../api')

const SECCIONES: Seccion[] = [
  { id: 1, nombre: 'Pastas', orden: 1, cantidad_productos: 1 },
  { id: 2, nombre: 'Postres', orden: 2, cantidad_productos: 1 },
]

function producto(datos: Partial<Producto>): Producto {
  return {
    id: 1,
    nombre: 'Ñoquis con salsa',
    descripcion: null,
    precio: '5000.00',
    tipo: 'PLATO',
    seccion_id: 1,
    porcion_gramos: 350,
    volumen_ml: null,
    alcoholica: null,
    disponible: true,
    stock: null,
    disponible_efectivo: true,
    ...datos,
  }
}

const PRODUCTOS = [
  producto({}),
  producto({ id: 2, nombre: 'Flan casero', tipo: 'POSTRE', seccion_id: 2, precio: '3000.00' }),
]

function renderPagina() {
  render(
    <MemoryRouter>
      <ProductosPage />
    </MemoryRouter>,
  )
}

describe('ProductosPage', () => {
  beforeEach(() => {
    vi.mocked(listarProductos).mockReset().mockResolvedValue(PRODUCTOS)
    vi.mocked(listarSecciones).mockReset().mockResolvedValue(SECCIONES)
    vi.mocked(eliminarProducto).mockReset()
    vi.mocked(cambiarDisponibilidad).mockReset()
    vi.mocked(cambiarStock).mockReset()
  })

  it('lista los productos con su sección y el precio formateado', async () => {
    renderPagina()
    const fila = (await screen.findByText('Ñoquis con salsa')).closest('tr')!
    expect(fila).toHaveTextContent('Plato')
    expect(fila).toHaveTextContent('Pastas')
    expect(fila).toHaveTextContent('$ 5.000')
    expect(screen.getByText('Flan casero').closest('tr')).toHaveTextContent('$ 3.000')
  })

  it('filtra por tipo', async () => {
    renderPagina()
    await screen.findByText('Ñoquis con salsa')
    fireEvent.click(screen.getByRole('button', { name: /Postre/ }))
    expect(screen.queryByText('Ñoquis con salsa')).not.toBeInTheDocument()
    expect(screen.getByText('Flan casero')).toBeInTheDocument()
  })

  it('sin secciones avisa que hay que crear una (CA4)', async () => {
    vi.mocked(listarSecciones).mockResolvedValue([])
    vi.mocked(listarProductos).mockResolvedValue([])
    renderPagina()
    expect(
      await screen.findByText(/Primero tenés que crear una sección de la carta/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Secciones' })).toHaveAttribute(
      'href',
      '/carta/secciones',
    )
    expect(screen.queryByText('Nuevo producto')).not.toBeInTheDocument()
    expect(screen.getByText('Todavía no hay productos cargados')).toBeInTheDocument()
  })

  it('muestra el motivo si la eliminación está bloqueada (CA8)', async () => {
    vi.mocked(eliminarProducto).mockRejectedValue(
      new ApiError(
        409,
        'No se puede eliminar Ñoquis con salsa: está en 2 comandas abiertas',
        'PRODUCTO_EN_USO',
      ),
    )
    renderPagina()
    fireEvent.click(await screen.findByLabelText('Eliminar Ñoquis con salsa'))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(
      await screen.findByText('No se puede eliminar Ñoquis con salsa: está en 2 comandas abiertas'),
    ).toBeInTheDocument()
  })

  it('muestra el volumen junto al nombre de las bebidas (HU-04c)', async () => {
    vi.mocked(listarProductos).mockResolvedValue([
      producto({ id: 5, nombre: 'Gaseosa', tipo: 'BEBIDA', volumen_ml: 350, alcoholica: false }),
      producto({ id: 6, nombre: 'Gaseosa', tipo: 'BEBIDA', volumen_ml: 1500, alcoholica: false }),
    ])
    renderPagina()
    expect(await screen.findByText('Gaseosa · 350 ml')).toBeInTheDocument()
    expect(screen.getByText('Gaseosa · 1500 ml')).toBeInTheDocument()
  })

  describe('stock y disponibilidad (HU-04d)', () => {
    const CON_STOCK = [
      producto({ id: 1, nombre: 'Ñoquis con salsa', stock: null }),
      producto({ id: 2, nombre: 'Flan casero', stock: 10 }),
      producto({ id: 3, nombre: 'Bife de chorizo', stock: 0, disponible_efectivo: false }),
    ]

    function fila(nombre: string) {
      return screen.getByText(nombre).closest('tr')!
    }

    it('muestra "Sin control", el número o "Agotado" según el stock', async () => {
      vi.mocked(listarProductos).mockResolvedValue(CON_STOCK)
      renderPagina()
      await screen.findByText('Ñoquis con salsa')
      expect(fila('Ñoquis con salsa')).toHaveTextContent('Sin control')
      expect(fila('Flan casero')).toHaveTextContent('10')
      expect(fila('Bife de chorizo')).toHaveTextContent('Agotado')
    })

    it('el interruptor llama a cambiarDisponibilidad y actualiza la fila', async () => {
      vi.mocked(listarProductos).mockResolvedValue(CON_STOCK)
      vi.mocked(cambiarDisponibilidad).mockResolvedValue({ ...CON_STOCK[1], disponible: false })
      renderPagina()
      const interruptor = await screen.findByRole('switch', { name: 'Flan casero disponible' })
      expect(interruptor).toHaveAttribute('aria-checked', 'true')
      fireEvent.click(interruptor)
      expect(cambiarDisponibilidad).toHaveBeenCalledWith(2, false)
      await waitFor(() => expect(interruptor).toHaveAttribute('aria-checked', 'false'))
    })

    it('si el interruptor falla muestra el error y deja el valor anterior', async () => {
      vi.mocked(listarProductos).mockResolvedValue(CON_STOCK)
      vi.mocked(cambiarDisponibilidad).mockRejectedValue(
        new ApiError(404, 'El producto no existe', 'PRODUCTO_NO_ENCONTRADO'),
      )
      renderPagina()
      const interruptor = await screen.findByRole('switch', { name: 'Flan casero disponible' })
      fireEvent.click(interruptor)
      expect(await screen.findByText('El producto no existe')).toBeInTheDocument()
      expect(interruptor).toHaveAttribute('aria-checked', 'true')
    })

    it.each(['-1', '2.5'])('el modal de stock rechaza %s (CA5)', async (valor) => {
      vi.mocked(listarProductos).mockResolvedValue(CON_STOCK)
      renderPagina()
      fireEvent.click(await screen.findByLabelText('Stock de Flan casero'))
      fireEvent.change(screen.getByLabelText('Unidades en stock'), { target: { value: valor } })
      fireEvent.click(screen.getByText('Guardar'))
      expect(
        screen.getByText('El stock debe ser un número entero mayor o igual a 0'),
      ).toBeInTheDocument()
      expect(cambiarStock).not.toHaveBeenCalled()
    })

    it('el modal guarda el stock o lo deja sin control', async () => {
      vi.mocked(listarProductos).mockResolvedValue(CON_STOCK)
      vi.mocked(cambiarStock).mockResolvedValue({ ...CON_STOCK[1], stock: null })
      renderPagina()
      fireEvent.click(await screen.findByLabelText('Stock de Flan casero'))
      expect(screen.getByLabelText('Unidades en stock')).toHaveValue(10)
      fireEvent.click(screen.getByLabelText('No controlar stock'))
      fireEvent.click(screen.getByText('Guardar'))
      expect(cambiarStock).toHaveBeenCalledWith(2, null)
      await waitFor(() => expect(fila('Flan casero')).toHaveTextContent('Sin control'))
    })
  })
})
