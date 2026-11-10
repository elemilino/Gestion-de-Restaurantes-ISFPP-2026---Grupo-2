import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { useAuth } from '../../auth/useAuth'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { FilterChip } from '../../components/FilterChip'
import { Icon } from '../../components/Icon'
import type { Tono } from '../../components/tonos'
import { mensajeDe } from '../../lib/errores'
import { Rol } from '../../lib/roles'
import { tableroMesas } from '../comandas/api'
import { ComandaPanel } from '../comandas/ComandaPanel'
import { NuevaComandaModal } from '../comandas/NuevaComandaModal'
import type { MesaTablero } from '../comandas/types'
import { obtenerMiPerfilMozo } from '../mozos/api'
import type { Mozo } from '../mozos/types'
import { MesaCard } from './MesaCard'
import { aVista, type EstadoMesa } from './mesaVista'

const FILTROS: { estado: EstadoMesa; etiqueta: string; tono: Tono }[] = [
  { estado: 'libre', etiqueta: 'Libres', tono: 'libre' },
  { estado: 'ocupada', etiqueta: 'Ocupadas', tono: 'ocupado' },
  { estado: 'esperando_cobro', etiqueta: 'Esperando cobro', tono: 'pendiente' },
  { estado: 'reservada', etiqueta: 'Reservadas', tono: 'reservado' },
]

/**
 * Tablero de mesas del salón con su comanda en curso (HU-01b, HU-05, HU-06).
 * El mozo ve el sector que tiene asignado (HU-02 CA1); abrir la comanda en otro
 * sector lo rechaza el backend (HU-05a CA6).
 */
export function MesasPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const esMozo = usuario?.rol === Rol.MOZO
  const [mesas, setMesas] = useState<MesaTablero[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<EstadoMesa | null>(null)
  const [perfilMozo, setPerfilMozo] = useState<Mozo | null>(null)
  const [abrirEn, setAbrirEn] = useState<MesaTablero | null>(null)
  const [comandaId, setComandaId] = useState<number | null>(null)

  const recargar = useCallback(async () => {
    try {
      setMesas(await tableroMesas())
      setError(null)
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo cargar el tablero de mesas'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    let vigente = true
    tableroMesas()
      .then((m) => vigente && setMesas(m))
      .catch((e) => vigente && setError(mensajeDe(e, 'No se pudo cargar el tablero de mesas')))
      .finally(() => vigente && setCargando(false))
    if (esMozo) {
      obtenerMiPerfilMozo()
        .then((p) => vigente && setPerfilMozo(p))
        .catch(() => vigente && setPerfilMozo(null))
    }
    return () => {
      vigente = false
    }
  }, [esMozo])

  const cerrarPanel = useCallback(() => setComandaId(null), [])
  const cerrarNueva = useCallback(() => setAbrirEn(null), [])

  function accion(mesa: MesaTablero) {
    setAviso(null)
    if (mesa.comanda) {
      setComandaId(mesa.comanda.id)
    } else if (mesa.estado_mesa === 'reservada' && !esMozo) {
      navigate('/reservas')
    } else {
      setAbrirEn(mesa)
    }
  }

  const delSector =
    esMozo && perfilMozo?.sector_id
      ? mesas.filter((m) => m.sector_id === perfilMozo.sector_id)
      : mesas
  const visibles = filtro ? delSector.filter((m) => m.estado_mesa === filtro) : delSector

  return (
    <>
      {esMozo && perfilMozo && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 flex items-center gap-2.5 text-xs shadow-xs">
          <span className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center font-bold">
            <Icon name="badge" className="text-lg" />
          </span>
          <div>
            <span className="font-bold text-brand-900 block">
              Mozo: {perfilMozo.nombre} {perfilMozo.apellido}
            </span>
            <span className="text-slate-600">
              Sector asignado:{' '}
              <strong className="text-brand-900">
                {perfilMozo.sector_nombre ?? 'Sin sector asignado'}
              </strong>{' '}
              (solo podés operar sus mesas)
            </span>
          </div>
        </div>
      )}

      {error && <Alert tono="error">{error}</Alert>}
      {aviso && <Alert tono="exito">{aviso}</Alert>}

      <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            etiqueta="Todas"
            cantidad={delSector.length}
            activo={filtro === null}
            onClick={() => setFiltro(null)}
          />
          {FILTROS.map((f) => (
            <FilterChip
              key={f.estado}
              etiqueta={f.etiqueta}
              tono={f.tono}
              cantidad={delSector.filter((m) => m.estado_mesa === f.estado).length}
              activo={filtro === f.estado}
              onClick={() => setFiltro(f.estado)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variante="secundario" icono="refresh" onClick={recargar}>
            Actualizar
          </Button>
          {usuario?.rol === Rol.ADMINISTRADOR && (
            <Button icono="add_circle" onClick={() => navigate('/configuracion/mesas')}>
              Nueva mesa
            </Button>
          )}
        </div>
      </div>

      {cargando ? (
        <p className="text-sm text-slate-500 text-center py-10">Cargando mesas…</p>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-10">
          {mesas.length === 0 ? 'Todavía no hay mesas cargadas' : 'No hay mesas en ese estado'}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibles.map((mesa) => (
            <MesaCard key={mesa.id} mesa={aVista(mesa)} onAccion={() => accion(mesa)} />
          ))}
        </div>
      )}

      <NuevaComandaModal
        mesa={abrirEn}
        libres={mesas.filter((m) => m.estado_mesa === 'libre')}
        onCerrar={cerrarNueva}
        onCreada={(comanda) => {
          setAbrirEn(null)
          setAviso(
            `Comanda #${comanda.id} abierta en la mesa ${comanda.mesas.map((m) => m.numero).join(', ')}`,
          )
          setComandaId(comanda.id)
          recargar()
        }}
      />
      <ComandaPanel comandaId={comandaId} onCerrar={cerrarPanel} onCambio={recargar} />
    </>
  )
}
