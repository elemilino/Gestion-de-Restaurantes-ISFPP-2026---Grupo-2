import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import { listarMediosPago } from '../../caja/api'
import { verCarta } from '../../carta/api'
import { crearCliente, listarClientes } from '../../clientes/api'
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
    vi.mocked(listarClientes)
      .mockReset()
      .mockResolvedValue([
        {
          id: 1,
          nombre: 'Laura',
          apellido: 'Gómez',
          telefono: '2804111111',
          dni: '30111222',
          email: null,
          eliminado: false,
        },
        {
          id: 2,
          nombre: 'Martín',
          apellido: 'Pérez',
          telefono: '2804222222',
          dni: '40111222',
          email: null,
          eliminado: false,
        },
      ])
    vi.mocked(crearCliente).mockReset()
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

  it('HU-11a CA1: crea una reserva con seña, filtrando por espacio y sin campo duración', async () => {
    vi.mocked(crearReserva).mockResolvedValue({ ...RESERVA, id: 9 })
    render(<ReservasPage />)
    await screen.findByText('Gómez, Laura')
    fireEvent.click(screen.getByRole('button', { name: /Nueva reserva/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nueva reserva' })
    const form = within(dialogo)
    expect(form.queryByLabelText(/Duración/i)).not.toBeInTheDocument()
    fireEvent.change(await form.findByLabelText('Cliente'), { target: { value: '1' } })
    fireEvent.change(form.getByLabelText('Fecha'), { target: { value: '2026-11-20' } })
    fireEvent.change(form.getByLabelText('Comensales'), { target: { value: '4' } })
    fireEvent.click(await form.findByLabelText(/Mesa 1 ·/))
    fireEvent.change(form.getByLabelText('Seña ($)'), { target: { value: '5000' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar reserva/ }))
    expect(crearReserva).toHaveBeenCalledWith({
      fecha: '2026-11-20',
      hora: '21:00',
      cantidad_comensales: 4,
      numeros_mesa: [1],
      cliente_id: 1,
      menu_acordado: [],
      sena: { monto: '5000', medio_pago_id: 1 },
    })
    expect(await screen.findByText('Reserva #9 creada')).toBeInTheDocument()
  })

  it('solo ofrece señas de $ 1.000 a $ 10.000', async () => {
    render(<ReservasPage />)
    await screen.findByText('Gómez, Laura')
    fireEvent.click(screen.getByRole('button', { name: /Nueva reserva/ }))
    const form = within(await screen.findByRole('dialog', { name: 'Nueva reserva' }))
    const sena = await form.findByLabelText('Seña ($)')
    expect(
      within(sena)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      'Elegí la seña…',
      '$ 1.000',
      '$ 2.000',
      '$ 3.000',
      '$ 4.000',
      '$ 5.000',
      '$ 6.000',
      '$ 7.000',
      '$ 8.000',
      '$ 9.000',
      '$ 10.000',
    ])
  })

  it('no muestra el precio acordado ni platos no disponibles al armar el menú', async () => {
    vi.mocked(verCarta).mockResolvedValue({
      secciones: [
        {
          id: 1,
          nombre: 'Platos',
          orden: 1,
          productos: [
            {
              id: 7,
              nombre: 'Milanesa',
              descripcion: null,
              precio: '9000.00',
              precio_final: null,
              tipo: 'PLATO',
              porcion_gramos: null,
              volumen_ml: null,
              alcoholica: null,
              disponible: true,
            },
            {
              id: 8,
              nombre: 'Rabas',
              descripcion: null,
              precio: '7000.00',
              precio_final: null,
              tipo: 'PLATO',
              porcion_gramos: null,
              volumen_ml: null,
              alcoholica: null,
              disponible: false,
            },
          ],
        },
      ],
    })
    vi.mocked(crearReserva).mockResolvedValue({ ...RESERVA, id: 9 })
    render(<ReservasPage />)
    await screen.findByText('Gómez, Laura')
    fireEvent.click(screen.getByRole('button', { name: /Nueva reserva/ }))
    const form = within(await screen.findByRole('dialog', { name: 'Nueva reserva' }))

    fireEvent.click(await form.findByRole('button', { name: /Agregar plato al menú/ }))
    expect(form.queryByLabelText('Precio acordado')).not.toBeInTheDocument()
    const selectorPlato = await form.findByLabelText('Plato 1')
    expect(within(selectorPlato).queryByRole('option', { name: /Rabas/ })).not.toBeInTheDocument()
    fireEvent.change(selectorPlato, { target: { value: '7' } })
    fireEvent.change(form.getByLabelText('Cantidad'), { target: { value: '2' } })
    fireEvent.change(form.getByLabelText('Cliente'), { target: { value: '1' } })
    fireEvent.change(form.getByLabelText('Fecha'), { target: { value: '2026-11-20' } })
    fireEvent.change(form.getByLabelText('Comensales'), { target: { value: '4' } })
    fireEvent.click(await form.findByLabelText(/Mesa 1 ·/))
    fireEvent.click(screen.getByRole('button', { name: /Guardar reserva/ }))

    expect(crearReserva).toHaveBeenCalledWith(
      expect.objectContaining({
        menu_acordado: [{ producto_id: 7, cantidad: 2, precio_acordado: '9000.00' }],
      }),
    )
  })

  it('busca clientes por nombre o DNI sin quitarlos del listado ni perder el elegido', async () => {
    render(<ReservasPage />)
    await screen.findByText('Gómez, Laura')
    fireEvent.click(screen.getByRole('button', { name: /Nueva reserva/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nueva reserva' })
    const form = within(dialogo)
    const buscar = await form.findByLabelText('Buscar cliente')
    const selector = form.getByLabelText('Cliente')

    // El listado completo sigue disponible al abrir el modal.
    expect(within(selector).getAllByRole('option')).toHaveLength(3)
    fireEvent.change(buscar, { target: { value: 'gomez' } })
    expect(within(selector).queryByRole('option', { name: /Pérez/ })).not.toBeInTheDocument()
    expect(within(selector).getByRole('option', { name: /Gómez/ })).toBeInTheDocument()

    // También busca por DNI y restaura el listado al limpiar la búsqueda.
    fireEvent.change(buscar, { target: { value: '40111222' } })
    expect(within(selector).getByRole('option', { name: /Pérez/ })).toBeInTheDocument()
    fireEvent.change(buscar, { target: { value: '' } })
    expect(within(selector).getAllByRole('option')).toHaveLength(3)

    // Si ya se eligió un cliente, no desaparece aunque no coincida con la búsqueda.
    fireEvent.change(selector, { target: { value: '1' } })
    fireEvent.change(buscar, { target: { value: 'zzz' } })
    expect(within(selector).getByRole('option', { name: /Gómez/ })).toBeInTheDocument()
  })

  it('registra un cliente desde el modal de reserva y lo deja seleccionado', async () => {
    const nuevo = {
      id: 3,
      nombre: 'Nora',
      apellido: 'Díaz',
      telefono: '2804333333',
      dni: '50111222',
      email: null,
      eliminado: false,
    }
    vi.mocked(crearCliente).mockResolvedValue(nuevo)
    render(<ReservasPage />)
    await screen.findByText('Gómez, Laura')
    fireEvent.click(screen.getByRole('button', { name: /Nueva reserva/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nueva reserva' })

    fireEvent.click(within(dialogo).getByRole('button', { name: /Nuevo cliente/ }))
    const alta = await screen.findByRole('dialog', { name: 'Registrar cliente' })
    fireEvent.change(within(alta).getByLabelText('Nombre'), { target: { value: 'Nora' } })
    fireEvent.change(within(alta).getByLabelText('Apellido'), { target: { value: 'Díaz' } })
    fireEvent.change(within(alta).getByLabelText('DNI'), { target: { value: '50111222' } })
    fireEvent.change(within(alta).getByLabelText('Teléfono'), { target: { value: '2804333333' } })
    fireEvent.click(within(alta).getByRole('button', { name: 'Guardar' }))

    expect(crearCliente).toHaveBeenCalledWith({
      nombre: 'Nora',
      apellido: 'Díaz',
      telefono: '2804333333',
      dni: '50111222',
      email: null,
    })
    expect(
      await screen.findByText(/Cliente Nora Díaz registrado y seleccionado/),
    ).toBeInTheDocument()
    const selector = within(dialogo).getByLabelText('Cliente')
    expect(selector).toHaveValue('3')
    expect(within(selector).getByRole('option', { name: /Díaz/ })).toBeInTheDocument()
  })

  it('filtra mesas por Espacio y oculta mesas ya reservadas en la misma fecha y hora', async () => {
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
      {
        id: 3,
        numero: 3,
        capacidad: 4,
        sector_id: 2,
        sector_nombre: 'Terraza',
        disponibilidad: 'LIBRE',
      },
    ])
    render(<ReservasPage />)
    await screen.findByText('Gómez, Laura')
    fireEvent.click(screen.getByRole('button', { name: /Nueva reserva/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nueva reserva' })
    const form = within(dialogo)

    // Por defecto muestra Salón (Mesas 1 y 2) y no Terraza (Mesa 3)
    expect(await form.findByLabelText(/Mesa 1 ·/)).toBeInTheDocument()
    expect(form.getByLabelText(/Mesa 2 ·/)).toBeInTheDocument()
    expect(form.queryByLabelText(/Mesa 3 ·/)).not.toBeInTheDocument()

    // Si elegimos la fecha 2026-11-11 y hora 21:00 (donde RESERVA ocupa la Mesa 1), Mesa 1 desaparece
    fireEvent.change(form.getByLabelText('Fecha'), { target: { value: '2026-11-11' } })
    expect(await form.findByLabelText(/Mesa 2 ·/)).toBeInTheDocument()
    expect(form.queryByLabelText(/Mesa 1 ·/)).not.toBeInTheDocument()

    // Si cambiamos al espacio Terraza, muestra Mesa 3
    fireEvent.change(form.getByLabelText('Espacio'), { target: { value: '2' } })
    expect(await form.findByLabelText(/Mesa 3 ·/)).toBeInTheDocument()
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
