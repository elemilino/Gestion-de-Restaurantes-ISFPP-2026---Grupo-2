import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { CampoFecha } from '../CampoFecha'
import { formatearFecha } from '../validaciones'

/** Fecha local a ISO (YYYY-MM-DD), para comparar con los valores del calendario. */
function isoDe(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

function CampoDePrueba() {
  const [valor, setValor] = useState('')
  return (
    <div>
      <label htmlFor="fecha-prueba">Desde</label>
      <CampoFecha id="fecha-prueba" etiqueta="Desde" value={valor} onChange={setValor} />
    </div>
  )
}

describe('CampoFecha', () => {
  it('abre el calendario y elige la fecha de hoy', () => {
    render(<CampoDePrueba />)

    fireEvent.click(screen.getByLabelText('Abrir calendario de Desde'))
    expect(screen.getByRole('dialog', { name: 'Calendario de Desde' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }))

    const hoy = new Date()
    expect(screen.getByLabelText('Desde')).toHaveValue(formatearFecha(isoDe(hoy)))
    expect(screen.queryByRole('dialog', { name: 'Calendario de Desde' })).not.toBeInTheDocument()
  })

  it('navega al mes siguiente y elige un día', () => {
    render(<CampoDePrueba />)

    fireEvent.click(screen.getByLabelText('Abrir calendario de Desde'))
    fireEvent.click(screen.getByLabelText('Mes siguiente'))

    const hoy = new Date()
    const primerDiaSiguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)
    fireEvent.click(screen.getByLabelText(`Elegir ${formatearFecha(isoDe(primerDiaSiguiente))}`))

    expect(screen.getByLabelText('Desde')).toHaveValue(formatearFecha(isoDe(primerDiaSiguiente)))
  })

  it('acepta la fecha escrita con máscara dd/mm/aaaa', () => {
    render(<CampoDePrueba />)

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '01122099' } })

    expect(screen.getByLabelText('Desde')).toHaveValue('01/12/2099')
  })
})
