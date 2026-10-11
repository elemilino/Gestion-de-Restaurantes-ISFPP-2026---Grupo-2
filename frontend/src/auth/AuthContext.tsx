import { useState, type ReactNode } from 'react'

import { apiPost } from '../api/client'
import { AuthContext } from './contexto'
import { borrarSesion, guardarSesion, leerSesion, type Usuario } from './sesion'

interface LoginResponse {
  access_token: string
  usuario: Usuario
}

/** Mantiene la sesión (token + usuario) y la guarda en localStorage. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => leerSesion()?.usuario ?? null)

  async function login(username: string, password: string) {
    const r = await apiPost<LoginResponse>('/auth/login', { username, password })
    guardarSesion({ token: r.access_token, usuario: r.usuario })
    setUsuario(r.usuario)
  }

  function logout() {
    borrarSesion()
    setUsuario(null)
  }

  return <AuthContext.Provider value={{ usuario, login, logout }}>{children}</AuthContext.Provider>
}
