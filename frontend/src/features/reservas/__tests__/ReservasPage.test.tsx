import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import { listarMediosPago } from '../../caja/api'
import { verCarta } from '../../carta/api'
import { listarClientes } from '../../clientes/api'
import { listarMesas } from '../../salon/api'
import { crearReserva, listarReservas, registrarAusencia, registrarLlegada } from '../api'
import { ReservasPage } from '../ReservasPage'
import type { Reserva } from '../types'

vi.mock('../api')
vi.mock('../../caja/api')
vi.mock('../../carta/api')
vi.mock('../../clientes/api')
vi.mock('../../salon/api')

const RESERVA: Reserva = {
  id: 4,
  nro_reserva: 4,
  fecha_hora: '2026-11-11T21:00:00',
  fecha: '2026-11-11',
  hora: '21:00:00',
  duracion_horas: 2,
  cantidad_comensales: 4,
  estado: 'ACTIVA',
  cliente: { id: 1, nombre: 'Laura', apellido: 'Gómez', dni: '30111222', telefono: '2804111111' },
  mesas: [{ id: 1, numero: 1, capacidad: 4 }],
  sena: {
    monto: '10000.00',
    fecha: '2026-11-10T10:00:00',
    medio_pago_id: 1,
    medio_pago_nombre: 'Efectivo',
    devuelta: false,
  },
  menu_acordado: [],
  fecha_hora_llegada: null,
  tiene_comanda: false,
}

describe('ReservasPage', () => {
  beforeEach(() => {
    vi.mocked(listarReservas).mockReset().mockResolvedValue([RESERVA])
    vi.mocked(listarClientes).mockResolvedValue([
      {
        id: 1,
        nombre: 'Laura',
        apellido: 'Gómez',
        telefono: '2804111111',
        dni: '30111222',
        email: null,
        eliminado: false,
      },
    ])
    vi.mocked(listarMesas).mockResolvedValue([
      {
        id: 1,
        numero: 1,
        capacidad: 4,
        sector_id: 1,
        sector_nombre: 'Salón',
        disponibilidad: 'LIBRE',
      },
      {
        id: 2,
        numero: 2,
        capacidad: 2,
        sector_id: 1,
        sector_nombre: 'Salón',
        disponibilidad: 'LIBRE',
      },
    ])
    vi.mocked(listarMediosPago).mockResolvedValue([
      {
        id: 1,
        nombre: 'Efectivo',
        tipo_acreditacion: 'Inmediata',
        porcentaje_recargo: '0.00',
        activo: true,
      },
    ])
    vi.mocked(verCarta).mockResolvedValue({ secciones: [] })
  })

  it('HU-11a CA11: lista las reservas con cliente, mesas, estado y seña', async () => {
    render(<ReservasPage />)
    const fila = (await screen.findByText('Gómez, Laura')).closest('tr')!
    expect(fila).toHaveTextContent('11/11/2026 21:00')
    expect(fila).toHaveTextContent('Activa')
    expect(fila).toHaveTextContent('$ 10.000')
  })

  it('HU-11a CA11: filtra por estado', async () => {
    render(<ReservasPage />)
    await screen.findByText('Gómez, Laura')
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'AUSENTE' } })
    expect(listarReservas).toHaveBeenLastCalledWith({ estado: 'AUSENTE' })
  })

  it('HU-11a CA1: crea una reserva con seña', async () => {
    vi.mocked(crearReserva).mockResolvedValue({ ...RESERVA, id: 9 })
    render(<ReservasPage />)
    await screen.findByText('Gómez, Laura')
    fireEvent.click(screen.getByRole('button', { name: /Nueva reserva/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nueva reserva' })
    const form = within(dialogo)
    fireEvent.change(await form.findByLabelText('Cliente'), { target: { value: '1' } })
    fireEvent.change(form.getByLabelText('Fecha'), { target: { value: '2026-11-20' } })
    fireEvent.change(form.getByLabelText('Comensales'), { target: { value: '4' } })
    fireEvent.click(await form.findByLabelText(/Mesa 1 ·/))
    fireEvent.change(form.getByLabelText('Seña ($)'), { target: { value: '5000' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar reserva/ }))
    expect(crearReserva).toHaveBeenCalledWith({
      fecha: '2026-11-20',
      hora: '21:00',
      duracion_horas: 2,
      cantidad_comensales: 4,
      numeros_mesa: [1],
      cliente_id: 1,
      menu_acordado: [],
      sena: { monto: '5000', medio_pago_id: 1 },
    })
    expect(await screen.findByText('Reserva #9 creada')).toBeInTheDocument()
  })

  it('HU-11b CA1: registra la llegada', async () => {
    vi.mocked(registrarLlegada).mockResolvedValue({ ...RESERVA, estado: 'CUMPLIDA' })
    render(<ReservasPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Llegó' }))
    expect(registrarLlegada).toHaveBeenCalledWith(4)
    expect(await screen.findByText('Llegada registrada: reserva #4 cumplida')).toBeInTheDocument()
  })

  it('HU-11b CA3: muestra cuánto falta para la tolerancia', async () => {
    vi.mocked(registrarAusencia).mockRejectedValue(
      new ApiError(
        422,
        'Todavía no venció la tolerancia: faltan 10 minutos',
        'TOLERANCIA_NO_VENCIDA',
      ),
    )
    render(<ReservasPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ausente' }))
    expect(
      await screen.findByText('Todavía no venció la tolerancia: faltan 10 minutos'),
    ).toBeInTheDocument()
  })
})
