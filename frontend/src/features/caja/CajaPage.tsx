import { useCallback, useEffect, useState } from 'react'

import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { FilterChip } from '../../components/FilterChip'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { StatusBadge } from '../../components/StatusBadge'
import { mensajeDe } from '../../lib/errores'
import { formatMoneda } from '../../lib/format'
import { comandasPorFacturar, generarFactura, listarFacturas } from './api'
import { CobroModal } from './CobroModal'
import { ComprobanteModal } from './ComprobanteModal'
import type { ComandaPorFacturar, EstadoFactura, Factura, TipoFactura } from './types'

const TIPOS: TipoFactura[] = ['Consumidor Final', 'A', 'B', 'C']

function fechaHora(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
    : '—'
}

/** Caja: genera la factura de una comanda cerrada (HU-08a) y la cobra (HU-08b). */
export function CajaPage() {
  const [pendientes, setPendientes] = useState<ComandaPorFacturar[]>([])
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [filtro, setFiltro] = useState<EstadoFactura | null>('Adeudada')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const [aFacturar, setAFacturar] = useState<ComandaPorFacturar | null>(null)
  const [tipo, setTipo] = useState<TipoFactura>('Consumidor Final')
  const [cuit, setCuit] = useState('')
  const [errorFactura, setErrorFactura] = useState<string | null>(null)
  const [aCobrar, setACobrar] = useState<Factura | null>(null)
  const [comprobanteDe, setComprobanteDe] = useState<number | null>(null)

  const recargar = useCallback(async () => {
    try {
      const [p, f] = await Promise.all([comandasPorFacturar(), listarFacturas()])
      setPendientes(p)
      setFacturas(f)
      setError(null)
    } catch (e) {
      setError(mensajeDe(e))
    }
  }, [])

  useEffect(() => {
    let vigente = true
    Promise.all([comandasPorFacturar(), listarFacturas()])
      .then(([p, f]) => {
        if (!vigente) return
        setPendientes(p)
        setFacturas(f)
      })
      .catch((e) => vigente && setError(mensajeDe(e)))
    return () => {
      vigente = false
    }
  }, [])

  const cerrarFactura = useCallback(() => setAFacturar(null), [])
  const cerrarCobro = useCallback(() => setACobrar(null), [])
  const cerrarComprobante = useCallback(() => setComprobanteDe(null), [])

  async function confirmarFactura() {
    if (!aFacturar) return
    setErrorFactura(null)
    try {
      const factura = await generarFactura({
        comanda_id: aFacturar.comanda_id,
        tipo_factura: tipo,
        cuit_dni_cliente: cuit.trim() || null,
      })
      setAFacturar(null)
      setAviso(`Factura #${factura.id} generada por ${formatMoneda(factura.total_a_pagar)}`)
      setFiltro('Adeudada')
      await recargar()
      setACobrar(factura)
    } catch (e) {
      setErrorFactura(mensajeDe(e))
    }
  }

  const visibles = filtro ? facturas.filter((f) => f.estado === filtro) : facturas

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl p-5 border border-borde shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700">
            <Icon name="point_of_sale" className="text-xl" />
          </span>
          <h1 className="text-xl font-bold text-slate-900">Caja</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Factura las comandas cerradas y registra su cobro con uno o varios medios de pago (HU-08a,
          HU-08b).
        </p>
      </div>
      {error && <Alert tono="error">{error}</Alert>}
      {aviso && <Alert tono="exito">{aviso}</Alert>}

      <section className="bg-white rounded-2xl border border-borde shadow-xs overflow-hidden">
        <h2 className="px-5 py-3 text-sm font-bold text-slate-900 border-b border-borde">
          Comandas por facturar ({pendientes.length})
        </h2>
        {pendientes.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            No hay comandas cerradas esperando factura
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-amber-50/50 border-b border-borde text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">Comanda</th>
                  <th className="py-2.5 px-4">Cierre</th>
                  <th className="py-2.5 px-4">Mesas</th>
                  <th className="py-2.5 px-4">Mozo</th>
                  <th className="py-2.5 px-4 text-right">Importe</th>
                  <th className="py-2.5 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {pendientes.map((c) => (
                  <tr key={c.comanda_id}>
                    <td className="py-2.5 px-4 font-bold tabular">#{c.comanda_id}</td>
                    <td className="py-2.5 px-4 tabular">{fechaHora(c.fecha_hora_cierre)}</td>
                    <td className="py-2.5 px-4">{c.mesas.join(', ')}</td>
                    <td className="py-2.5 px-4">{c.mozo}</td>
                    <td className="py-2.5 px-4 text-right tabular font-semibold">
                      {formatMoneda(c.importe)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Button
                        icono="receipt"
                        onClick={() => {
                          setTipo('Consumidor Final')
                          setCuit('')
                          setErrorFactura(null)
                          setAFacturar(c)
                        }}
                      >
                        Generar factura
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-borde shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-borde flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900">Facturas</h2>
          <div className="flex gap-2">
            <FilterChip
              etiqueta="Adeudadas"
              tono="pendiente"
              activo={filtro === 'Adeudada'}
              onClick={() => setFiltro('Adeudada')}
            />
            <FilterChip
              etiqueta="Pagadas"
              tono="libre"
              activo={filtro === 'Pagada'}
              onClick={() => setFiltro('Pagada')}
            />
            <FilterChip etiqueta="Todas" activo={filtro === null} onClick={() => setFiltro(null)} />
          </div>
        </div>
        {visibles.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">No hay facturas en este estado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-amber-50/50 border-b border-borde text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">Factura</th>
                  <th className="py-2.5 px-4">Fecha</th>
                  <th className="py-2.5 px-4">Tipo</th>
                  <th className="py-2.5 px-4">Comanda</th>
                  <th className="py-2.5 px-4">Estado</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {visibles.map((f) => (
                  <tr key={f.id}>
                    <td className="py-2.5 px-4 font-bold tabular">#{f.id}</td>
                    <td className="py-2.5 px-4 tabular">{fechaHora(f.fecha)}</td>
                    <td className="py-2.5 px-4">{f.tipo_factura}</td>
                    <td className="py-2.5 px-4 tabular">#{f.comanda_id}</td>
                    <td className="py-2.5 px-4">
                      <StatusBadge tono={f.estado === 'Pagada' ? 'libre' : 'pendiente'}>
                        {f.estado}
                      </StatusBadge>
                    </td>
                    <td className="py-2.5 px-4 text-right tabular font-semibold">
                      {formatMoneda(f.total_a_pagar)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {f.estado === 'Adeudada' ? (
                        <Button icono="payments" onClick={() => setACobrar(f)}>
                          Cobrar
                        </Button>
                      ) : (
                        <Button
                          variante="secundario"
                          icono="description"
                          onClick={() => setComprobanteDe(f.id)}
                        >
                          Comprobante
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        abierto={aFacturar !== null}
        onCerrar={cerrarFactura}
        titulo={`Generar factura · Comanda #${aFacturar?.comanda_id ?? ''}`}
        acciones={
          <>
            <Button variante="secundario" onClick={cerrarFactura}>
              Cancelar
            </Button>
            <Button icono="receipt" onClick={confirmarFactura}>
              Generar factura
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {errorFactura && <Alert tono="error">{errorFactura}</Alert>}
          <p className="text-sm">
            Importe: <strong className="tabular">{formatMoneda(aFacturar?.importe ?? 0)}</strong>
          </p>
          <Field label="Tipo de factura" htmlFor="factura-tipo">
            <select
              id="factura-tipo"
              className={CLASE_INPUT}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoFactura)}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="CUIT o DNI del cliente (opcional)" htmlFor="factura-cuit">
            <input
              id="factura-cuit"
              className={CLASE_INPUT}
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
            />
          </Field>
        </div>
      </Modal>

      <CobroModal
        key={aCobrar?.id ?? 'sin-cobro'}
        factura={aCobrar}
        onCerrar={cerrarCobro}
        onCobrada={async (f) => {
          setACobrar(null)
          setAviso(`Factura #${f.id} cobrada: ${formatMoneda(f.total_a_pagar)}`)
          await recargar()
          setComprobanteDe(f.id)
        }}
      />
      <ComprobanteModal
        key={comprobanteDe ?? 'sin-comprobante'}
        facturaId={comprobanteDe}
        onCerrar={cerrarComprobante}
      />
    </div>
  )
}
