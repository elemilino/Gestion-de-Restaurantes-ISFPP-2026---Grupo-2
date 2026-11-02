import { useEffect, useState } from 'react'

import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { Button } from '../../components/Button'
import { FilterChip } from '../../components/FilterChip'
import { Icon } from '../../components/Icon'
import type { Tono } from '../../components/tonos'
import { Rol } from '../../lib/roles'
import { obtenerMiPerfilMozo, validarMesa } from '../mozos/api'
import type { Mozo } from '../mozos/types'
import { MesaCard } from './MesaCard'
import { MESAS_MOCK, type EstadoMesa, type MesaVista } from './mesas.mock'

const FILTROS: { estado: EstadoMesa; etiqueta: string; tono: Tono }[] = [
  { estado: 'libre', etiqueta: 'Libres', tono: 'libre' },
  { estado: 'ocupada', etiqueta: 'Ocupadas', tono: 'ocupado' },
  { estado: 'esperando_cobro', etiqueta: 'Esperando cobro', tono: 'pendiente' },
  { estado: 'reservada', etiqueta: 'Reservadas', tono: 'reservado' },
]

/**
 * Tablero de mesas del salón (pantalla de Stitch) con datos de prueba.
 * Es la referencia de cómo pasar una pantalla de Stitch a React.
 * Valida permisos operativos por sector para mozos (HU-02 CA2).
 */
export function MesasPage() {
  const { usuario } = useAuth()
  const [filtro, setFiltro] = useState<EstadoMesa | null>(null)
  const [perfilMozo, setPerfilMozo] = useState<Mozo | null>(null)
  const [alertaCA2, setAlertaCA2] = useState<{ tipo: 'error' | 'exito'; mensaje: string } | null>(
    null,
  )

  const esMozo = usuario?.rol === Rol.MOZO

  useEffect(() => {
    if (esMozo) {
      obtenerMiPerfilMozo()
        .then(setPerfilMozo)
        .catch(() => {
          // Si el usuario no tiene perfil aún, se maneja silenciosamente
        })
    }
  }, [esMozo])

  async function manejarOperacionMesa(mesa: MesaVista) {
    setAlertaCA2(null)
    try {
      const res = await validarMesa(mesa.numero)
      setAlertaCA2({
        tipo: 'exito',
        mensaje: `Mesa #${mesa.numero}: ${res.mensaje}`,
      })
      setTimeout(() => setAlertaCA2(null), 4000)
    } catch (e) {
      if (e instanceof ApiError) {
        setAlertaCA2({
          tipo: 'error',
          mensaje: `Mesa #${mesa.numero}: ${e.message}`,
        })
      } else {
        setAlertaCA2({
          tipo: 'error',
          mensaje: `No se pudo validar la mesa #${mesa.numero}`,
        })
      }
      setTimeout(() => setAlertaCA2(null), 6000)
    }
  }

  const mesas = MESAS_MOCK
  const visibles = filtro ? mesas.filter((m) => m.estado === filtro) : mesas

  return (
    <>
      {/* Banner de sector asignado al Mozo en sesión (CA1/CA2) */}
      {esMozo && perfilMozo && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center font-bold">
              <Icon name="badge" className="text-lg" />
            </span>
            <div>
              <span className="font-bold text-brand-900 block">
                Mozo: {perfilMozo.nombre} {perfilMozo.apellido}
              </span>
              <span className="text-slate-600">
                Sector asignado:{' '}
                <strong className="text-brand-900 font-bold">
                  {perfilMozo.sector_nombre ?? 'Sin sector asignado'}
                </strong>{' '}
                (único sector habilitado para operar según CA1 y CA2)
              </span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-white border border-amber-200 text-brand-800 font-bold text-[11px] self-start sm:self-auto">
            Restricción Operativa Activa
          </span>
        </div>
      )}

      {/* Alerta de validación de sector (CA2) */}
      {alertaCA2 && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-2 duration-200 ${
            alertaCA2.tipo === 'error'
              ? 'bg-status-busy-bg border-status-busy-border text-status-busy-text'
              : 'bg-status-free-bg border-status-free-border text-status-free-text'
          }`}
        >
          <Icon
            name={alertaCA2.tipo === 'error' ? 'report_problem' : 'check_circle'}
            className="text-base shrink-0"
          />
          <span>{alertaCA2.mensaje}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            etiqueta="Todas"
            cantidad={mesas.length}
            activo={filtro === null}
            onClick={() => setFiltro(null)}
          />
          {FILTROS.map((f) => (
            <FilterChip
              key={f.estado}
              etiqueta={f.etiqueta}
              tono={f.tono}
              cantidad={mesas.filter((m) => m.estado === f.estado).length}
              activo={filtro === f.estado}
              onClick={() => setFiltro(f.estado)}
            />
          ))}
        </div>
        <Button icono="add_circle" className="shadow-md shadow-brand-600/25">
          Nueva mesa
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visibles.map((mesa) => (
          <MesaCard key={mesa.numero} mesa={mesa} onAccion={() => manejarOperacionMesa(mesa)} />
        ))}
      </div>
    </>
  )
}
