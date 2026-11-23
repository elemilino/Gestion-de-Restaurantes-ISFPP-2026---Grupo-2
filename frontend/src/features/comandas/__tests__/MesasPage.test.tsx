import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Rol } from '../../../lib/roles'
import { verCarta } from '../../carta/api'
import { listarMozos, obtenerMiPerfilMozo } from '../../mozos/api'
import { MesasPage } from '../../salon/MesasPage'
import { crearComanda, obtenerComanda, reservasPendientes, tableroMesas } from '../api'
import { COMANDA, TABLERO } from './datos'
import { renderComo } from './sesion'

vi.mock('../api')
vi.mock('../../carta/api')
vi.mock('../../mozos/api')

const PERFIL = {
  id: 1,
  nombre: 'Ana',
  apellido: 'Ruiz',
  dni: '12345678',
  telefono: null,
  sector_id: 1,
  sector_nombre: 'Salón Principal',
  usuario_id: 1,
  username: 'mozo',
  activo: true,
}

describe('MesasPage (tablero con datos reales)', () => {
  beforeEach(() => {
    vi.mocked(tableroMesas).mockReset().mockResolvedValue(TABLERO)
    vi.mocked(obtenerMiPerfilMozo).mockResolvedValue(PERFIL)
    vi.mocked(listarMozos).mockResolvedValue([PERFIL])
    vi.mocked(reservasPendientes).mockResolvedValue([])
    vi.mocked(obtenerComanda).mockResolvedValue(COMANDA)
    vi.mocked(verCarta).mockResolvedValue({ secciones: [] })
  })

  it('muestra cada mesa con su comanda en curso', async () => {
    renderComo(Rol.MOZO, <MesasPage />)
    expect(await screen.findByText('Mozo: Ana R.')).toBeInTheDocument()
    expect(screen.getByText('3/4 comensales')).toBeInTheDocument()
    expect(screen.getByText('$ 20.000')).toBeInTheDocument()
    expect(screen.getByText('1 entregados · 1 pendiente')).toBeInTheDocument()
  })

  it('HU-05a: abre una comanda en una mesa libre con el DNI del mozo en sesión', async () => {
    vi.mocked(crearComanda).mockResolvedValue({
      ...COMANDA,
      id: 8,
      mesas: [{ id: 2, numero: 2, capacidad: 2 }],
    })
    renderComo(Rol.MOZO, <MesasPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Abrir comanda/ }))
    fireEvent.change(await screen.findByLabelText('Comensales'), { target: { value: '2' } })
    const botones = screen.getAllByRole('button', { name: /Abrir comanda/ })
    fireEvent.click(botones[botones.length - 1])
    expect(crearComanda).toHaveBeenCalledWith({
      dni_mozo: '12345678',
      cantidad_comensales: 2,
      numeros_mesa: [2],
    })
    expect(await screen.findByText('Comanda #8 abierta en la mesa 2')).toBeInTheDocument()
  })

  it('abre el panel de la comanda al tocar "Ver comanda"', async () => {
    renderComo(Rol.MOZO, <MesasPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Ver comanda/ }))
    expect(await screen.findByRole('dialog', { name: 'Comanda #7' })).toBeInTheDocument()
  })

  it('oculta la acción de "Facturar" al perfil Mozo en mesas esperando cobro', async () => {
    vi.mocked(tableroMesas).mockResolvedValue([
      {
        ...TABLERO[0],
        estado_mesa: 'esperando_cobro',
        comanda: { ...COMANDA, estado: 'CERRADA', abierta: false },
      },
    ])
    renderComo(Rol.MOZO, <MesasPage />)
    await screen.findByText('Mozo: Ana R.')
    expect(screen.queryByRole('button', { name: /Facturar/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ver comanda/i })).toBeInTheDocument()
  })

  it('permite a Admin y Cajero filtrar mesas por salón/sector o ver Todos, mientras el Mozo solo ve su sector', async () => {
    const mesasMultiSector = [
      ...TABLERO,
      {
        id: 3,
        numero: 3,
        capacidad: 6,
        sector_id: 2,
        sector_nombre: 'Terraza',
        estado_mesa: 'libre' as const,
        comanda: null,
      },
    ]
    vi.mocked(tableroMesas).mockResolvedValue(mesasMultiSector)

    renderComo(Rol.ADMINISTRADOR, <MesasPage />)
    expect(await screen.findByText('Disponible · Terraza')).toBeInTheDocument()
    expect(screen.getByText('Disponible · Salón Principal')).toBeInTheDocument()

    // Filtra solo Terraza
    fireEvent.click(screen.getByRole('button', { name: /Terraza/ }))
    expect(screen.getByText('Disponible · Terraza')).toBeInTheDocument()
    expect(screen.queryByText('Disponible · Salón Principal')).not.toBeInTheDocument()

    // Vuelve a Todos
    fireEvent.click(screen.getByRole('button', { name: /Todos/ }))
    expect(screen.getByText('Disponible · Salón Principal')).toBeInTheDocument()
  })

  it('prioriza en el filtro "Todas" las mesas reservadas para hoy mostrándolas primero', async () => {
    vi.mocked(tableroMesas).mockResolvedValue([
      ...TABLERO,
      {
        id: 5,
        numero: 5,
        capacidad: 4,
        sector_id: 1,
        sector_nombre: 'Salón Principal',
        estado_mesa: 'reservada',
        comanda: null,
      },
    ])

    renderComo(Rol.ADMINISTRADOR, <MesasPage />)
    await screen.findByText('Registrar llegada')
    const articulos = screen.getAllByRole('article')
    expect(articulos[0]).toHaveTextContent('05')
    expect(articulos[0]).toHaveTextContent('Reservada')
  })
})
