/** Las 6 vistas de reportes (HU-12a a HU-12f). Cada una recibe el período elegido. */
import { useEffect, useState } from 'react'

import { CLASE_INPUT, Field } from '../../components/Field'
import { formatMoneda } from '../../lib/format'
import {
  listarSecciones,
  listarSectores,
  reporteCobros,
  reporteMozos,
  reporteOcupacion,
  reporteProductos,
  reporteReservas,
  reporteVentas,
} from './api'
import { Cifra, Estado, MarcaBaja, Tarjeta } from './comun'
import { CATEGORICOS, claveFiltro, fechaLarga } from './formato'
import { useReporte } from './useReporte'
import { BarrasHorizontales, Dona, LineaDiaria, MapaCalor, TablaDatos } from './graficos'
import type { EstadoReserva, FiltroPeriodo, Opcion } from './types'

const CLASE_FILTRO = CLASE_INPUT.replace('h-12', 'h-9') + ' min-w-36'

const TIPOS: Record<string, string> = {
  PLATO: 'Plato',
  POSTRE: 'Postre',
  BEBIDA: 'Bebida',
  MENU_EJECUTIVO: 'Menú ejecutivo',
  MENU_DEL_DIA: 'Menú del día',
}

function useOpciones(pedir: () => Promise<Opcion[]>): Opcion[] {
  const [opciones, setOpciones] = useState<Opcion[]>([])
  useEffect(() => {
    pedir()
      .then(setOpciones)
      .catch(() => setOpciones([]))
  }, [pedir])
  return opciones
}

// ------------------------------------------------------------------ HU-12a

export function VentasReporte({ filtro }: { filtro: FiltroPeriodo }) {
  const { datos, error, cargando } = useReporte(() => reporteVentas(filtro), claveFiltro(filtro))
  const puntos = datos?.por_dia.map((d) => ({ fecha: d.fecha, total: Number(d.total) })) ?? []
  return (
    <Tarjeta
      titulo="Ventas por período"
      hu="HU-12a · Facturas pagadas, por fecha de factura"
      periodo={datos ?? undefined}
    >
      <Estado cargando={cargando} error={error} mensaje={datos?.mensaje}>
        {datos && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Cifra etiqueta="Total facturado" valor={formatMoneda(datos.total_facturado)} />
              <Cifra etiqueta="Facturas" valor={String(datos.cantidad_facturas)} />
              <Cifra etiqueta="Ticket promedio" valor={formatMoneda(datos.ticket_promedio)} />
              <Cifra
                etiqueta="Pendiente de cobro"
                valor={formatMoneda(datos.pendiente_cobro)}
                ayuda="Facturas adeudadas (no suman al total)"
              />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-700 mb-2">Total facturado por día</h3>
              <LineaDiaria puntos={puntos} />
            </div>
            <TablaDatos
              columnas={['Día', 'Total facturado']}
              filas={datos.por_dia.map((d) => [fechaLarga(d.fecha), formatMoneda(d.total)])}
            />
          </>
        )}
      </Estado>
    </Tarjeta>
  )
}

// ------------------------------------------------------------------ HU-12b

