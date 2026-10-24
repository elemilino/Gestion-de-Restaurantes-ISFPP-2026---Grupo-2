import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import { RequiereRol } from '../auth/RequiereRol'
import { guardarSesion } from '../auth/sesion'
import { Rol } from '../lib/roles'

function renderComo(rol: Rol) {
  guardarSesion({ token: 't', usuario: { id: 1, username: 'u', nombre: 'U', rol } })
  render(
    <MemoryRouter initialEntries={['/carta/secciones']}>
      <AuthProvider>
        <Routes>
          <Route path="/carta" element={<p>ver carta</p>} />
          <Route
            path="/carta/secciones"
            element={
              <RequiereRol roles={[Rol.ADMINISTRADOR]} redirigirA="/carta">
                <p>secciones</p>
              </RequiereRol>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('RequiereRol', () => {
  it('muestra el contenido si el usuario tiene el rol', () => {
    renderComo(Rol.ADMINISTRADOR)
    expect(screen.getByText('secciones')).toBeInTheDocument()
  })

  it('redirige si el usuario no tiene el rol', () => {
    renderComo(Rol.MOZO)
    expect(screen.getByText('ver carta')).toBeInTheDocument()
    expect(screen.queryByText('secciones')).not.toBeInTheDocument()
  })
})
