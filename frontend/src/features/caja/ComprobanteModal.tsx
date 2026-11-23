import { useEffect, useState } from 'react'

import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { mensajeDe } from '../../lib/errores'
import { formatMoneda } from '../../lib/format'
import { obtenerComprobante } from './api'
import type { Comprobante } from './types'

/** HU-08b: comprobante de pago de una factura pagada, listo para imprimir. */
export function ComprobanteModal({
  facturaId,
  onCerrar,
}: {
  facturaId: number | null
  onCerrar: () => void
}) {
  const [comprobante, setComprobante] = useState<Comprobante | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (facturaId === null) return
    let vigente = true
    obtenerComprobante(facturaId)
      .then((c) => vigente && setComprobante(c))
      .catch((e) => vigente && setError(mensajeDe(e)))
    return () => {
      vigente = false
    }
  }, [facturaId])

  if (facturaId === null) return null
  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={`Comprobante de pago · Factura #${facturaId}`}
      acciones={
        <>
          <Button variante="secundario" onClick={onCerrar}>
            Cerrar
          </Button>
          <Button icono="print" onClick={() => window.print()} disabled={!comprobante}>
            Imprimir
          </Button>
        </>
      }
    >
      {error && <Alert tono="error">{error}</Alert>}
      {!comprobante ? (
        !error && <p className="text-sm text-slate-500">Cargando comprobante…</p>
      ) : (
        <div className="flex flex-col gap-3 text-xs">
          <div className="grid grid-cols-2 gap-1 text-slate-600">
            <span>Factura {comprobante.tipo_factura}</span>
            <span className="text-right">
              {new Date(comprobante.fecha).toLocaleString('es-AR')}
            </span>
            <span>Comanda #{comprobante.comanda_id}</span>
            <span className="text-right">
              Mesa {comprobante.mesa_numero ?? '—'} · {comprobante.mozo_nombre ?? ''}
            </span>
            {comprobante.cuit_dni_cliente && <span>CUIT/DNI {comprobante.cuit_dni_cliente}</span>}
          </div>
          <table className="w-full border-collapse">
            <tbody className="divide-y divide-borde">
              {comprobante.items.map((it) => (
                <tr key={it.producto_nombre}>
                  <td className="py-1.5">
                    {it.cantidad} × {it.producto_nombre}
                  </td>
                  <td className="py-1.5 text-right tabular">{formatMoneda(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-borde pt-2 flex flex-col gap-1">
            <div className="flex justify-between">
              <span>Importe</span>
              <span className="tabular">{formatMoneda(comprobante.importe_total)}</span>
            </div>
            {Number(comprobante.descuento_sena) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Seña descontada (reserva)</span>
                <span className="tabular">-{formatMoneda(comprobante.descuento_sena)}</span>
              </div>
            )}
            {comprobante.detalles_pago.map((d) => (
              <div key={d.id} className="flex justify-between text-slate-600">
                <span>
                  {d.medio_pago_nombre}
                  {Number(d.porcentaje_recargo) > 0 ? ` (+${Number(d.porcentaje_recargo)} %)` : ''}
                </span>
                <span className="tabular">{formatMoneda(d.monto_con_recargo)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-sm">
              <span>Total pagado</span>
              <span className="tabular">{formatMoneda(comprobante.total_a_pagar)}</span>
            </div>
            {Number(comprobante.vuelto) > 0 && (
              <div className="flex justify-between">
                <span>Vuelto</span>
                <span className="tabular">{formatMoneda(comprobante.vuelto)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
