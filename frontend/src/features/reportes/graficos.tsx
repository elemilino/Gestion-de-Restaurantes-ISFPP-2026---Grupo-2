/**
 * Gráficos de los reportes, en SVG/HTML sin librerías.
 *
 * Reglas (guía de visualización del proyecto): un solo eje, marcas finas con
 * extremos redondeados, grilla y ejes en gris claro, textos en colores de texto
 * (nunca del color de la serie), tooltip al pasar el mouse y una tabla con los
 * datos debajo de cada gráfico.
 */
import { useState, type ReactNode } from 'react'

import { formatMoneda } from '../../lib/format'
import { COLOR_SERIE, fechaCorta } from './formato'

/** Monto abreviado para ejes: 1250000 → "$ 1,3 M", 45000 → "$ 45 mil". */
function montoCorto(valor: number): string {
  if (valor >= 1_000_000)
    return `$ ${(valor / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (valor >= 1_000) return `$ ${Math.round(valor / 1_000).toLocaleString('es-AR')} mil`
  return formatMoneda(valor)
}

/** Máximo "redondo" para el eje: 87300 → 100000, 1240 → 1500. */
function maximoRedondo(valor: number): number {
  if (valor <= 0) return 1
  const potencia = 10 ** Math.floor(Math.log10(valor))
  for (const paso of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (paso * potencia >= valor) return paso * potencia
  }
  return 10 * potencia
}

/** Tabla con los datos del gráfico, plegada (accesibilidad y lectura exacta). */
export function TablaDatos({
  columnas,
  filas,
}: {
  columnas: string[]
  filas: (string | number)[][]
}) {
  return (
    <details className="text-xs text-slate-600">
      <summary className="cursor-pointer font-bold text-slate-500 hover:text-slate-800 select-none">
        Ver los datos en una tabla
      </summary>
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-borde text-[10px] uppercase tracking-wider text-slate-500">
              {columnas.map((c) => (
                <th key={c} className="py-2 px-2 font-bold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {filas.map((fila, i) => (
              <tr key={i}>
                {fila.map((celda, j) => (
                  <td key={j} className="py-1.5 px-2 tabular">
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

// --------------------------------------------------------------- Línea (HU-12a)

const ANCHO = 640
const ALTO = 220
const MARGEN = { izq: 64, der: 16, arr: 12, aba: 28 }

/** Línea del total facturado por día, con área suave y crosshair al pasar el mouse. */
export function LineaDiaria({ puntos }: { puntos: { fecha: string; total: number }[] }) {
  const [activo, setActivo] = useState<number | null>(null)
  const maximo = maximoRedondo(Math.max(...puntos.map((p) => p.total), 0))
  const ancho = ANCHO - MARGEN.izq - MARGEN.der
  const alto = ALTO - MARGEN.arr - MARGEN.aba
  const x = (i: number) =>
    MARGEN.izq + (puntos.length === 1 ? ancho / 2 : (i * ancho) / (puntos.length - 1))
  const y = (v: number) => MARGEN.arr + alto - (v / maximo) * alto
  const linea = puntos.map((p, i) => `${x(i)},${y(p.total)}`).join(' ')
  const area = `${x(0)},${y(0)} ${linea} ${x(puntos.length - 1)},${y(0)}`
  const marcas = [0, Math.floor((puntos.length - 1) / 2), puntos.length - 1].filter(
    (v, i, todos) => todos.indexOf(v) === i,
  )

  function alMover(e: React.MouseEvent<SVGRectElement>) {
    const caja = e.currentTarget.getBoundingClientRect()
    const relativo = ((e.clientX - caja.left) / caja.width) * ancho
    const i = puntos.length === 1 ? 0 : Math.round((relativo / ancho) * (puntos.length - 1))
    setActivo(Math.min(Math.max(i, 0), puntos.length - 1))
  }

  const punto = activo === null ? null : puntos[activo]
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="w-full h-auto"
        role="img"
        aria-label="Total facturado por día"
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={MARGEN.izq}
              x2={ANCHO - MARGEN.der}
              y1={y(maximo * f)}
              y2={y(maximo * f)}
              stroke="#ebe5dc"
              strokeWidth={1}
            />
            <text
              x={MARGEN.izq - 8}
              y={y(maximo * f) + 4}
              textAnchor="end"
              className="fill-slate-500 text-[11px]"
            >
              {montoCorto(maximo * f)}
            </text>
          </g>
        ))}
        {marcas.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={ALTO - 8}
            textAnchor={
              i === 0 && puntos.length > 1
                ? 'start'
                : i === puntos.length - 1 && puntos.length > 1
                  ? 'end'
                  : 'middle'
            }
            className="fill-slate-500 text-[11px]"
          >
            {fechaCorta(puntos[i].fecha)}
          </text>
        ))}
        <polygon points={area} fill={COLOR_SERIE} fillOpacity={0.1} />
        <polyline
          points={linea}
          fill="none"
          stroke={COLOR_SERIE}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {punto && activo !== null && (
          <g>
            <line
              x1={x(activo)}
              x2={x(activo)}
              y1={MARGEN.arr}
              y2={y(0)}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={x(activo)}
              cy={y(punto.total)}
              r={5}
              fill={COLOR_SERIE}
              stroke="#fff"
              strokeWidth={2}
            />
          </g>
        )}
        <rect
          x={MARGEN.izq}
          y={MARGEN.arr}
          width={ancho}
          height={alto}
          fill="transparent"
          onMouseMove={alMover}
          onMouseLeave={() => setActivo(null)}
        />
      </svg>
      {punto && activo !== null && (
        <div
          role="tooltip"
          className="absolute top-1 pointer-events-none bg-slate-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-lg tabular -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${(x(activo) / ANCHO) * 100}%` }}
        >
          <span className="font-bold">{fechaCorta(punto.fecha)}</span> · {formatMoneda(punto.total)}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------- Barras horizontales (12b, 12c)

