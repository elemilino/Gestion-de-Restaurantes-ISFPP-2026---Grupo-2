import { Navigate, Route, Routes } from 'react-router'

import { LoginPage } from './auth/LoginPage'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { MozosPage } from './features/mozos/MozosPage'
import { MesasPage } from './features/salon/MesasPage'
import { AppLayout } from './layout/AppLayout'
import { NotFoundPage } from './pages/NotFoundPage'
import { PendientePage } from './pages/PendientePage'

/**
 * Rutas de la aplicación. Cada HU reemplaza el <PendientePage /> de su ruta por su
 * página, y agrega acá sus subrutas (ej. /carta/productos). Los roles que pueden
 * entrar a cada sección se configuran en layout/navItems.ts.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/mesas" replace />} />
          <Route path="/mesas" element={<MesasPage />} />
          <Route path="/carta" element={<PendientePage />} />
          <Route path="/reservas" element={<PendientePage />} />
          <Route path="/clientes" element={<PendientePage />} />
          <Route path="/caja" element={<PendientePage />} />
          <Route path="/historial" element={<PendientePage />} />
          <Route path="/reportes" element={<PendientePage />} />
          <Route path="/configuracion" element={<MozosPage />} />
          <Route path="/configuracion/mozos" element={<MozosPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
