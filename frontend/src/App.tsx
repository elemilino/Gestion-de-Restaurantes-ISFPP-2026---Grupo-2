import { Navigate, Route, Routes } from 'react-router'

import { LoginPage } from './auth/LoginPage'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { RequiereRol } from './auth/RequiereRol'
import { CajaPage } from './features/caja/CajaPage'
import { MediosPagoPage } from './features/caja/MediosPagoPage'
import { CartaLayout } from './features/carta/CartaLayout'
import { MenusPage } from './features/carta/MenusPage'
import { ProductosPage } from './features/carta/ProductosPage'
import { SeccionesPage } from './features/carta/SeccionesPage'
import { VerCartaPage } from './features/carta/VerCartaPage'
import { ClientesPage } from './features/clientes/ClientesPage'
import { HistorialPage } from './features/comandas/HistorialPage'
import { MozosPage } from './features/mozos/MozosPage'
import { PromocionesPage } from './features/promociones/PromocionesPage'
import { ReportesPage } from './features/reportes/ReportesPage'
import { ReservasPage } from './features/reservas/ReservasPage'
import { GestionMesasPage } from './features/salon/GestionMesasPage'
import { MesasPage } from './features/salon/MesasPage'
import { SectoresPage } from './features/salon/SectoresPage'
import { AppLayout } from './layout/AppLayout'
import { ConfiguracionLayout } from './layout/ConfiguracionLayout'
import { NotFoundPage } from './pages/NotFoundPage'
import { Rol } from './lib/roles'

/**
 * Rutas de la aplicación. Cada HU agrega acá su página y sus subrutas (ej.
 * /carta/productos). Los roles que pueden entrar a cada sección se configuran en
 * layout/navItems.ts.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/mesas" replace />} />
          <Route path="/mesas" element={<MesasPage />} />
          <Route path="/carta" element={<CartaLayout />}>
            <Route index element={<VerCartaPage />} />
            <Route
              path="secciones"
              element={
                <RequiereRol roles={[Rol.ADMINISTRADOR]} redirigirA="/carta">
                  <SeccionesPage />
                </RequiereRol>
              }
            />
            <Route
              path="productos"
              element={
                <RequiereRol roles={[Rol.ADMINISTRADOR]} redirigirA="/carta">
                  <ProductosPage />
                </RequiereRol>
              }
            />
            <Route
              path="promociones"
              element={
                <RequiereRol roles={[Rol.ADMINISTRADOR, Rol.ENCARGADO_GENERAL]} redirigirA="/carta">
                  <PromocionesPage />
                </RequiereRol>
              }
            />
            <Route
              path="menus"
              element={
                <RequiereRol
                  roles={[Rol.ADMINISTRADOR, Rol.ENCARGADO_GENERAL, Rol.COCINERO]}
                  redirigirA="/carta"
                >
                  <MenusPage />
                </RequiereRol>
              }
            />
          </Route>
          <Route path="/reservas" element={<ReservasPage />} />
          <Route
            path="/clientes"
            element={
              <RequiereRol roles={[Rol.ADMINISTRADOR, Rol.RECEPCIONISTA]} redirigirA="/mesas">
                <ClientesPage />
              </RequiereRol>
            }
          />
          <Route path="/caja" element={<CajaPage />} />
          <Route path="/historial" element={<HistorialPage />} />
          <Route path="/reportes" element={<ReportesPage />} />
          <Route path="/configuracion" element={<ConfiguracionLayout />}>
            <Route index element={<Navigate to="mozos" replace />} />
            <Route path="mozos" element={<MozosPage />} />
            <Route path="sectores" element={<SectoresPage />} />
            <Route path="mesas" element={<GestionMesasPage />} />
            <Route path="medios-pago" element={<MediosPagoPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
