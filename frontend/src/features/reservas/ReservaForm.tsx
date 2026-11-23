import { useEffect, useMemo, useState } from 'react'

import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { mensajeDe } from '../../lib/errores'
import { formatMoneda } from '../../lib/format'
import { listarMediosPago } from '../caja/api'
import type { MedioPago } from '../caja/types'
import { verCarta } from '../carta/api'
import type { ProductoCarta } from '../carta/types'
import { listarClientes } from '../clientes/api'
import type { Cliente } from '../clientes/types'
import { listarMesas } from '../salon/api'
import type { Mesa } from '../salon/types'
import { crearReserva, listarReservas, modificarReserva } from './api'
import type { Reserva, ReservaDatos } from './types'

const INPUT = CLASE_INPUT.replace('h-12', 'h-10')

const HORAS_OPERATIVAS = Array.from(
  { length: 14 },
  (_, i) => `${String(10 + i).padStart(2, '0')}:00`,
)

interface Linea {
  producto: string
  cantidad: string
  precio: string
}

/** HU-11a: alta (con seña obligatoria) y modificación de una reserva activa. */
export function ReservaForm({
  reserva,
  onCerrar,
  onGuardada,
}: {
  /** `null` = alta; una reserva = modificación. */
  reserva: Reserva | null
  onCerrar: () => void
  onGuardada: (reserva: Reserva) => void
}) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [medios, setMedios] = useState<MedioPago[]>([])
  const [platos, setPlatos] = useState<ProductoCarta[]>([])
  const [reservasDelDia, setReservasDelDia] = useState<Reserva[]>([])

  const [cliente, setCliente] = useState(reserva?.cliente ? String(reserva.cliente.id) : '')
  const [fecha, setFecha] = useState(reserva?.fecha ?? '')
  const horaInicial = reserva ? `${reserva.hora.slice(0, 2)}:00` : '21:00'
  const [hora, setHora] = useState(HORAS_OPERATIVAS.includes(horaInicial) ? horaInicial : '21:00')
  const [sectorId, setSectorId] = useState<string>('')
  const [comensales, setComensales] = useState(String(reserva?.cantidad_comensales ?? 2))
  const [elegidas, setElegidas] = useState<number[]>(reserva?.mesas.map((m) => m.numero) ?? [])
  const [monto, setMonto] = useState('')
  const [medio, setMedio] = useState('')
  const [menu, setMenu] = useState<Linea[]>(
    reserva?.menu_acordado.map((m) => ({
      producto: String(m.producto_id),
      cantidad: String(m.cantidad),
      precio: m.precio,
    })) ?? [],
  )
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vigente = true
    listarClientes()
      .then((c) => vigente && setClientes(c))
      .catch(() => vigente && setClientes([]))
    listarMesas()
      .then((m) => {
        if (!vigente) return
        setMesas(m)
        if (m.length > 0) {
          const mesaReserva = reserva?.mesas[0]
            ? m.find((x) => x.numero === reserva.mesas[0].numero)
            : undefined
          setSectorId(String(mesaReserva ? mesaReserva.sector_id : m[0].sector_id))
        }
      })
      .catch(() => vigente && setMesas([]))
    listarMediosPago(true)
      .then((m) => {
        if (!vigente) return
        setMedios(m)
        setMedio((actual) => actual || (m[0] ? String(m[0].id) : ''))
      })
      .catch(() => vigente && setMedios([]))
    verCarta()
      .then(
        (c) =>
          vigente &&
          setPlatos(c.secciones.flatMap((s) => s.productos).filter((p) => p.tipo === 'PLATO')),
      )
      .catch(() => vigente && setPlatos([]))
    return () => {
      vigente = false
    }
  }, [reserva])

  useEffect(() => {
    if (!fecha) return
    let vigente = true
    listarReservas({ fecha, estado: 'ACTIVA' })
      .then((lista) => {
        if (!vigente) return
        setReservasDelDia(Array.isArray(lista) ? lista : [])
      })
      .catch(() => {
        if (vigente) setReservasDelDia([])
      })
    return () => {
      vigente = false
    }
  }, [fecha])

  const sectores = useMemo(
    () =>
      Array.from(
        new Map(
          mesas.map((m) => [m.sector_id, { id: m.sector_id, nombre: m.sector_nombre }]),
        ).values(),
      ),
    [mesas],
  )

  const mesasOcupadasEnHorario = useMemo(() => {
    const ocupadas = new Set<number>()
    if (!fecha || !hora) return ocupadas
    const inicioSel = Number(hora.slice(0, 2))
    const finSel = inicioSel + 1
    for (const r of reservasDelDia) {
      if (reserva && r.id === reserva.id) continue
      if (r.fecha !== fecha || r.estado !== 'ACTIVA') continue
      const inicioR = Number(r.hora.slice(0, 2))
      const finR = inicioR + (r.duracion_horas || 1)
      if (inicioR < finSel && inicioSel < finR) {
        for (const m of r.mesas) {
          ocupadas.add(m.numero)
        }
      }
    }
    return ocupadas
  }, [fecha, hora, reservasDelDia, reserva])

  const mesasDisponibles = useMemo(
    () =>
      mesas.filter(
        (m) =>
          (!sectorId || String(m.sector_id) === sectorId) && !mesasOcupadasEnHorario.has(m.numero),
      ),
    [mesas, sectorId, mesasOcupadasEnHorario],
  )

  const elegidasDisponibles = useMemo(() => {
    if (mesas.length === 0) return elegidas
    const disponiblesSet = new Set(mesasDisponibles.map((m) => m.numero))
    return elegidas.filter((n) => disponiblesSet.has(n))
  }, [mesas.length, mesasDisponibles, elegidas])

  const capacidadSector = mesasDisponibles.reduce((s, m) => s + m.capacidad, 0)
  const capacidad = mesasDisponibles
    .filter((m) => elegidasDisponibles.includes(m.numero))
    .reduce((s, m) => s + m.capacidad, 0)
  const numComensales = Number(comensales) || 0
  const excedeSector = mesasDisponibles.length > 0 && numComensales > capacidadSector
  const excedeMesas = elegidasDisponibles.length > 0 && numComensales > capacidad

  async function guardar() {
    if (excedeSector) {
      setError(
        `La cantidad de comensales (${numComensales}) supera la capacidad máxima disponible del espacio (${capacidadSector} lugares).`,
      )
      return
    }
    if (excedeMesas) {
      setError(
        `Las mesas elegidas tienen ${capacidad} lugares: faltan ${numComensales - capacidad} para ${numComensales} comensales.`,
      )
      return
    }
    setGuardando(true)
    setError(null)
    const datos: ReservaDatos = {
      fecha,
      hora,
      cantidad_comensales: numComensales,
      numeros_mesa: elegidasDisponibles,
      cliente_id: Number(cliente),
      menu_acordado: menu
        .filter((l) => l.producto)
        .map((l) => ({
          producto_id: Number(l.producto),
          cantidad: Number(l.cantidad),
          precio_acordado: l.precio || '0',
        })),
    }
    try {
      const guardada = reserva
        ? await modificarReserva(reserva.id, datos)
        : await crearReserva({
            ...datos,
            sena: monto ? { monto, medio_pago_id: Number(medio) } : undefined,
          })
      onGuardada(guardada)
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
      titulo={reserva ? `Modificar reserva #${reserva.id}` : 'Nueva reserva'}
      ancho="max-w-2xl"
      acciones={
        <>
          <Button variante="secundario" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            icono="event_available"
            onClick={guardar}
            disabled={
              guardando ||
              !cliente ||
              !fecha ||
              elegidasDisponibles.length === 0 ||
              excedeSector ||
              excedeMesas
            }
          >
            Guardar reserva
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tono="error">{error}</Alert>}
        {excedeSector && (
          <Alert tono="error">
            La cantidad de comensales ({numComensales}) supera la capacidad máxima disponible del
            espacio seleccionado ({capacidadSector} lugares).
          </Alert>
        )}
        {!excedeSector && excedeMesas && (
          <Alert tono="error">
            La cantidad de comensales ({numComensales}) supera la capacidad de las mesas
            seleccionadas ({capacidad} lugares).
          </Alert>
        )}
        <Field
          label="Cliente"
          htmlFor="reserva-cliente"
          ayuda="Si no está, registralo primero en Clientes"
        >
          <select
            id="reserva-cliente"
            className={INPUT}
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
          >
            <option value="">Elegí el cliente…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.apellido}, {c.nombre} · DNI {c.dni}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Espacio" htmlFor="reserva-espacio">
            <select
              id="reserva-espacio"
              className={INPUT}
              value={sectorId}
              onChange={(e) => {
                setSectorId(e.target.value)
                setElegidas([])
              }}
            >
              {sectores.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha" htmlFor="reserva-fecha">
            <input
              id="reserva-fecha"
              type="date"
              className={INPUT}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Field>
          <Field label="Hora" htmlFor="reserva-hora">
            <select
              id="reserva-hora"
              className={INPUT}
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            >
              {HORAS_OPERATIVAS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Comensales" htmlFor="reserva-comensales">
            <input
              id="reserva-comensales"
              type="number"
              min={1}
              className={INPUT}
              value={comensales}
              onChange={(e) => setComensales(e.target.value)}
            />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-bold text-slate-700 mb-1">
            Mesas disponibles ({capacidad} lugares elegidos de {capacidadSector} disponibles)
          </legend>
          {mesasDisponibles.length === 0 ? (
            <p className="text-xs text-slate-400">
              No hay mesas disponibles en este espacio para la fecha y hora seleccionadas.
            </p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {mesasDisponibles.map((m) => (
                <label key={m.id} className="flex items-center gap-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={elegidasDisponibles.includes(m.numero)}
                    onChange={(e) =>
                      setElegidas((actual) =>
                        e.target.checked
                          ? [...actual, m.numero]
                          : actual.filter((n) => n !== m.numero),
                      )
                    }
                  />
                  Mesa {m.numero} · {m.capacidad} lug. · {m.sector_nombre}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {!reserva && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Seña ($)" htmlFor="reserva-sena" ayuda="Obligatoria">
              <input
                id="reserva-sena"
                type="number"
                min={0}
                step="0.01"
                className={INPUT}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </Field>
            <Field label="Medio de pago de la seña" htmlFor="reserva-medio">
              <select
                id="reserva-medio"
                className={INPUT}
                value={medio}
                onChange={(e) => setMedio(e.target.value)}
              >
                {medios.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-bold text-slate-700 mb-1">
            Menú acordado (opcional)
          </legend>
          {menu.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem_7rem_auto] gap-2 items-end">
              <Field label={`Plato ${i + 1}`} htmlFor={`menu-plato-${i}`}>
                <select
                  id={`menu-plato-${i}`}
                  className={INPUT}
                  value={l.producto}
                  onChange={(e) => {
                    const plato = platos.find((p) => String(p.id) === e.target.value)
                    setMenu((actual) =>
                      actual.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              producto: e.target.value,
                              precio: plato ? (plato.precio_final ?? plato.precio) : x.precio,
                            }
                          : x,
                      ),
                    )
                  }}
                >
                  <option value="">Elegí un plato…</option>
                  {platos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({formatMoneda(p.precio_final ?? p.precio)})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cantidad" htmlFor={`menu-cantidad-${i}`}>
                <input
                  id={`menu-cantidad-${i}`}
                  type="number"
                  min={1}
                  className={INPUT}
                  value={l.cantidad}
                  onChange={(e) =>
                    setMenu((actual) =>
                      actual.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)),
                    )
                  }
                />
              </Field>
              <Field label="Precio acordado" htmlFor={`menu-precio-${i}`}>
                <input
                  id={`menu-precio-${i}`}
                  type="number"
                  min={0}
                  step="0.01"
                  className={INPUT}
                  value={l.precio}
                  onChange={(e) =>
                    setMenu((actual) =>
                      actual.map((x, j) => (j === i ? { ...x, precio: e.target.value } : x)),
                    )
                  }
                />
              </Field>
              <button
                type="button"
                aria-label={`Quitar el plato ${i + 1}`}
                onClick={() => setMenu((actual) => actual.filter((_, j) => j !== i))}
                className="h-10 w-10 rounded-xl border border-borde text-slate-400 hover:text-status-busy-text"
              >
                <Icon name="close" className="text-base" />
              </button>
            </div>
          ))}
          <div>
            <Button
              variante="secundario"
              icono="add"
              onClick={() =>
                setMenu((actual) => [...actual, { producto: '', cantidad: '1', precio: '' }])
              }
            >
              Agregar plato al menú
            </Button>
          </div>
        </fieldset>
      </div>
    </Modal>
  )
}
