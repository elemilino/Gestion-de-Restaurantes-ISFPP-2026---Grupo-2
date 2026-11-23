import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { verCarta } from '../api'
import type { Carta, ProductoCarta } from '../types'
import { VerCartaPage } from '../VerCartaPage'

vi.mock('../api')

function producto(datos: Partial<ProductoCarta>): ProductoCarta {
  return {
    id: 1,
    nombre: 'Producto',
    descripcion: null,
    precio: '1000.00',
    tipo: 'PLATO',
    porcion_gramos: null,
    volumen_ml: null,
    alcoholica: null,
    disponible: true,
    ...datos,
  }
}

const CARTA: Carta = {
  secciones: [
    {
      id: 1,
      nombre: 'Entradas',
      orden: 1,
      productos: [producto({ id: 1, nombre: 'Empanada de carne', precio: '1200.00' })],
    },
    {
      id: 2,
      nombre: 'Pastas',
      orden: 2,
      productos: [
        producto({
          id: 2,
          nombre: 'Ñoquis con salsa',
          descripcion: 'Ñoquis de papa con salsa fileto',
          precio: '5000.00',
          porcion_gramos: 350,
        }),
        producto({ id: 3, nombre: 'Ravioles', precio: '4500.00', disponible: false }),
      ],
    },
    {
      id: 3,
      nombre: 'Cervezas',
      orden: 3,
      productos: [
        producto({
          id: 4,
          nombre: 'Cerveza tirada',
          tipo: 'BEBIDA',
          precio: '4000.00',
          volumen_ml: 500,
          alcoholica: true,
        }),
      ],
    },
  ],
}

describe('VerCartaPage', () => {
  beforeEach(() => {
    vi.mocked(verCarta).mockReset().mockResolvedValue(CARTA)
  })

  it('muestra las secciones en orden con sus productos y precios', async () => {
    render(<VerCartaPage />)
    const titulos = await screen.findAllByRole('heading', { level: 2 })
    expect(titulos.map((t) => t.textContent)).toEqual(['Entradas', 'Pastas', 'Cervezas'])
    const pastas = screen.getByRole('region', { name: 'Pastas' })
    expect(within(pastas).getByText('Ñoquis con salsa')).toBeInTheDocument()
    expect(within(pastas).getByText('$ 5.000')).toBeInTheDocument()
    expect(within(pastas).getByText('350 g')).toBeInTheDocument()
    expect(screen.getByText('$ 1.200')).toBeInTheDocument()
    expect(screen.getByText('500 ml')).toBeInTheDocument()
    expect(screen.getByLabelText('Con alcohol')).toBeInTheDocument()
    expect(verCarta).toHaveBeenCalledTimes(1)
  })

  it('marca "No disponible" los productos no disponibles', async () => {
    render(<VerCartaPage />)
    const ravioles = await screen.findByRole('article', { name: 'Ravioles' })
    expect(within(ravioles).getByText('No disponible')).toBeInTheDocument()
    expect(ravioles).toHaveClass('opacity-60')
    const noquis = screen.getByRole('article', { name: 'Ñoquis con salsa' })
    expect(within(noquis).queryByText('No disponible')).not.toBeInTheDocument()
  })

  it('con la carta vacía muestra el mensaje', async () => {
    vi.mocked(verCarta).mockResolvedValue({ secciones: [] })
    render(<VerCartaPage />)
    expect(await screen.findByText('La carta no tiene productos cargados')).toBeInTheDocument()
  })

  it('al tocar el chip de una sección solo se ven sus productos', async () => {
    render(<VerCartaPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Pastas/ }))
    expect(screen.getByText('Ñoquis con salsa')).toBeInTheDocument()
    expect(screen.queryByText('Empanada de carne')).not.toBeInTheDocument()
    expect(screen.queryByText('Cerveza tirada')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Todas/ }))
    expect(screen.getByText('Empanada de carne')).toBeInTheDocument()
  })

  it('busca por nombre sin importar mayúsculas ni tildes', async () => {
    render(<VerCartaPage />)
    const buscador = await screen.findByLabelText('Buscar producto')
    fireEvent.change(buscador, { target: { value: 'NOQUIS' } })
    expect(screen.getByText('Ñoquis con salsa')).toBeInTheDocument()
    expect(screen.queryByText('Ravioles')).not.toBeInTheDocument()
    fireEvent.change(buscador, { target: { value: 'milanesa' } })
    expect(screen.getByText('No hay productos que coincidan con la búsqueda')).toBeInTheDocument()
  })

  it('muestra precio original tachado, precio con descuento y filtra productos en promoción', async () => {
    vi.mocked(verCarta).mockResolvedValue({
      secciones: [
        {
          id: 1,
          nombre: 'Pastas',
          orden: 1,
          productos: [
            producto({
              id: 2,
              nombre: 'Ñoquis con salsa',
              precio: '5000.00',
              descuento_porcentaje: '20.00',
              precio_final: '4000.00',
              promocion_descripcion: 'Martes de pastas',
            }),
            producto({ id: 3, nombre: 'Ravioles', precio: '4500.00' }),
          ],
        },
      ],
    })

    render(<VerCartaPage />)
    const noquis = await screen.findByRole('article', { name: 'Ñoquis con salsa' })
    expect(within(noquis).getByLabelText('Precio original')).toHaveTextContent('$ 5.000')
    expect(within(noquis).getByLabelText('Precio con descuento')).toHaveTextContent('$ 4.000')

    fireEvent.click(screen.getByRole('button', { name: /En promoción/ }))
    expect(screen.getByText('Ñoquis con salsa')).toBeInTheDocument()
    expect(screen.queryByText('Ravioles')).not.toBeInTheDocument()
  })
})
