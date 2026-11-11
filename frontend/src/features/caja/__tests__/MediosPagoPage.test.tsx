import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../api/client'
import { crearMedioPago, eliminarMedioPago, listarMediosPago } from '../api'
import { MediosPagoPage } from '../MediosPagoPage'

vi.mock('../api')

describe('MediosPagoPage (HU-07a/b)', () => {
  beforeEach(() => {
    vi.mocked(listarMediosPago)
      .mockReset()
      .mockResolvedValue([
        {
          id: 1,
          nombre: 'Efectivo',
          tipo_acreditacion: 'Inmediata',
          porcentaje_recargo: '0.00',
          activo: true,
        },
        {
          id: 2,
          nombre: 'Cheque',
          tipo_acreditacion: 'Diferida',
          porcentaje_recargo: '0.00',
          activo: false,
        },
      ])
  })

  it('lista los medios con su estado', async () => {
    render(<MediosPagoPage />)
    expect((await screen.findByText('Efectivo')).closest('tr')).toHaveTextContent('Activo')
    expect(screen.getByText('Cheque').closest('tr')).toHaveTextContent('Inactivo')
  })

  it('HU-07a CA2: informa el nombre duplicado', async () => {
    vi.mocked(crearMedioPago).mockRejectedValue(
      new ApiError(409, 'El medio de pago ya se encuentra registrado'),
    )
    render(<MediosPagoPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo medio de pago/ }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Efectivo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(
      await screen.findByText('El medio de pago ya se encuentra registrado'),
    ).toBeInTheDocument()
  })

  it('HU-07b CA2: el recargo no puede ser negativo', async () => {
    render(<MediosPagoPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo medio de pago/ }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Visa' } })
    fireEvent.change(screen.getByLabelText('Recargo (%)'), { target: { value: '-5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByText('El recargo no puede ser un valor negativo')).toBeInTheDocument()
    expect(crearMedioPago).not.toHaveBeenCalled()
  })

  it('HU-07b CA1: da de baja un medio activo', async () => {
    vi.mocked(eliminarMedioPago).mockResolvedValue(undefined)
    render(<MediosPagoPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Dar de baja' }))
    expect(eliminarMedioPago).toHaveBeenCalledWith(1)
    expect(await screen.findByText('Medio de pago Efectivo dado de baja')).toBeInTheDocument()
  })
})