export function ProductosReporte({ filtro }: { filtro: FiltroPeriodo }) {
  const [tipo, setTipo] = useState('')
  const [seccion, setSeccion] = useState('')
  const secciones = useOpciones(listarSecciones)
  const extra = { tipo: tipo || undefined, seccion_id: seccion ? Number(seccion) : undefined }
  const { datos, error, cargando } = useReporte(
    () => reporteProductos({ ...filtro, ...extra }),
    claveFiltro(filtro, extra),
  )
  return (
    <Tarjeta
      titulo="Productos más vendidos"
      hu="HU-12b · Top 10 por unidades, en comandas facturadas"
      periodo={datos ?? undefined}
      acciones={
        <>
          <Field label="Tipo" htmlFor="filtro-tipo">
            <select
              id="filtro-tipo"
              className={CLASE_FILTRO}
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              <option value="">Todos</option>
              {Object.entries(TIPOS).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sección" htmlFor="filtro-seccion">
            <select
              id="filtro-seccion"
              className={CLASE_FILTRO}
              value={seccion}
              onChange={(e) => setSeccion(e.target.value)}
            >
              <option value="">Todas</option>
              {secciones.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </Field>
        </>
      }
    >
      <Estado cargando={cargando} error={error} mensaje={datos?.mensaje}>
        {datos && datos.productos.length > 0 && (
          <>
            <BarrasHorizontales
              barras={datos.productos.map((p) => ({
                clave: p.producto_id,
                etiqueta: (
                  <>
                    <span className="text-slate-400 tabular mr-1.5">{p.posicion}.</span>
                    {p.nombre}
                    {p.eliminado && <MarcaBaja texto="Eliminado" />}
                  </>
                ),
                detalle: `${p.nombre} (${TIPOS[p.tipo]}, ${p.seccion}): ${p.unidades} unidades, ${formatMoneda(p.importe)}`,
                valor: p.unidades,
                texto: `${p.unidades} u.`,
              }))}
            />
            <TablaDatos
              columnas={['#', 'Producto', 'Tipo', 'Sección', 'Unidades', 'Importe vendido']}
              filas={datos.productos.map((p) => [
                p.posicion,
                p.nombre + (p.eliminado ? ' (eliminado)' : ''),
                TIPOS[p.tipo],
                p.seccion,
                p.unidades,
                formatMoneda(p.importe),
              ])}
            />
          </>
        )}
      </Estado>
    </Tarjeta>
  )
}

// ------------------------------------------------------------------ HU-12c

export function MozosReporte({ filtro }: { filtro: FiltroPeriodo }) {
  const [dni, setDni] = useState('')
  const [dniAplicado, setDniAplicado] = useState('')
  const extra = { dni: dniAplicado || undefined }
  const { datos, error, cargando } = useReporte(
    () => reporteMozos({ ...filtro, ...extra }),
    claveFiltro(filtro, extra),
  )
  const detalle = dniAplicado && datos?.mozos[0]?.detalle

  return (
    <Tarjeta
      titulo="Ventas y comandas por mozo"
      hu="HU-12c · Comandas cerradas por fecha de cierre; facturado = facturas pagadas"
      periodo={datos ?? undefined}
      acciones={
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setDniAplicado(dni.trim())
          }}
        >
          <Field label="DNI del mozo (opcional)" htmlFor="filtro-dni">
            <input
              id="filtro-dni"
              className={CLASE_FILTRO}
              inputMode="numeric"
              placeholder="Todos los mozos"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
            />
          </Field>
          <button
            type="submit"
            className="h-9 px-3 rounded-xl bg-slate-900 text-white text-xs font-bold"
          >
            Filtrar
          </button>
        </form>
      }
    >
      <Estado cargando={cargando} error={error} mensaje={datos?.mensaje}>
        {datos && datos.mozos.length > 0 && (
          <>
            <BarrasHorizontales
              barras={datos.mozos.map((m) => ({
                clave: m.mozo_id,
                etiqueta: (
                  <>
                    {m.apellido}, {m.nombre}
                    {m.dado_de_baja && <MarcaBaja />}
                  </>
                ),
                detalle: `${m.comandas} comandas, ${m.comensales} comensales, promedio ${formatMoneda(m.promedio_por_comanda)}`,
                valor: Number(m.total_facturado),
                texto: formatMoneda(m.total_facturado),
              }))}
            />
            <TablaDatos
              columnas={['Mozo', 'DNI', 'Comandas', 'Comensales', 'Total facturado', 'Promedio']}
              filas={datos.mozos.map((m) => [
                `${m.apellido}, ${m.nombre}${m.dado_de_baja ? ' (dado de baja)' : ''}`,
                m.dni,
                m.comandas,
                m.comensales,
                formatMoneda(m.total_facturado),
                formatMoneda(m.promedio_por_comanda),
              ])}
            />
            {detalle && detalle.length > 0 && (
              <div className="overflow-x-auto">
                <h3 className="text-xs font-bold text-slate-700 mb-2">Comandas del mozo</h3>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-borde text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="py-2 px-2">Cierre</th>
                      <th className="py-2 px-2">Mesas</th>
                      <th className="py-2 px-2">Comensales</th>
                      <th className="py-2 px-2 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {detalle.map((c) => (
                      <tr key={c.comanda_id}>
                        <td className="py-1.5 px-2 tabular">
                          {fechaLarga(c.fecha_hora_cierre)} {c.fecha_hora_cierre.slice(11, 16)}
                        </td>
                        <td className="py-1.5 px-2">{c.mesas.join(', ')}</td>
                        <td className="py-1.5 px-2 tabular">{c.comensales}</td>
                        <td className="py-1.5 px-2 text-right tabular">
                          {formatMoneda(c.importe)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Estado>
    </Tarjeta>
  )
}

// ------------------------------------------------------------------ HU-12d

export function OcupacionReporte({ filtro }: { filtro: FiltroPeriodo }) {
  const [sector, setSector] = useState('')
  const sectores = useOpciones(listarSectores)
  const extra = { sector_id: sector ? Number(sector) : undefined }
  const { datos, error, cargando } = useReporte(
    () => reporteOcupacion({ ...filtro, ...extra }),
    claveFiltro(filtro, extra),
  )
  return (
    <Tarjeta
      titulo="Ocupación de mesas por franja horaria"
      hu="HU-12d · Mesas ocupadas / mesas activas, por día de la semana y hora"
      periodo={datos ?? undefined}
      acciones={
        <Field label="Sector" htmlFor="filtro-sector">
          <select
            id="filtro-sector"
            className={CLASE_FILTRO}
            value={sector}
            onChange={(e) => setSector(e.target.value)}
          >
            <option value="">Todo el salón</option>
            {sectores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </Field>
      }
    >
      <Estado cargando={cargando} error={error} mensaje={datos?.mensaje}>
        {datos && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Cifra etiqueta="Mesas activas" valor={String(datos.mesas_activas)} />
              <Cifra
                etiqueta="Ocupación promedio"
                valor={`${datos.ocupacion_promedio.toLocaleString('es-AR')} %`}
                ayuda="En las franjas con actividad"
              />
              <Cifra
                etiqueta="Franja de mayor ocupación"
                valor={
                  datos.franja_maxima
                    ? `${datos.franja_maxima.porcentaje.toLocaleString('es-AR')} %`
                    : '—'
                }
                ayuda={datos.franja_maxima?.etiqueta.split(':')[0]}
              />
            </div>
            {datos.franja_maxima && <MapaCalor celdas={datos.celdas} />}
          </>
        )}
      </Estado>
    </Tarjeta>
  )
}

// ------------------------------------------------------------------ HU-12e

/** Color por estado (fijo, para que no cambie entre períodos). */
const ESTADOS: Record<EstadoReserva, { etiqueta: string; color: string }> = {
  ACTIVA: { etiqueta: 'Activas', color: CATEGORICOS[0] },
  AUSENTE: { etiqueta: 'Ausentes', color: CATEGORICOS[1] },
  CUMPLIDA: { etiqueta: 'Cumplidas', color: CATEGORICOS[2] },
  CANCELADA: { etiqueta: 'Canceladas', color: CATEGORICOS[3] },
}

export function ReservasReporte({ filtro }: { filtro: FiltroPeriodo }) {
  const { datos, error, cargando } = useReporte(() => reporteReservas(filtro), claveFiltro(filtro))
  return (
    <Tarjeta
      titulo="Reservas por estado y clientes con más ausencias"
      hu="HU-12e · Según la fecha de la reserva"
      periodo={datos ?? undefined}
    >
      <Estado cargando={cargando} error={error} mensaje={datos?.mensaje}>
        {datos && datos.total_reservas > 0 && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5 items-center">
              <Dona
                centro={
                  <>
                    <span className="text-2xl font-extrabold text-slate-900 tabular">
                      {datos.total_reservas}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                      reservas
                    </span>
                  </>
                }
                porciones={(['ACTIVA', 'AUSENTE', 'CUMPLIDA', 'CANCELADA'] as EstadoReserva[]).map(
                  (estado) => {
                    const fila = datos.por_estado.find((e) => e.estado === estado)
                    return {
                      clave: estado,
                      etiqueta: ESTADOS[estado].etiqueta,
                      color: ESTADOS[estado].color,
                      valor: fila?.cantidad ?? 0,
                      texto: String(fila?.cantidad ?? 0),
                      porcentaje: fila?.porcentaje ?? 0,
                    }
                  },
                )}
              />
              <Cifra
                etiqueta="Señas retenidas"
                valor={formatMoneda(datos.senas_retenidas)}
                ayuda="Señas no devueltas de reservas ausentes"
              />
            </div>
            <div className="overflow-x-auto">
              <h3 className="text-xs font-bold text-slate-700 mb-2">Clientes con más ausencias</h3>
              {datos.clientes_ausentes.length === 0 ? (
                <p className="text-xs text-slate-500">Ningún cliente faltó en el período.</p>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-borde text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="py-2 px-2">Cliente</th>
                      <th className="py-2 px-2">DNI</th>
                      <th className="py-2 px-2">Teléfono</th>
                      <th className="py-2 px-2 text-right">Ausencias</th>
                      <th className="py-2 px-2 text-right">Reservas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {datos.clientes_ausentes.map((c) => (
                      <tr key={c.cliente_id}>
                        <td className="py-1.5 px-2 font-semibold text-slate-800">
                          {c.apellido}, {c.nombre}
                          {c.dado_de_baja && <MarcaBaja />}
                        </td>
                        <td className="py-1.5 px-2 tabular">{c.dni}</td>
                        <td className="py-1.5 px-2 tabular">{c.telefono}</td>
                        <td className="py-1.5 px-2 text-right tabular font-bold">{c.ausencias}</td>
                        <td className="py-1.5 px-2 text-right tabular">{c.total_reservas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </Estado>
    </Tarjeta>
  )
}

// ------------------------------------------------------------------ HU-12f

export function CobrosReporte({ filtro }: { filtro: FiltroPeriodo }) {
  const { datos, error, cargando } = useReporte(() => reporteCobros(filtro), claveFiltro(filtro))
  // El color sigue al medio de pago (por id), no a su posición en el ranking.
  const ids = [...(datos?.medios ?? [])].map((m) => m.medio_pago_id).sort((a, b) => a - b)
  const color = (id: number) => CATEGORICOS[ids.indexOf(id) % CATEGORICOS.length]
  return (
    <Tarjeta
      titulo="Cobros por medio de pago"
      hu="HU-12f · Pagos de facturas pagadas (sin señas)"
      periodo={datos ?? undefined}
    >
      <Estado cargando={cargando} error={error} mensaje={datos?.mensaje}>
        {datos && datos.medios.length > 0 && (
          <>
            <Dona
              centro={
                <>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Total
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 tabular">
                    {formatMoneda(datos.total_cobrado)}
                  </span>
                </>
              }
              porciones={datos.medios.map((m) => ({
                clave: m.medio_pago_id,
                etiqueta: m.nombre + (m.dado_de_baja ? ' (dado de baja)' : ''),
                color: color(m.medio_pago_id),
                valor: Number(m.total_cobrado),
                texto: formatMoneda(m.total_cobrado),
                porcentaje: m.porcentaje,
              }))}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-borde text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="py-2 px-2">Medio de pago</th>
                    <th className="py-2 px-2">Acreditación</th>
                    <th className="py-2 px-2 text-right">Pagos</th>
                    <th className="py-2 px-2 text-right">Abonado</th>
                    <th className="py-2 px-2 text-right">Recargo</th>
                    <th className="py-2 px-2 text-right">Total cobrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {datos.medios.map((m) => (
                    <tr key={m.medio_pago_id}>
                      <td className="py-1.5 px-2 font-semibold text-slate-800">
                        {m.nombre}
                        {m.dado_de_baja && <MarcaBaja />}
                      </td>
                      <td className="py-1.5 px-2">{m.tipo_acreditacion}</td>
                      <td className="py-1.5 px-2 text-right tabular">{m.cantidad_pagos}</td>
                      <td className="py-1.5 px-2 text-right tabular">
                        {formatMoneda(m.monto_abonado)}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular">{formatMoneda(m.recargo)}</td>
                      <td className="py-1.5 px-2 text-right tabular font-bold">
                        {formatMoneda(m.total_cobrado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Estado>
    </Tarjeta>
  )
}
