/** Contrato de `ClienteOut` del backend (HU-10). */
export interface Cliente {
  id: number
  nombre: string
  apellido: string
  telefono: string
  dni: string
  email: string | null
  eliminado: boolean
}

/** Datos para registrar un cliente (CA1-CA3). El email es opcional. */
export interface ClienteCreate {
  nombre: string
  apellido: string
  telefono: string
  dni: string
  email?: string | null
}

/** Actualización parcial (CA4): solo se aplican los campos enviados. */
export type ClienteUpdate = Partial<ClienteCreate>
