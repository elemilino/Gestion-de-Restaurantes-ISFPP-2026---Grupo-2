import { createContext } from 'react'

import type { Usuario } from './sesion'

export interface AuthContextValue {
  usuario: Usuario | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
