import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cobrarFactura,
  comandasPorFacturar,
  generarFactura,
  listarFacturas,
  listarMediosPago,
  obtenerComprobante,
} from '../api'
import { CajaPage } from '../CajaPage'
import type { Factura } from '../types'

vi.mock('../api')

const FACTURA: Factura = {
  id: 3,
  comanda_id: 7,
  cuit_dni_cliente: null,
  tipo_factura: 'Consumidor Final',
  fecha: '2026-11-10T22:00:00',
  importe_total: '20000.00',
  total_a_pagar: '20000.00',
  monto_recibido: '0.00',
  estado: 'Adeudada',
  detalles_pago: [],
}

const MEDIOS = [
  {
    id: 1,
    nombre: 'Efectivo',
    tipo_acreditacion: 'Inmediata' as const,
    porcentaje_recargo: '0.00',
    activo: true,
  },
  {
    id: 2,
    nombre: 'Visa',
    tipo_acreditacion: 'Diferida' as const,
    porcentaje_recargo: '10.00',
    activo: true,
  },
]

describe('CajaPage', () => {
  beforeEach(() => {
    vi.mocked(comandasPorFacturar)
      .mockReset()
      .mockResolvedValue([
        {
          comanda_id: 7,
          fecha_hora_cierre: '2026-11-10T21:50:00',
          mesas: [1],
          mozo: 'Ana Ruiz',
          cantidad_comensales: 3,
          importe: '20000.00',
        },
      ])
    vi.mocked(listarFacturas).mockReset().mockResolvedValue([])
    vi.mocked(listarMediosPago).mockResolvedValue(MEDIOS)
    vi.mocked(obtenerComprobante).mockResolvedValue({
      factura_id: 3,
      fecha: '2026-11-10T22:00:00',
      tipo_factura: 'Consumidor Final',
      cuit_dni_cliente: null,
      comanda_id: 7,
      mesa_numero: 1,
      mozo_nombre: 'Ana Ruiz',
      items: [
        {
          producto_nombre: 'Milanesa',
          cantidad: 2,
          precio_unitario: '10000.00',
          subtotal: '20000.00',
        },
      ],
      importe_total: '20000.00',
      total_a_pagar: '21000.00',
      monto_recibido: '21000.00',
      vuelto: '0.00',
      detalles_pago: [],
    })
  })

  it('HU-08a: genera la factura de una comanda cerrada', async () => {
    vi.mocked(generarFactura).mockResolvedValue(FACTURA)
    render(<CajaPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Generar factura/ }))
    fireEvent.change(screen.getByLabelText('Tipo de factura'), { target: { value: 'B' } })
    fireEvent.change(screen.getByLabelText('CUIT o DNI del cliente (opcional)'), {
      target: { value: '20304050607' },
    })
    const botones = screen.getAllByRole('button', { name: /Generar factura/ })
    fireEvent.click(botones[botones.length - 1])
    expect(generarFactura).toHaveBeenCalledWith({
      comanda_id: 7,
      tipo_factura: 'B',
      cuit_dni_cliente: '20304050607',
    })
    expect(await screen.findByText('Factura #3 generada por $ 20.000')).toBeInTheDocument()
  })

  it('HU-08b: cobra con dos medios de pago y muestra el total con recargo', async () => {
    vi.mocked(listarFacturas).mockResolvedValue([FACTURA])
    vi.mocked(cobrarFactura).mockResolvedValue({
      ...FACTURA,
      estado: 'Pagada',
      total_a_pagar: '21000.00',
    })
    render(<CajaPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Cobrar/ }))
    fireEvent.change(await screen.findByLabelText('Monto'), { target: { value: '10000' } })
    fireEvent.click(screen.getByRole('button', { name: /Agregar otro medio de pago/ }))
    fireEvent.change(screen.getByLabelText('Medio de pago 2'), { target: { value: '2' } })
    expect(screen.getByText('$ 21.000')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Registrar cobro/ }))
    expect(cobrarFactura).toHaveBeenCalledWith(3, {
      pagos: [
        { medio_pago_id: 1, monto_abonado: '10000' },
        { medio_pago_id: 2, monto_abonado: '10000.00' },
      ],
      monto_recibido: undefined,
    })
    expect(await screen.findByText('Factura #3 cobrada: $ 21.000')).toBeInTheDocument()
    expect(await screen.findByText('2 × Milanesa')).toBeInTheDocument()
  })
})
