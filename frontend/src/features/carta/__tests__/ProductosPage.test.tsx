import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import { eliminarProducto, listarProductos, listarSecciones } from '../api'
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
    disponible: true,
    stock: null,
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
})
