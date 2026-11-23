import { Rol } from '../lib/roles'

export interface NavItem {
  ruta: string
  etiqueta: string
  /** Nombre del ícono de Material Symbols (https://fonts.google.com/icons). */
  icono: string
  /** Roles que ven el ítem y pueden entrar a la ruta (y a sus subrutas). */
  roles: Rol[]
  /** HU que implementan esta sección y su responsable (se muestran en la página Pendiente). */
  hu: string
  responsable: string
}

const SALON = [Rol.ADMINISTRADOR, Rol.MOZO, Rol.CAJERO]
const CARTA = [Rol.ADMINISTRADOR, Rol.MOZO, Rol.ENCARGADO_GENERAL, Rol.COCINERO]
const RECEPCION = [Rol.ADMINISTRADOR, Rol.RECEPCIONISTA]
const CAJA = [Rol.ADMINISTRADOR, Rol.CAJERO]
const HISTORIAL = [Rol.ADMINISTRADOR, Rol.MOZO]
const GESTION = [Rol.ADMINISTRADOR, Rol.ENCARGADO_GENERAL]
const ADMIN = [Rol.ADMINISTRADOR]

/**
 * Menú lateral (mismo orden que el prototipo de Stitch).
 * Cada ítem lista los roles que pueden entrar, según el actor de sus HU.
 */
export const navItems: NavItem[] = [
  {
    ruta: '/mesas',
    etiqueta: 'Mesas',
    icono: 'table_restaurant',
    roles: SALON,
    hu: 'HU-01b, HU-05, HU-11b',
    responsable: 'Emi / Gaston',
  },
  {
    ruta: '/carta',
    etiqueta: 'Carta y Menú',
    icono: 'restaurant_menu',
    roles: CARTA,
    hu: 'HU-03a/b, HU-04a–d, HU-09a/b',
    responsable: 'Juan / Gonza',
  },
  {
    ruta: '/reservas',
    etiqueta: 'Reservas',
    icono: 'event_seat',
    roles: RECEPCION,
    hu: 'HU-11a, HU-11b',
    responsable: 'Emi',
  },
  {
    ruta: '/clientes',
    etiqueta: 'Clientes',
    icono: 'badge',
    roles: RECEPCION,
    hu: 'HU-10',
    responsable: 'Gonza',
  },
  {
    ruta: '/caja',
    etiqueta: 'Caja',
    icono: 'point_of_sale',
    roles: CAJA,
    hu: 'HU-08a, HU-08b',
    responsable: 'Cris',
  },
  {
    ruta: '/historial',
    etiqueta: 'Historial',
    icono: 'receipt_long',
    roles: HISTORIAL,
    hu: 'HU-05f',
    responsable: 'Gaston',
  },
  {
    ruta: '/reportes',
    etiqueta: 'Reportes',
    icono: 'query_stats',
    roles: GESTION,
    hu: 'HU-12a–f',
    responsable: 'Juan',
  },
  {
    ruta: '/configuracion',
    etiqueta: 'Configuración',
    icono: 'settings',
    roles: ADMIN,
    hu: 'HU-01a/b, HU-02, HU-07a/b',
    responsable: 'Emi / Seba / Cris',
  },
]

/** Devuelve el ítem del menú al que pertenece una ruta (ej. "/carta/productos" → Carta). */
export function navItemDeRuta(ruta: string): NavItem | undefined {
  return navItems.find((item) => ruta === item.ruta || ruta.startsWith(item.ruta + '/'))
}
