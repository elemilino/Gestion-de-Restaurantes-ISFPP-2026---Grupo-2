import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import { crearMenu, eliminarMenu, listarMenus, listarSecciones, verCarta } from '../api'
import { MenusPage } from '../MenusPage'
import type { Menu, ProductoCarta } from '../types'

vi.mock('../api')

const MENU: Menu = {
  id: 20,
  nombre: 'Ejecutivo milanesa y flan',
  descripcion: null,
  precio: '10500.00',
  tipo: 'MENU_EJECUTIVO',
  seccion_id: 8,
  disponible: true,
  disponible_efectivo: true,
  fecha_inicio: '2026-11-10',
  fecha_fin: '2026-11-16',
  plato: { id: 3, nombre: 'Milanesa napolitana' },
  postre: { id: 4, nombre: 'Flan casero' },
  vigente: true,
}

function producto(id: number, nombre: string, tipo: ProductoCarta['tipo']): ProductoCarta {
  return {
    id,
    nombre,
    descripcion: null,
    precio: '1000.00',
    tipo,
    porcion_gramos: null,
    volumen_ml: null,
    alcoholica: null,
    disponible: true,
  }
}

describe('MenusPage (HU-09b)', () => {
  beforeEach(() => {
    vi.mocked(listarMenus).mockReset().mockResolvedValue([MENU])
    vi.mocked(listarSecciones).mockResolvedValue([
      { id: 8, nombre: 'Menús', orden: 8, cantidad_productos: 1 },
    ])
    vi.mocked(verCarta).mockResolvedValue({
      secciones: [
        {
          id: 1,
          nombre: 'Minutas',
          orden: 1,
          productos: [
            producto(3, 'Milanesa napolitana', 'PLATO'),
            producto(4, 'Flan casero', 'POSTRE'),
            producto(5, 'Gaseosa', 'BEBIDA'),
          ],
        },
      ],
    })
  })

  it('lista los menús con lo que incluyen y su vigencia', async () => {
    render(<MenusPage />)
    const fila = (await screen.findByText('Ejecutivo milanesa y flan')).closest('tr')!
    expect(fila).toHaveTextContent('Milanesa napolitana + Flan casero')
    expect(fila).toHaveTextContent('10/11 al 16/11')
    expect(fila).toHaveTextContent('Vigente')
  })

  it('CA1 y CA2: crea un menú ejecutivo con plato y postre (las bebidas no se ofrecen)', async () => {
    vi.mocked(crearMenu).mockResolvedValue(MENU)
    render(<MenusPage />)
    await screen.findByText('Ejecutivo milanesa y flan')
    fireEvent.click(screen.getByRole('button', { name: /Nuevo menú/ }))
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Ejecutivo del mediodía' },
    })
    fireEvent.change(screen.getByLabelText('Precio promocional'), { target: { value: '9000' } })
    fireEvent.change(screen.getByLabelText('Plato'), { target: { value: '3' } })
    expect(screen.queryByRole('option', { name: 'Gaseosa' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Postre'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(crearMenu).toHaveBeenCalledWith(
      'MENU_EJECUTIVO',
      expect.objectContaining({
        nombre: 'Ejecutivo del mediodía',
        plato_id: 3,
        postre_id: 4,
        seccion_id: 8,
      }),
    )
  })

  it('menú del día: no pide postre', async () => {
    render(<MenusPage />)
    await screen.findByText('Ejecutivo milanesa y flan')
    fireEvent.click(screen.getByRole('button', { name: /Nuevo menú/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Menú del día' }))
    expect(screen.queryByLabelText('Postre')).not.toBeInTheDocument()
  })

  it('CA4: muestra por qué no se puede eliminar', async () => {
    vi.mocked(eliminarMenu).mockRejectedValue(
      new ApiError(
        409,
        'No se puede eliminar Ejecutivo milanesa y flan: está en 1 comandas abiertas',
      ),
    )
    render(<MenusPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText(/está en 1 comandas abiertas/)).toBeInTheDocument()
  })
})