export interface Barra {
  clave: string | number
  etiqueta: ReactNode
  /** Texto del tooltip (al pasar el mouse por la barra). */
  detalle: string
  valor: number
  /** Valor ya formateado que se muestra al final de la barra. */
  texto: string
}

/** Ranking en barras horizontales: una barra por fila, con su valor al final. */
export function BarrasHorizontales({ barras }: { barras: Barra[] }) {
  const maximo = Math.max(...barras.map((b) => b.valor), 0) || 1
  return (
    <ul className="flex flex-col gap-2.5" aria-label="Gráfico de barras">
      {barras.map((b) => (
        <li
          key={b.clave}
          className="grid grid-cols-[minmax(7rem,14rem)_1fr_auto] items-center gap-3 text-xs"
        >
          <div className="text-slate-700 font-semibold truncate">{b.etiqueta}</div>
          <div className="h-3.5 bg-amber-50/70 rounded-r" title={b.detalle}>
            <div
              className="h-full rounded-r transition-[filter] hover:brightness-110"
              style={{
                width: `${Math.max((b.valor / maximo) * 100, 1)}%`,
                background: COLOR_SERIE,
              }}
            />
          </div>
          <div className="text-slate-900 font-bold tabular text-right">{b.texto}</div>
        </li>
      ))}
    </ul>
  )
}

// ------------------------------------------------------------ Mapa de calor (12d)

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** Ámbar de la marca (rgb de brand-600) con opacidad según el porcentaje. */
function colorCelda(porcentaje: number): string {
  if (porcentaje <= 0) return 'transparent'
  return `rgba(217, 119, 6, ${0.12 + (0.88 * Math.min(porcentaje, 100)) / 100})`
}

/** Mapa de calor: día de la semana (filas) × franja de una hora (columnas). */
export function MapaCalor({
  celdas,
}: {
  celdas: { dia_semana: number; hora: number; porcentaje: number }[]
}) {
  const valor = new Map(celdas.map((c) => [`${c.dia_semana}-${c.hora}`, c.porcentaje]))
  const conDatos = celdas.filter((c) => c.porcentaje > 0).map((c) => c.hora)
  const desde = conDatos.length ? Math.min(...conDatos, 11) : 11
  const hasta = conDatos.length ? Math.max(...conDatos, 23) : 23
  const horas = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table
          className="border-separate border-spacing-0.5 text-[10px]"
          aria-label="Mapa de calor de ocupación"
        >
          <thead>
            <tr>
              <th />
              {horas.map((h) => (
                <th key={h} className="font-semibold text-slate-500 w-8 text-center tabular">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIAS.map((dia, d) => (
              <tr key={dia}>
                <th className="pr-2 text-right font-semibold text-slate-600">{dia}</th>
                {horas.map((h) => {
                  const p = valor.get(`${d}-${h}`) ?? 0
                  return (
                    <td
                      key={h}
                      title={`${DIAS_LARGOS[d]} ${h} a ${h + 1} h: ${p.toLocaleString('es-AR')} %`}
                      className="w-8 h-7 rounded border border-borde/70 hover:ring-2 hover:ring-slate-400"
                      style={{ background: colorCelda(p) }}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <span>0 %</span>
        <span
          className="h-2.5 w-40 rounded"
          style={{
            background: 'linear-gradient(to right, rgba(217,119,6,0.12), rgba(217,119,6,1))',
          }}
        />
        <span>100 % de las mesas ocupadas</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Dona (12e, 12f)

export interface Porcion {
  clave: string | number
  etiqueta: string
  valor: number
  color: string
  /** Texto del valor en la leyenda (ej. "$ 12.000" o "4 reservas"). */
  texto: string
  porcentaje: number
}

/** Dona con leyenda: cada porción con su color, valor y porcentaje. */
export function Dona({ porciones, centro }: { porciones: Porcion[]; centro: ReactNode }) {
  const radio = 60
  const circunferencia = 2 * Math.PI * radio
  const total = porciones.reduce((s, p) => s + p.valor, 0)
  const visibles = porciones.filter((p) => p.valor > 0)
  const separacion = visibles.length > 1 ? 2 : 0
  let acumulado = 0

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-44 h-44 shrink-0">
        <svg
          viewBox="0 0 160 160"
          className="w-full h-full -rotate-90"
          role="img"
          aria-label="Gráfico de dona"
        >
          <circle cx={80} cy={80} r={radio} fill="none" stroke="#f5f1ea" strokeWidth={22} />
          {total > 0 &&
            visibles.map((p) => {
              const largo = (p.valor / total) * circunferencia
              const segmento = (
                <circle
                  key={p.clave}
                  cx={80}
                  cy={80}
                  r={radio}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={22}
                  strokeDasharray={`${Math.max(largo - separacion, 0.5)} ${circunferencia}`}
                  strokeDashoffset={-acumulado}
                  className="hover:opacity-80"
                >
                  <title>{`${p.etiqueta}: ${p.texto} (${p.porcentaje.toLocaleString('es-AR')} %)`}</title>
                </circle>
              )
              acumulado += largo
              return segmento
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {centro}
        </div>
      </div>
      <ul className="flex flex-col gap-2 text-xs w-full">
        {porciones.map((p) => (
          <li key={p.clave} className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: p.color }} />
            <span className="font-semibold text-slate-700 flex-1">{p.etiqueta}</span>
            <span className="font-bold text-slate-900 tabular">{p.texto}</span>
            <span className="w-14 text-right text-slate-500 tabular">
              {p.porcentaje.toLocaleString('es-AR')} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
