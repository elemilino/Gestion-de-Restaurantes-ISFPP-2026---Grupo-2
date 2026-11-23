import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { StatusBadge } from '../../components/StatusBadge'
import type { Tono } from '../../components/tonos'
import { formatMoneda } from '../../lib/format'
import type { EstadoMesa, MesaVista } from './mesaVista'

interface Apariencia {
  tono: Tono
  etiqueta: string
  borde: string
  fondo: string
  numero: string
}

const APARIENCIA: Record<EstadoMesa, Apariencia> = {
  libre: {
    tono: 'libre',
    etiqueta: 'Libre',
    borde: 'border border-status-free-border',
    fondo: 'from-status-free-bg/40',
    numero: 'bg-emerald-100 text-emerald-800',
  },
  ocupada: {
    tono: 'ocupado',
    etiqueta: 'Ocupada',
    borde: 'border border-status-busy-border',
    fondo: 'from-status-busy-bg/40',
    numero: 'bg-rose-100 text-rose-800',
  },
  esperando_cobro: {
    tono: 'pendiente',
    etiqueta: 'Esperando cobro',
    borde: 'border-2 border-brand-400 shadow-md shadow-brand-500/10',
    fondo: 'from-brand-50/70',
    numero: 'bg-brand-500 text-white shadow-sm',
  },
  reservada: {
    tono: 'reservado',
    etiqueta: 'Reservada',
    borde: 'border border-status-reserved-border',
    fondo: 'from-status-reserved-bg/40',
    numero: 'bg-blue-100 text-blue-800',
  },
}

function duracion(minutos: number): string {
  return minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)}h ${minutos % 60}m`
}

/** Tarjeta de mesa del salón (prototipo de Stitch). La acción depende del estado y rol. */
export function MesaCard({
  mesa,
  onAccion,
  puedeFacturar = false,
}: {
  mesa: MesaVista
  onAccion?: () => void
  puedeFacturar?: boolean
}) {
  const a = APARIENCIA[mesa.estado]
  const conComanda = mesa.estado === 'ocupada' || mesa.estado === 'esperando_cobro'

  return (
    <article
      className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative ${a.borde}`}
    >
      {mesa.estado === 'esperando_cobro' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-brand-500" />
      )}
      <div className={`p-4 bg-gradient-to-b to-white ${a.fondo}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-11 h-11 rounded-xl font-extrabold text-xl flex items-center justify-center tracking-tight shrink-0 ${a.numero}`}
            >
              {String(mesa.numero).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-1 text-slate-800 font-bold text-xs truncate">
                <Icon name="groups" className="text-sm text-slate-500" />
                <span>
                  {conComanda
                    ? `${mesa.comensales}/${mesa.capacidad} comensales`
                    : mesa.estado === 'reservada'
                      ? `${mesa.comensales} comensales`
                      : `Capacidad ${mesa.capacidad}`}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium truncate">
                {mesa.mozo ? `Mozo: ${mesa.mozo}` : (mesa.reserva?.titular ?? mesa.ubicacion)}
              </span>
            </div>
          </div>
          <StatusBadge tono={a.tono}>{a.etiqueta}</StatusBadge>
        </div>

        {mesa.estado === 'ocupada' && (
          <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-1 text-slate-600 font-semibold shrink-0">
              <Icon name="schedule" className="text-sm text-brand-600" />
              <span>{duracion(mesa.minutos ?? 0)}</span>
            </div>
            <span className="text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200/70 truncate">
              {mesa.entregados} entregados · {mesa.pendientes}{' '}
              {mesa.pendientes === 1 ? 'pendiente' : 'pendientes'}
            </span>
          </div>
        )}
        {mesa.estado === 'esperando_cobro' && (
          <div className="mt-3 p-2.5 rounded-xl bg-brand-50/80 border border-brand-200/80 flex items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-1 font-bold shrink-0">
              <Icon name="receipt" className="text-base text-brand-700" />
              <span>Comanda cerrada</span>
            </div>
            <span className="text-[11px] text-slate-600 font-semibold truncate">
              {mesa.entregados} entregados
            </span>
          </div>
        )}
        {mesa.estado === 'libre' && (
          <div className="mt-3 p-2.5 rounded-xl bg-status-free-bg/60 border border-emerald-100 flex items-center gap-2 text-xs text-emerald-900 font-medium">
            <Icon name="check_circle" className="text-base text-emerald-600 shrink-0" />
            <span className="truncate">{mesa.nota}</span>
          </div>
        )}
        {mesa.estado === 'reservada' && mesa.reserva && (
          <div className="mt-3 p-2.5 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-2 text-xs text-blue-900">
            <Icon name="calendar_clock" className="text-base text-blue-600 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[11px] leading-tight">{mesa.reserva.hora}</span>
              <span className="text-[10px] text-blue-700 truncate">{mesa.reserva.peticion}</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 pt-2 border-t border-slate-100 bg-white">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          {conComanda ? (
            <>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {mesa.estado === 'esperando_cobro' ? 'Total a cobrar' : 'Acumulado'}
              </span>
              <span className="text-lg font-extrabold text-slate-900 tracking-tight tabular">
                {formatMoneda(mesa.total ?? 0)}
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Estado
              </span>
              <span
                className={`text-xs font-semibold ${mesa.estado === 'reservada' ? 'text-blue-700' : 'text-slate-600'}`}
              >
                {mesa.estado === 'reservada' ? 'Por llegar' : 'Disponible'}
              </span>
            </>
          )}
        </div>
        {mesa.estado === 'libre' && (
          <Button icono="add_circle" className="w-full" onClick={onAccion}>
            Abrir comanda
          </Button>
        )}
        {mesa.estado === 'ocupada' && (
          <Button variante="secundario" icono="receipt_long" className="w-full" onClick={onAccion}>
            Ver comanda
          </Button>
        )}
        {mesa.estado === 'esperando_cobro' &&
          (puedeFacturar ? (
            <Button icono="point_of_sale" className="w-full" onClick={onAccion}>
              Facturar
            </Button>
          ) : (
            <Button
              variante="secundario"
              icono="receipt_long"
              className="w-full"
              onClick={onAccion}
            >
              Ver comanda
            </Button>
          ))}
        {mesa.estado === 'reservada' && (
          <Button variante="reserva" icono="how_to_reg" className="w-full" onClick={onAccion}>
            Registrar llegada
          </Button>
        )}
      </div>
    </article>
  )
}
