import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'

import { AuthProvider } from '../../../auth/AuthContext'
import { guardarSesion } from '../../../auth/sesion'
import type { Rol } from '../../../lib/roles'

/** Renderiza con una sesión iniciada con el rol indicado. */
export function renderComo(rol: Rol, ui: ReactNode) {
  guardarSesion({ token: 't', usuario: { id: 1, username: 'u', nombre: 'U', rol } })
  return render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
  )
}
