import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import {
  listarSecciones,
  listarSectores,
  reporteCobros,
  reporteMozos,
  reporteOcupacion,
  reporteProductos,
  reporteReservas,
  reporteVentas,
} from '../api'
import { ReportesPage } from '../ReportesPage'
import type { ReporteVentas } from '../types'

vi.mock('../api')

const PERIODO = { desde: '2026-11-01', hasta: '2026-11-10', mensaje: null }

const VENTAS: ReporteVentas = {
  ...PERIODO,
  total_facturado: '120000.00',
  cantidad_facturas: 8,
  ticket_promedio: '15000.00',
  pendiente_cobro: '9000.00',
  por_dia: [
    { fecha: '2026-11-09', total: '50000.00' },
    { fecha: '2026-11-10', total: '70000.00' },
  ],
}

function abrir(reporte: string) {
  fireEvent.click(screen.getByRole('button', { name: reporte }))
}

describe('ReportesPage', () => {
  beforeEach(() => {
    vi.mocked(reporteVentas).mockReset().mockResolvedValue(VENTAS)
    vi.mocked(listarSecciones).mockResolvedValue([{ id: 1, nombre: 'Cervezas' }])
    vi.mocked(listarSectores).mockResolvedValue([{ id: 2, nombre: 'Terraza' }])
  })

  it('HU-12a: muestra las ventas del mes actual por defecto', async () => {
    render(<ReportesPage />)
    expect(await screen.findByText('$ 120.000')).toBeInTheDocument()
    expect(screen.getByText('$ 15.000')).toBeInTheDocument()
    expect(screen.getByText('$ 9.000')).toBeInTheDocument()
    expect(screen.getByText(/Del 01\/11\/2026 al 10\/11\/2026/)).toBeInTheDocument()
    expect(reporteVentas).toHaveBeenCalledWith({ periodo: 'MES' })
  })

  it('HU-12a: cambia el período y pide de nuevo el reporte', async () => {
    render(<ReportesPage />)
    await screen.findByText('$ 120.000')
    fireEvent.click(screen.getByRole('button', { name: 'Semana actual' }))
    expect(reporteVentas).toHaveBeenLastCalledWith({ periodo: 'SEMANA' })
  })

  it('HU-12a CA3 y CA4: período personalizado e inválido', async () => {
    vi.mocked(reporteVentas)
      .mockResolvedValueOnce(VENTAS)
      .mockRejectedValueOnce(
        new ApiError(422, 'El período seleccionado no es válido', 'PERIODO_INVALIDO'),
      )
    render(<ReportesPage />)
    await screen.findByText('$ 120.000')
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }))
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-08' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-01' } })
    fireEvent.click(screen.getByRole('button', { name: /Aplicar período/ }))
    expect(await screen.findByText('El período seleccionado no es válido')).toBeInTheDocument()
    expect(reporteVentas).toHaveBeenLastCalledWith({
      periodo: 'PERSONALIZADO',
      desde: '2026-11-08',
      hasta: '2026-11-01',
    })
  })

  it('HU-12a CA5: informa cuando no hay ventas', async () => {
    vi.mocked(reporteVentas).mockResolvedValue({
      ...VENTAS,
      total_facturado: '0.00',
      cantidad_facturas: 0,
      mensaje: 'No hay ventas en el período seleccionado',
    })
    render(<ReportesPage />)
    expect(await screen.findByText('No hay ventas en el período seleccionado')).toBeInTheDocument()
  })

  it('HU-12b: ranking con productos eliminados marcados y filtro por tipo', async () => {
    vi.mocked(reporteProductos).mockResolvedValue({
      ...PERIODO,
      productos: [
        {
          posicion: 1,
          producto_id: 3,
          nombre: 'Cerveza tirada',
          tipo: 'BEBIDA',
          seccion: 'Cervezas',
          unidades: 40,
          importe: '160000.00',
          eliminado: false,
        },
        {
          posicion: 2,
          producto_id: 7,
          nombre: 'Fernet',
          tipo: 'BEBIDA',
          seccion: 'Cervezas',
          unidades: 12,
          importe: '60000.00',
          eliminado: true,
        },
      ],
    })
    render(<ReportesPage />)
    abrir('Más vendidos')
    expect(await screen.findByText('40 u.')).toBeInTheDocument()
    expect(screen.getByText('Eliminado')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'BEBIDA' } })
    expect(reporteProductos).toHaveBeenLastCalledWith({ periodo: 'MES', tipo: 'BEBIDA' })
  })

  it('HU-12c: mozos con su total y detalle al filtrar por DNI', async () => {
    vi.mocked(reporteMozos).mockResolvedValue({
      ...PERIODO,
      mozos: [
        {
          mozo_id: 1,
          dni: '11111111',
          nombre: 'Ana',
          apellido: 'Ruiz',
          comandas: 3,
          comensales: 9,
          total_facturado: '45000.00',
          promedio_por_comanda: '15000.00',
          dado_de_baja: true,
          detalle: [
            {
              comanda_id: 5,
              fecha_hora_cierre: '2026-11-09T21:30:00',
              mesas: [3, 4],
              comensales: 4,
              importe: '20000.00',
            },
          ],
        },
      ],
    })
    render(<ReportesPage />)
    abrir('Mozos')
    expect((await screen.findAllByText('$ 45.000')).length).toBeGreaterThan(0)
    expect(screen.getByText('Dado de baja')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('DNI del mozo (opcional)'), {
      target: { value: '11111111' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }))
    expect(await screen.findByText('Comandas del mozo')).toBeInTheDocument()
    expect(screen.getByText('3, 4')).toBeInTheDocument()
    expect(reporteMozos).toHaveBeenLastCalledWith({ periodo: 'MES', dni: '11111111' })
  })

  it('HU-12d: ocupación con la franja de mayor ocupación', async () => {
    vi.mocked(reporteOcupacion).mockResolvedValue({
      ...PERIODO,
      mesas_activas: 4,
      celdas: [{ dia_semana: 5, hora: 21, porcentaje: 75 }],
      ocupacion_promedio: 40,
      franja_maxima: {
        dia_semana: 5,
        hora: 21,
        porcentaje: 75,
        etiqueta: 'Sábado 21 a 22 h: 75 %',
      },
    })
    render(<ReportesPage />)
    abrir('Ocupación')
    expect(await screen.findByText('Sábado 21 a 22 h')).toBeInTheDocument()
    expect(screen.getByText('75 %')).toBeInTheDocument()
    expect(screen.getByTitle('Sábado 21 a 22 h: 75 %')).toBeInTheDocument()
  })

  it('HU-12e: reservas por estado, señas retenidas y ausentes', async () => {
    vi.mocked(reporteReservas).mockResolvedValue({
      ...PERIODO,
      total_reservas: 4,
      por_estado: [
        { estado: 'ACTIVA', cantidad: 1, porcentaje: 25 },
        { estado: 'CUMPLIDA', cantidad: 2, porcentaje: 50 },
        { estado: 'CANCELADA', cantidad: 0, porcentaje: 0 },
        { estado: 'AUSENTE', cantidad: 1, porcentaje: 25 },
      ],
      senas_retenidas: '8000.00',
      clientes_ausentes: [
        {
          cliente_id: 1,
          nombre: 'Sofía',
          apellido: 'Herrera',
          dni: '35555666',
          telefono: '2804333333',
          ausencias: 1,
          total_reservas: 1,
          dado_de_baja: false,
        },
      ],
    })
    render(<ReportesPage />)
    abrir('Reservas')
    expect(await screen.findByText('$ 8.000')).toBeInTheDocument()
    const cumplidas = screen.getByText('Cumplidas').closest('li')!
    expect(within(cumplidas).getByText('50 %')).toBeInTheDocument()
    expect(screen.getByText('Herrera, Sofía')).toBeInTheDocument()
  })

  it('HU-12f: cobros por medio de pago con el recargo aparte', async () => {
    vi.mocked(reporteCobros).mockResolvedValue({
      ...PERIODO,
      total_cobrado: '34000.00',
      medios: [
        {
          medio_pago_id: 4,
          nombre: 'Visa',
          tipo_acreditacion: 'Diferida',
          cantidad_pagos: 1,
          monto_abonado: '20000.00',
          recargo: '2000.00',
          total_cobrado: '22000.00',
          porcentaje: 64.7,
          dado_de_baja: false,
        },
      ],
    })
    render(<ReportesPage />)
    abrir('Cobros')
    const fila = (await screen.findAllByText('Visa')).at(-1)!.closest('tr')!
    expect(fila).toHaveTextContent('$ 2.000')
    expect(fila).toHaveTextContent('$ 22.000')
  })
})
