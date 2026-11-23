import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import { ProtectedRoute } from '../auth/ProtectedRoute'
import { guardarSesion } from '../auth/sesion'
import { Rol } from '../lib/roles'

function renderEn(ruta: string) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<p>pantalla login</p>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/mesas" element={<p>pantalla mesas</p>} />
            <Route path="/configuracion" element={<p>pantalla configuracion</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function iniciarSesionComo(rol: Rol) {
  guardarSesion({ token: 't', usuario: { id: 1, username: 'u', nombre: 'U', rol } })
}

describe('ProtectedRoute', () => {
  it('sin sesión redirige al login', () => {
    renderEn('/mesas')
    expect(screen.getByText('pantalla login')).toBeInTheDocument()
  })

  it('con sesión muestra la ruta permitida', () => {
    iniciarSesionComo(Rol.MOZO)
    renderEn('/mesas')
    expect(screen.getByText('pantalla mesas')).toBeInTheDocument()
  })

  it('el recepcionista puede entrar al tablero de mesas', () => {
    iniciarSesionComo(Rol.RECEPCIONISTA)
    renderEn('/mesas')
    expect(screen.getByText('pantalla mesas')).toBeInTheDocument()
  })

  it('redirige si el rol no tiene acceso a la sección', () => {
    iniciarSesionComo(Rol.MOZO)
    renderEn('/configuracion')
    expect(screen.getByText('pantalla mesas')).toBeInTheDocument()
  })

  it('el administrador entra a configuración', () => {
    iniciarSesionComo(Rol.ADMINISTRADOR)
    renderEn('/configuracion')
    expect(screen.getByText('pantalla configuracion')).toBeInTheDocument()
  })
})
