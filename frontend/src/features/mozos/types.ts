export interface Mozo {
  id: number
  nombre: string
  apellido: string
  dni: string
  telefono: string | null
  sector_id: number | null
  sector_nombre: string | null
  usuario_id: number | null
  username: string | null
  activo: boolean
}

export interface MozoCreate {
  nombre: string
  apellido: string
  dni: string
  telefono?: string | null
  sector_id?: number | null
  username: string
  password: string
}

export interface MozoUpdate {
  nombre?: string
  apellido?: string
  telefono?: string | null
  sector_id?: number | null
}

export interface SectorSimple {
  id: number
  nombre: string
}

export interface ReasignarComandasResponse {
  comandas_reasignadas: number
  mensaje: string
}

export interface ValidarMesaResponse {
  permitido: boolean
  mensaje: string
  mesa_id: number
  sector_id?: number | null
  sector_nombre?: string | null
}
