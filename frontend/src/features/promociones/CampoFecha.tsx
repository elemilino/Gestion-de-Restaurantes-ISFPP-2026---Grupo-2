import { useEffect, useRef, useState, type ChangeEvent } from 'react'

import { CLASE_INPUT } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { formatearFecha, formatearFechaEntrada, hoyISO, textoAFecha } from './validaciones'

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

/** Primer día del mes de una fecha ISO; el mes actual si está vacía o es inválida. */
function mesDe(iso: string): Date {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!partes) {
    const hoy = new Date()
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  }
  return new Date(Number(partes[1]), Number(partes[2]) - 1, 1)
}

/** Fecha local a ISO (YYYY-MM-DD). */
function aISO(anio: number, mes: number, dia: number): string {
  const mm = String(mes + 1).padStart(2, '0')
  const dd = String(dia).padStart(2, '0')
  return `${anio}-${mm}-${dd}`
}

interface CampoFechaProps {
  id: string
  /** Nombre visible del campo, para las etiquetas del calendario. */
  etiqueta: string
  /** Lado del campo desde el que se despliega el calendario. */
  alineacion?: 'izquierda' | 'derecha'
  /** Fecha en formato ISO (YYYY-MM-DD), como la maneja el formulario. */
  value: string
  onChange: (iso: string) => void
  ariaInvalid?: true
}

/**
 * Input de fecha con máscara dd/mm/aaaa y calendario desplegable.
 * Se puede escribir la fecha o elegirla del calendario; siempre guarda ISO.
 */
export function CampoFecha({
  id,
  etiqueta,
  alineacion = 'izquierda',
  value,
  onChange,
  ariaInvalid,
}: CampoFechaProps) {
  const [texto, setTexto] = useState(() => formatearFecha(value))
  const [abierto, setAbierto] = useState(false)
  const [mesVisible, setMesVisible] = useState(() => mesDe(value))
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return

    function alClicFuera(e: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }

    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setAbierto(false)
      }
    }

    document.addEventListener('mousedown', alClicFuera)
    document.addEventListener('keydown', alEscape, true)
    return () => {
      document.removeEventListener('mousedown', alClicFuera)
      document.removeEventListener('keydown', alEscape, true)
    }
  }, [abierto])

  function cambiar(e: ChangeEvent<HTMLInputElement>) {
    const formateado = formatearFechaEntrada(e.target.value)
    setTexto(formateado)
    onChange(textoAFecha(formateado))
  }

  function alternarCalendario() {
    if (!abierto) setMesVisible(mesDe(value || textoAFecha(texto)))
    setAbierto((previo) => !previo)
  }

  function elegir(iso: string) {
    setTexto(formatearFecha(iso))
    onChange(iso)
    setAbierto(false)
  }

  const anio = mesVisible.getFullYear()
  const indiceMes = mesVisible.getMonth()
  const primerDia = new Date(anio, indiceMes, 1)
  const desplazamiento = (primerDia.getDay() + 6) % 7
  const diasDelMes = new Date(anio, indiceMes + 1, 0).getDate()
  const seleccionado = textoAFecha(texto)
  const hoy = hoyISO()
  const celdas: (number | null)[] = [
    ...Array<null>(desplazamiento).fill(null),
    ...Array.from({ length: diasDelMes }, (_, i) => i + 1),
  ]

  return (
    <div ref={contenedor} className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={texto}
        onChange={cambiar}
        onClick={() => {
          if (!abierto) alternarCalendario()
        }}
        placeholder="dd/mm/aaaa"
        maxLength={10}
        aria-invalid={ariaInvalid}
        className={`${CLASE_INPUT} pr-11`}
      />
      <button
        type="button"
        onClick={alternarCalendario}
        aria-label={`Abrir calendario de ${etiqueta}`}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-brand-600 hover:bg-brand-50 transition-colors"
      >
        <Icon name="calendar_month" className="text-lg" />
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label={`Calendario de ${etiqueta}`}
          className={`absolute z-30 mt-1 w-64 rounded-xl border border-borde bg-white p-3 shadow-xl ${
            alineacion === 'derecha' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setMesVisible(new Date(anio, indiceMes - 1, 1))}
              aria-label="Mes anterior"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-brand-700 hover:bg-brand-50 transition-colors"
            >
              <Icon name="chevron_left" className="text-lg" />
            </button>
            <span className="text-xs font-bold text-slate-900 capitalize">
              {MESES[indiceMes]} {anio}
            </span>
            <button
              type="button"
              onClick={() => setMesVisible(new Date(anio, indiceMes + 1, 1))}
              aria-label="Mes siguiente"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-brand-700 hover:bg-brand-50 transition-colors"
            >
              <Icon name="chevron_right" className="text-lg" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DIAS_SEMANA.map((dia) => (
              <span
                key={dia}
                className="h-6 flex items-center justify-center text-[10px] font-bold uppercase text-slate-400"
              >
                {dia}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {celdas.map((dia, indice) => {
              if (dia === null) return <span key={`vacio-${indice}`} />

              const iso = aISO(anio, indiceMes, dia)
              const esSeleccionado = iso === seleccionado
              const esHoy = iso === hoy

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => elegir(iso)}
                  aria-label={`Elegir ${formatearFecha(iso)}`}
                  aria-pressed={esSeleccionado}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
                    esSeleccionado
                      ? 'bg-brand-600 text-white shadow-sm'
                      : esHoy
                        ? 'border border-brand-300 text-brand-700 hover:bg-brand-50'
                        : 'text-slate-700 hover:bg-brand-50'
                  }`}
                >
                  {dia}
                </button>
              )
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-borde flex justify-end">
            <button
              type="button"
              onClick={() => elegir(hoy)}
              className="text-[11px] font-bold text-brand-700 hover:underline"
            >
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
