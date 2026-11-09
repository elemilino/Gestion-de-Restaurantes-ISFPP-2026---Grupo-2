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

const TODOS = [Rol.ADMINISTRADOR, Rol.MOZO]
const ADMIN = [Rol.ADMINISTRADOR]
const CLIENTES = [Rol.ADMINISTRADOR, Rol.RECEPCIONISTA]

/**
 * Menú lateral (mismo orden que el prototipo de Stitch).
 * Los roles son provisorios: cuando una HU agregue su rol (Cajero, Recepcionista...),
 * lo suma en el ítem que corresponda.
 */
export const navItems: NavItem[] = [
  {
    ruta: '/mesas',
    etiqueta: 'Mesas',
    icono: 'table_restaurant',
    roles: TODOS,
    hu: 'HU-01b, HU-05, HU-11b',
    responsable: 'Emi / Gaston',
  },
  {
    ruta: '/carta',
    etiqueta: 'Carta y Menú',
    icono: 'restaurant_menu',
    roles: TODOS,
    hu: 'HU-03a/b, HU-04a–d, HU-09a/b',
    responsable: 'Juan / Gonza',
  },
  {
    ruta: '/reservas',
    etiqueta: 'Reservas',
    icono: 'event_seat',
    roles: ADMIN,
    hu: 'HU-11a, HU-11b',
    responsable: 'Emi',
  },
  {
    ruta: '/clientes',
    etiqueta: 'Clientes',
    icono: 'badge',
    roles: CLIENTES,
    hu: 'HU-10',
    responsable: 'Gonza',
  },
  {
    ruta: '/caja',
    etiqueta: 'Caja',
    icono: 'point_of_sale',
    roles: ADMIN,
    hu: 'HU-08a, HU-08b',
    responsable: 'Cris',
  },
  {
    ruta: '/historial',
    etiqueta: 'Historial',
    icono: 'receipt_long',
    roles: TODOS,
    hu: 'HU-05f',
    responsable: 'Gaston',
  },
  {
    ruta: '/reportes',
    etiqueta: 'Reportes',
    icono: 'query_stats',
    roles: ADMIN,
    hu: 'Reportes (a definir)',
    responsable: 'A definir',
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
