import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { listarSectores } from './api'
import { MesaCard } from './MesaCard'
import { aVista, type EstadoMesa } from './mesaVista'

const FILTROS: { estado: EstadoMesa; etiqueta: string; tono: Tono }[] = [
  { estado: 'libre', etiqueta: 'Libres', tono: 'libre' },
  { estado: 'ocupada', etiqueta: 'Ocupadas', tono: 'ocupado' },
  { estado: 'esperando_cobro', etiqueta: 'Esperando cobro', tono: 'pendiente' },
  { estado: 'reservada', etiqueta: 'Reservadas', tono: 'reservado' },
]

interface SectorOpcion {
  id: number
  nombre: string
}

/**
 * Tablero de mesas del salón con su comanda en curso (HU-01b, HU-05, HU-06).
 * - Mozo: solo visualiza y opera las mesas de su salón/sector asignado (HU-02 CA1).
 * - Administrador y Cajero: pueden filtrar por cualquiera de los salones/sectores
 *   (Salón Principal, Terraza, Patio) o ver Todos.
 */
export function MesasPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const esMozo = usuario?.rol === Rol.MOZO
  const puedeFacturar = usuario?.rol === Rol.ADMINISTRADOR || usuario?.rol === Rol.CAJERO

  const [mesas, setMesas] = useState<MesaTablero[]>([])
  const [sectoresApi, setSectoresApi] = useState<SectorOpcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<EstadoMesa | null>(null)
  const [sectorActivo, setSectorActivo] = useState<string | null>(null)
  const [perfilMozo, setPerfilMozo] = useState<Mozo | null>(null)
  const [abrirEn, setAbrirEn] = useState<MesaTablero | null>(null)
  const [comandaId, setComandaId] = useState<number | null>(null)

  const sectoresDisponibles: SectorOpcion[] = useMemo(() => {
    const mapa = new Map<number, string>()
    for (const s of sectoresApi) mapa.set(s.id, s.nombre)
    for (const m of mesas) mapa.set(m.sector_id, m.sector_nombre)
    return Array.from(mapa.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [sectoresApi, mesas])

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
      .then((m) => {
        if (!vigente) return
        setMesas(m)
        setError(null)
      })
      .catch((e) => vigente && setError(mensajeDe(e, 'No se pudo cargar el tablero de mesas')))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [sectorActivo])

  useEffect(() => {
    let vigente = true
    if (esMozo) {
      obtenerMiPerfilMozo()
        .then((p) => vigente && setPerfilMozo(p))
        .catch(() => vigente && setPerfilMozo(null))
    } else {
      listarSectores()
        .then(
          (lista) => vigente && setSectoresApi(lista.map((s) => ({ id: s.id, nombre: s.nombre }))),
        )
        .catch(() => {})
    }
    return () => {
      vigente = false
    }
  }, [esMozo])

  const cerrarPanel = useCallback(() => setComandaId(null), [])
  const cerrarNueva = useCallback(() => setAbrirEn(null), [])

  function accion(mesa: MesaTablero) {
    setAviso(null)
    if (mesa.estado_mesa === 'esperando_cobro' && puedeFacturar) {
      navigate('/caja')
      return
    }
    if (mesa.comanda) {
      setComandaId(mesa.comanda.id)
    } else if (mesa.estado_mesa === 'reservada' && !esMozo) {
      navigate('/reservas')
    } else {
      setAbrirEn(mesa)
    }
  }

  // Mozo: solo ve las mesas de su sector asignado.
  // Admin / Cajero: filtra por el salón seleccionado o muestra todas si es null ("Todos").
  const delSector = esMozo
    ? perfilMozo?.sector_id
      ? mesas.filter((m) => m.sector_id === perfilMozo.sector_id)
      : mesas
    : sectorActivo
      ? mesas.filter((m) => m.sector_nombre === sectorActivo)
      : mesas

  const visibles = filtro
    ? delSector.filter((m) => m.estado_mesa === filtro)
    : [...delSector].sort((a, b) => {
        const aReservada = a.estado_mesa === 'reservada' ? 0 : 1
        const bReservada = b.estado_mesa === 'reservada' ? 0 : 1
        if (aReservada !== bReservada) return aReservada - bReservada
        return a.numero - b.numero
      })

  return (
    <>
      {esMozo && perfilMozo && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 flex items-center gap-2.5 text-xs shadow-xs">
          <span className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center font-bold">
            <Icon name="badge" className="text-lg" />
          </span>
          <div>
            <span className="text-slate-600">
              Sector asignado:{' '}
              <strong className="text-brand-900">
                {perfilMozo.sector_nombre ?? 'Sin sector asignado'}
              </strong>{' '}
              (solo podés ver y operar las mesas de este salón)
            </span>
          </div>
        </div>
      )}

      {error && <Alert tono="error">{error}</Alert>}
      {aviso && <Alert tono="exito">{aviso}</Alert>}

      {/* Selector de salón/sector para Admin y Cajero con cantidad de mesas */}
      {!esMozo && sectoresDisponibles.length > 0 && (
        <div className="bg-white rounded-2xl p-3.5 border border-amber-100 shadow-xs flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 px-2 flex items-center gap-1">
            <Icon name="storefront" className="text-base text-brand-600" />
            Salón / Sector:
          </span>
          <FilterChip
            etiqueta="Todos"
            cantidad={mesas.length}
            activo={sectorActivo === null}
            onClick={() => setSectorActivo(null)}
          />
          {sectoresDisponibles.map((s) => (
            <FilterChip
              key={s.id}
              etiqueta={s.nombre}
              cantidad={mesas.filter((m) => m.sector_nombre === s.nombre).length}
              activo={sectorActivo === s.nombre}
              onClick={() => setSectorActivo(s.nombre)}
            />
          ))}
        </div>
      )}

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
            <MesaCard
              key={mesa.id}
              mesa={aVista(mesa)}
              puedeFacturar={puedeFacturar}
              onAccion={() => accion(mesa)}
            />
          ))}
        </div>
      )}

      <NuevaComandaModal
        mesa={abrirEn}
        libres={delSector.filter((m) => m.estado_mesa === 'libre')}
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
