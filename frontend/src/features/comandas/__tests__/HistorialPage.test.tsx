import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import { Rol } from '../../../lib/roles'
import { listarComandas } from '../api'
import { HistorialPage } from '../HistorialPage'
import { COMANDA } from './datos'
import { renderComo } from './sesion'

vi.mock('../api')

describe('HistorialPage (HU-05f)', () => {
  beforeEach(() => {
    vi.mocked(listarComandas).mockReset().mockResolvedValue([COMANDA])
  })

  it('lista las comandas con su estado y total', async () => {
    renderComo(Rol.MOZO, <HistorialPage />)
    const fila = (await screen.findByText('Ruiz, Ana')).closest('tr')!
    expect(fila).toHaveTextContent('Abierta')
    expect(fila).toHaveTextContent('$ 20.000')
  })

  it('CA1: filtra por mozo, fechas y estado', async () => {
    renderComo(Rol.MOZO, <HistorialPage />)
    await screen.findByText('Ruiz, Ana')
    fireEvent.change(screen.getByLabelText('DNI del mozo'), { target: { value: '12345678' } })
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'abiertas' } })
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }))
    expect(listarComandas).toHaveBeenLastCalledWith({
      dni_mozo: '12345678',
      fecha_desde: '2026-11-01',
      fecha_hasta: undefined,
      abierta: true,
    })
  })

  it('CA2: avisa si el mozo no existe o está eliminado', async () => {
    renderComo(Rol.MOZO, <HistorialPage />)
    await screen.findByText('Ruiz, Ana')
    vi.mocked(listarComandas).mockRejectedValue(
      new ApiError(422, 'El mozo con DNI 99999999 no existe o está eliminado'),
    )
    fireEvent.change(screen.getByLabelText('DNI del mozo'), { target: { value: '99999999' } })
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }))
    expect(await screen.findByText(/no existe o está eliminado/)).toBeInTheDocument()
  })
})
