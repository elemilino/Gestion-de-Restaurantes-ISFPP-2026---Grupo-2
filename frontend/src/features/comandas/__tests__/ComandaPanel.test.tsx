import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import { Rol } from '../../../lib/roles'
import { verCarta } from '../../carta/api'
import { listarMozos } from '../../mozos/api'
import {
  agregarProducto,
  anularComanda,
  cerrarComanda,
  entregarProducto,
  obtenerComanda,
  reabrirComanda,
} from '../api'
import { ComandaPanel } from '../ComandaPanel'
import { COMANDA } from './datos'
import { renderComo } from './sesion'

vi.mock('../api')
vi.mock('../../carta/api')
vi.mock('../../mozos/api')

const CARTA = {
  secciones: [
    {
      id: 1,
      nombre: 'Postres',
      orden: 1,
      productos: [
        {
          id: 4,
          nombre: 'Flan casero',
          descripcion: null,
          precio: '3000.00',
          tipo: 'POSTRE' as const,
          porcion_gramos: null,
          volumen_ml: null,
          alcoholica: null,
          disponible: true,
        },
        {
          id: 5,
          nombre: 'Panqueque',
          descripcion: null,
          precio: '3500.00',
          tipo: 'POSTRE' as const,
          porcion_gramos: null,
          volumen_ml: null,
          alcoholica: null,
          disponible: false,
        },
      ],
    },
  ],
}

describe('ComandaPanel', () => {
  beforeEach(() => {
    vi.mocked(obtenerComanda).mockReset().mockResolvedValue(COMANDA)
    vi.mocked(verCarta).mockResolvedValue(CARTA)
    vi.mocked(listarMozos).mockResolvedValue([])
  })

  it('muestra los productos, el total y el estado de entrega', async () => {
    renderComo(Rol.MOZO, <ComandaPanel comandaId={7} onCerrar={() => {}} />)
    expect(await screen.findByText('Milanesa napolitana')).toBeInTheDocument()
    expect(screen.getByText('$ 20.000')).toBeInTheDocument()
    expect(screen.getByText('Entregado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Marcar entregado' })).toBeInTheDocument()
  })

  it('HU-05b: agrega un producto de la carta; los no disponibles no se eligen', async () => {
    vi.mocked(agregarProducto).mockResolvedValue(COMANDA)
    renderComo(Rol.MOZO, <ComandaPanel comandaId={7} onCerrar={() => {}} />)
    await screen.findByText('Milanesa napolitana')
    expect(screen.getByRole('option', { name: /Panqueque/ })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Producto de la carta'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /Agregar/ }))
    expect(agregarProducto).toHaveBeenCalledWith(7, 4, 2)
  })

  it('HU-06: marca un producto como entregado', async () => {
    vi.mocked(entregarProducto).mockResolvedValue(COMANDA)
    renderComo(Rol.MOZO, <ComandaPanel comandaId={7} onCerrar={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar entregado' }))
    expect(entregarProducto).toHaveBeenCalledWith(7, 12)
  })

  it('HU-05c: muestra el error del backend al cerrar con productos pendientes', async () => {
    vi.mocked(cerrarComanda).mockRejectedValue(
      new ApiError(
        409,
        'No se puede cerrar una comanda con productos pendientes de entrega: Flan casero',
      ),
    )
    renderComo(Rol.MOZO, <ComandaPanel comandaId={7} onCerrar={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: /Cerrar comanda/ }))
    expect(await screen.findByText(/productos pendientes de entrega/)).toBeInTheDocument()
  })

  it('HU-06 CA3: anula con motivo', async () => {
    vi.mocked(anularComanda).mockResolvedValue({ ...COMANDA, estado: 'ANULADA', abierta: false })
    renderComo(Rol.MOZO, <ComandaPanel comandaId={7} onCerrar={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: /Anular/ }))
    fireEvent.change(screen.getByLabelText('Motivo de la anulación'), {
      target: { value: 'Se retiró sin pedir' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))
    expect(anularComanda).toHaveBeenCalledWith(7, 'Se retiró sin pedir')
    expect(await screen.findByText('Comanda anulada')).toBeInTheDocument()
  })

  it('HU-05d: solo el administrador ve "Reabrir" en una comanda cerrada', async () => {
    const cerrada = { ...COMANDA, estado: 'CERRADA' as const, abierta: false }
    vi.mocked(obtenerComanda).mockResolvedValue(cerrada)
    vi.mocked(reabrirComanda).mockResolvedValue(COMANDA)
    const { unmount } = renderComo(Rol.MOZO, <ComandaPanel comandaId={7} onCerrar={() => {}} />)
    await screen.findByText('Milanesa napolitana')
    expect(screen.queryByRole('button', { name: /Reabrir/ })).not.toBeInTheDocument()
    unmount()
    renderComo(Rol.ADMINISTRADOR, <ComandaPanel comandaId={7} onCerrar={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: /Reabrir/ }))
    expect(reabrirComanda).toHaveBeenCalledWith(7)
  })
})
