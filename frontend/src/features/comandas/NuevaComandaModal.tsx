import { useEffect, useState } from 'react'

import { useAuth } from '../../auth/useAuth'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { mensajeDe } from '../../lib/errores'
import { Rol } from '../../lib/roles'
import { listarMozos, obtenerMiPerfilMozo } from '../mozos/api'
import type { Mozo } from '../mozos/types'
import { horaReserva, minutosHastaReserva, MINUTOS_PROXIMA } from '../salon/mesaVista'
import { crearComanda } from './api'
import type { Comanda, MesaTablero } from './types'

interface Props {
  mesa: MesaTablero | null
  /** Otras mesas libres del mismo sector, para juntarlas en la comanda. */
  libres: MesaTablero[]
  onCerrar: () => void
  onCreada: (comanda: Comanda) => void
}

/** HU-05a: abrir una comanda en una mesa libre (o varias del mismo sector). */
export function NuevaComandaModal({ mesa, libres, onCerrar, onCreada }: Props) {
  const { usuario } = useAuth()
  const esMozo = usuario?.rol === Rol.MOZO
  const [perfil, setPerfil] = useState<Mozo | null>(null)
  const [mozos, setMozos] = useState<Mozo[]>([])
  const [dni, setDni] = useState('')
  const [comensales, setComensales] = useState('2')
  const [extras, setExtras] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!mesa) return
    let vigente = true
    if (esMozo) {
      obtenerMiPerfilMozo()
        .then((p) => {
          if (!vigente) return
          setPerfil(p)
          setDni(p.dni)
        })
        .catch(() => vigente && setPerfil(null))
    } else {
      listarMozos()
        .then((lista) => {
          if (!vigente) return
          const delSector = lista.filter((m) => m.activo && m.sector_id === mesa.sector_id)
          setMozos(delSector)
          setDni(delSector[0]?.dni ?? '')
        })
        .catch(() => vigente && setMozos([]))
    }
    return () => {
      vigente = false
    }
  }, [mesa, esMozo])

  if (!mesa) return null
  const otras = libres.filter((m) => m.id !== mesa.id && m.sector_id === mesa.sector_id)
  const minutosReserva = mesa.reserva_hoy ? minutosHastaReserva(mesa.reserva_hoy) : null
  const reservaCerca =
    mesa.reserva_hoy !== null && minutosReserva !== null && minutosReserva <= MINUTOS_PROXIMA

  async function guardar() {
    if (!mesa) return
    setGuardando(true)
    setError(null)
    try {
      const comanda = await crearComanda({
        dni_mozo: dni,
        cantidad_comensales: Number(comensales),
        numeros_mesa: [mesa.numero, ...extras],
      })
      onCreada(comanda)
    } catch (e) {
      setError(mensajeDe(e))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={`Abrir comanda · Mesa ${mesa.numero}`}
      acciones={
        <>
          <Button variante="secundario" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button icono="add_circle" onClick={guardar} disabled={guardando || !dni}>
            Abrir comanda
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tono="error">{error}</Alert>}
        {reservaCerca && mesa.reserva_hoy && (
          <Alert tono="aviso">
            Esta mesa tiene una reserva a las {horaReserva(mesa.reserva_hoy)}
            {minutosReserva !== null && minutosReserva > 0
              ? ` (en ${minutosReserva} min)`
              : ' (ahora)'}
            . Podés abrir la comanda, pero liberá la mesa antes de ese horario.
          </Alert>
        )}
        {esMozo ? (
          <p className="text-xs text-slate-600">
            Mozo:{' '}
            <strong>{perfil ? `${perfil.nombre} ${perfil.apellido}` : 'sin perfil de mozo'}</strong>
          </p>
        ) : (
          <Field label="Mozo" htmlFor="nueva-mozo" ayuda={`Mozos del sector ${mesa.sector_nombre}`}>
            <select
              id="nueva-mozo"
              className={CLASE_INPUT}
              value={dni}
              onChange={(e) => setDni(e.target.value)}
            >
              {mozos.length === 0 && <option value="">No hay mozos en este sector</option>}
              {mozos.map((m) => (
                <option key={m.id} value={m.dni}>
                  {m.nombre} {m.apellido}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field
          label="Comensales"
          htmlFor="nueva-comensales"
          ayuda={`La mesa tiene ${mesa.capacidad} lugares`}
        >
          <input
            id="nueva-comensales"
            type="number"
            min={1}
            className={CLASE_INPUT}
            value={comensales}
            onChange={(e) => setComensales(e.target.value)}
          />
        </Field>
        {otras.length > 0 && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-xs font-bold text-slate-700 mb-1">
              Juntar con otras mesas libres
            </legend>
            <div className="flex flex-wrap gap-2">
              {otras.map((m) => (
                <label key={m.id} className="flex items-center gap-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={extras.includes(m.numero)}
                    onChange={(e) =>
                      setExtras((actual) =>
                        e.target.checked
                          ? [...actual, m.numero]
                          : actual.filter((n) => n !== m.numero),
                      )
                    }
                  />
                  Mesa {m.numero} ({m.capacidad})
                  {m.reserva_hoy && ` · reserva ${horaReserva(m.reserva_hoy)}`}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>
    </Modal>
  )
}
