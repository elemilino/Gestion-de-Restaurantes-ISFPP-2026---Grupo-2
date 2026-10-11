import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-extrabold text-slate-900">Página no encontrada</h1>
      <Link to="/mesas" className="text-sm font-semibold text-brand-700 hover:underline">
        Volver a Mesas
      </Link>
    </div>
  )
}
