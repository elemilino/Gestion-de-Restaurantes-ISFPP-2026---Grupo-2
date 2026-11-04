/** Tipos del módulo salón. Deben coincidir con los schemas de salida del backend. */

/** SectorOut (HU-01a). */
export interface Sector {
  id: number
  nombre: string
  descripcion: string | null
  cantidad_mesas: number
}

/** Datos que se envían al crear o modificar un sector (SectorCreate / SectorUpdate). */
export interface SectorDatos {
  nombre: string
  descripcion: string | null
}

/** OCUPADA: comanda abierta. RESERVADA: reserva activa para hoy. */
export type Disponibilidad = 'LIBRE' | 'OCUPADA' | 'RESERVADA'

/** MesaOut (HU-01b). */
export interface Mesa {
  id: number
  numero: number
  capacidad: number
  sector_id: number
  sector_nombre: string
  disponibilidad: Disponibilidad
}

/** Datos que se envían al crear o modificar una mesa (MesaCreate / MesaUpdate). */
export interface MesaDatos {
  numero: number
  capacidad: number
  sector_id: number
}
