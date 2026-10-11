import { Outlet } from 'react-router'

import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { Topbar } from './Topbar'

/** Estructura común de todas las pantallas con sesión (prototipo de Stitch). */
export function AppLayout() {
  return (
    <>
      <Sidebar />
      <div className="pl-64 flex flex-col min-h-screen">
        <Topbar />
        <main className="p-6 max-w-[1600px] w-full mx-auto flex-1 flex flex-col gap-5">
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </>
  )
}
