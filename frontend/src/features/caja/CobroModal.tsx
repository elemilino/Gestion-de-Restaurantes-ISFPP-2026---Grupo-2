import { useEffect, useState } from 'react'

import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { mensajeDe } from '../../lib/errores'
import { formatMoneda } from '../../lib/format'
import { cobrarFactura, listarMediosPago } from './api'
import type { Factura, MedioPago } from './types'

const INPUT = CLASE_INPUT.replace('h-12', 'h-9')

interface Linea {
  medio: string
  monto: string
}

/**
 * HU-08b: cobra una factura adeudada con uno o varios medios de pago activos.
 * Cada medio aplica su recargo (CA2); el total a pagar suma los montos con
 * recargo (CA4).
 */
export function CobroModal({
  factura,
  onCerrar,
  onCobrada,
}: {
  factura: Factura | null
  onCerrar: () => void
  onCobrada: (factura: Factura) => void
}) {
  const [medios, setMedios] = useState<MedioPago[]>([])
  const [lineas, setLineas] = useState<Linea[]>([])
  const [recibido, setRecibido] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!factura) return
    let vigente = true
    listarMediosPago(true)
      .then((m) => {
        if (!vigente) return
        setMedios(m)
        setLineas([{ medio: m[0] ? String(m[0].id) : '', monto: factura.importe_total }])
      })
      .catch((e) => vigente && setError(mensajeDe(e)))
    return () => {
      vigente = false
    }
  }, [factura])

  if (!factura) return null
  const importe = Number(factura.importe_total)
  const abonado = lineas.reduce((s, l) => s + (Number(l.monto) || 0), 0)
  const conRecargo = lineas.reduce((s, l) => {
    const medio = medios.find((m) => String(m.id) === l.medio)
    const monto = Number(l.monto) || 0
    return s + monto * (1 + Number(medio?.porcentaje_recargo ?? 0) / 100)
  }, 0)
  const falta = Math.max(importe - abonado, 0)

  function cambiar(i: number, cambio: Partial<Linea>) {
    setLineas((actual) => actual.map((l, j) => (j === i ? { ...l, ...cambio } : l)))
  }

  async function cobrar() {
    if (!factura) return
    setGuardando(true)
    setError(null)
    try {
      const pagada = await cobrarFactura(factura.id, {
        pagos: lineas
          .filter((l) => l.medio && Number(l.monto) > 0)
          .map((l) => ({ medio_pago_id: Number(l.medio), monto_abonado: l.monto })),
        monto_recibido: recibido || undefined,
      })
      onCobrada(pagada)
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
      titulo={`Cobrar factura #${factura.id}`}
      ancho="max-w-xl"
      acciones={
        <>
          <Button variante="secundario" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button icono="payments" onClick={cobrar} disabled={guardando || falta > 0}>
            Registrar cobro
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tono="error">{error}</Alert>}
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Importe de la factura</span>
          <strong className="tabular">{formatMoneda(factura.importe_total)}</strong>
        </div>
        {lineas.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_8rem_auto] gap-2 items-end">
            <Field label={`Medio de pago ${i + 1}`} htmlFor={`cobro-medio-${i}`}>
              <select
                id={`cobro-medio-${i}`}
                className={INPUT}
                value={l.medio}
                onChange={(e) => cambiar(i, { medio: e.target.value })}
              >
                {medios.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                    {Number(m.porcentaje_recargo) > 0
                      ? ` (+${Number(m.porcentaje_recargo)} %)`
                      : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Monto" htmlFor={`cobro-monto-${i}`}>
              <input
                id={`cobro-monto-${i}`}
                type="number"
                min={0}
                step="0.01"
                className={INPUT}
                value={l.monto}
                onChange={(e) => cambiar(i, { monto: e.target.value })}
              />
            </Field>
            <button
              type="button"
              aria-label={`Quitar el medio de pago ${i + 1}`}
              disabled={lineas.length === 1}
              onClick={() => setLineas((actual) => actual.filter((_, j) => j !== i))}
              className="h-9 w-9 rounded-xl border border-borde text-slate-400 hover:text-status-busy-text disabled:opacity-30"
            >
              <Icon name="close" className="text-base" />
            </button>
          </div>
        ))}
        {falta > 0 && (
          <Button
            variante="secundario"
            icono="add"
            onClick={() =>
              setLineas((actual) => [
                ...actual,
                { medio: medios[0] ? String(medios[0].id) : '', monto: falta.toFixed(2) },
              ])
            }
          >
            Agregar otro medio de pago (faltan {formatMoneda(falta)})
          </Button>
        )}
        <Field label="Monto recibido (opcional, para calcular el vuelto)" htmlFor="cobro-recibido">
          <input
            id="cobro-recibido"
            type="number"
            min={0}
            step="0.01"
            className={INPUT}
            value={recibido}
            onChange={(e) => setRecibido(e.target.value)}
          />
        </Field>
        <div className="rounded-xl bg-canvas border border-borde p-3 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Abonado</span>
            <span className="tabular">{formatMoneda(abonado)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Total a pagar (con recargos)</span>
            <span className="tabular">{formatMoneda(Math.round(conRecargo * 100) / 100)}</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
