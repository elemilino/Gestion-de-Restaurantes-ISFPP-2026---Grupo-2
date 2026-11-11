import { apiDelete, apiGet, apiPost, apiPut } from '../../api/client'
import type {
  ComandaPorFacturar,
  Comprobante,
  Factura,
  MedioPago,
  MedioPagoDatos,
  TipoFactura,
} from './types'

// --- Medios de pago (HU-07a/b) ---

export const listarMediosPago = (soloActivos = false) =>
  apiGet<MedioPago[]>('/medios-pago' + (soloActivos ? '?solo_activos=true' : ''))

export const crearMedioPago = (datos: MedioPagoDatos) => apiPost<MedioPago>('/medios-pago', datos)

export const modificarMedioPago = (id: number, datos: MedioPagoDatos) =>
  apiPut<MedioPago>(`/medios-pago/${id}`, datos)

export const eliminarMedioPago = (id: number) => apiDelete(`/medios-pago/${id}`)

// --- Facturación (HU-08a/b) ---

export const comandasPorFacturar = () =>
  apiGet<ComandaPorFacturar[]>('/facturacion/comandas-por-facturar')

export const listarFacturas = () => apiGet<Factura[]>('/facturacion')

export const generarFactura = (datos: {
  comanda_id: number
  tipo_factura: TipoFactura
  cuit_dni_cliente: string | null
}) => apiPost<Factura>('/facturacion', datos)

export const cobrarFactura = (
  id: number,
  datos: { pagos: { medio_pago_id: number; monto_abonado: string }[]; monto_recibido?: string },
) => apiPost<Factura>(`/facturacion/${id}/cobrar`, datos)

export const obtenerComprobante = (id: number) =>
  apiGet<Comprobante>(`/facturacion/${id}/comprobante`)
