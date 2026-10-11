import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { ApiError } from '../api/client'
import { Button } from '../components/Button'
import { Icon } from '../components/Icon'
import { useAuth } from './useAuth'

const INPUT =
  'w-full h-12 px-4 bg-white border border-borde rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600'

export function LoginPage() {
  const { usuario, login } = useAuth()
  const navigate = useNavigate()
  const destino = (useLocation().state as { desde?: string } | null)?.desde ?? '/mesas'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario) return <Navigate to={destino} replace />

  async function ingresar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await login(username, password)
      navigate(destino, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={ingresar}
        className="w-full max-w-sm bg-white rounded-3xl border border-borde p-8 flex flex-col gap-5 shadow-[0_12px_28px_-4px_rgba(40,25,10,0.14)]"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Icon name="dinner_dining" className="text-3xl" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-2xl text-slate-900 tracking-tight leading-none">
              GastroPOS
            </span>
            <span className="text-[10px] text-brand-700 uppercase font-bold tracking-wider mt-1">
              Sala &amp; Servicio
            </span>
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
          Usuario
          <input
            className={INPUT}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
          Contraseña
          <input
            className={INPUT}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <p
            role="alert"
            className="text-xs font-semibold text-status-busy-text bg-status-busy-bg border border-status-busy-border rounded-lg p-3"
          >
            {error}
          </p>
        )}

        <Button type="submit" disabled={enviando} className="h-12 text-sm">
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Button>

        <p className="text-[11px] text-slate-500 text-center">
          Desarrollo: <strong>admin</strong> o <strong>mozo</strong>, contraseña{' '}
          <strong>1234</strong>
        </p>
      </form>
    </div>
  )
}
