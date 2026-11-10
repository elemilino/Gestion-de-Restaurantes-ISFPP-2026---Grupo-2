import { apiGet } from '../../api/client'
import type {
  FiltroPeriodo,
  Opcion,
  ReporteCobros,
  ReporteMozos,
  ReporteOcupacion,
  ReporteProductos,
  ReporteReservas,
  ReporteVentas,
} from './types'

/** Arma el query string sin los parámetros vacíos. */
function query(filtros: object): string {
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(clave, String(valor))
  }
  const texto = params.toString()
  return texto ? '?' + texto : ''
}

export const reporteVentas = (f: FiltroPeriodo) =>
  apiGet<ReporteVentas>('/reportes/ventas' + query(f))

export const reporteProductos = (f: FiltroPeriodo & { tipo?: string; seccion_id?: number }) =>
  apiGet<ReporteProductos>('/reportes/productos-mas-vendidos' + query(f))

export const reporteMozos = (f: FiltroPeriodo & { dni?: string }) =>
  apiGet<ReporteMozos>('/reportes/mozos' + query(f))

export const reporteOcupacion = (f: FiltroPeriodo & { sector_id?: number }) =>
  apiGet<ReporteOcupacion>('/reportes/ocupacion' + query(f))

export const reporteReservas = (f: FiltroPeriodo) =>
  apiGet<ReporteReservas>('/reportes/reservas' + query(f))

export const reporteCobros = (f: FiltroPeriodo) =>
  apiGet<ReporteCobros>('/reportes/cobros' + query(f))

export const listarSecciones = () => apiGet<Opcion[]>('/carta/secciones')

export const listarSectores = () => apiGet<Opcion[]>('/salon/sectores')
