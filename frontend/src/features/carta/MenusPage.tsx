import { useCallback, useEffect, useState } from 'react'

import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { StatusBadge } from '../../components/StatusBadge'
import { mensajeDe } from '../../lib/errores'
import { formatMoneda } from '../../lib/format'
import {
  crearMenu,
  eliminarMenu,
  listarMenus,
  listarSecciones,
  modificarMenu,
  verCarta,
} from './api'
import { TIPOS_CARTA } from './tiposProducto'
import type { Menu, ProductoCarta, Seccion, TipoMenu } from './types'

type EstadoForm = null | 'nuevo' | Menu

function hoyIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fechaCorta(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

/**
 * HU-09b: menús especiales. El ejecutivo es plato + postre (no incluye bebida);
 * el del día, un plato. Cada uno tiene precio promocional y vigencia.
 */
export function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([])
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [productos, setProductos] = useState<ProductoCarta[]>([])
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [form, setForm] = useState<EstadoForm>(null)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  const [tipo, setTipo] = useState<TipoMenu>('MENU_EJECUTIVO')
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [seccion, setSeccion] = useState('')
  const [plato, setPlato] = useState('')
  const [postre, setPostre] = useState('')
  const [inicio, setInicio] = useState(hoyIso())
  const [fin, setFin] = useState(hoyIso())

  const recargar = useCallback(async () => {
    try {
      setMenus(await listarMenus())
      setError(null)
    } catch (e) {
      setError(mensajeDe(e))
    }
  }, [])

  useEffect(() => {
    let vigente = true
    listarMenus()
      .then((m) => vigente && setMenus(m))
      .catch((e) => vigente && setError(mensajeDe(e)))
    listarSecciones()
      .then((s) => vigente && setSecciones(s))
      .catch(() => vigente && setSecciones([]))
    verCarta()
      .then((c) => vigente && setProductos(c.secciones.flatMap((s) => s.productos)))
      .catch(() => vigente && setProductos([]))
    return () => {
      vigente = false
    }
  }, [])

  const cerrar = useCallback(() => setForm(null), [])
  const platos = productos.filter((p) => p.tipo === 'PLATO')
  const postres = productos.filter((p) => p.tipo === 'POSTRE')

  function abrir(menu: Menu | 'nuevo') {
    setErrorForm(null)
    if (menu === 'nuevo') {
      setTipo('MENU_EJECUTIVO')
      setNombre('')
      setPrecio('')
      setSeccion(secciones[0] ? String(secciones[0].id) : '')
      setPlato('')
      setPostre('')
      setInicio(hoyIso())
      setFin(hoyIso())
    } else {
      setTipo(menu.tipo)
      setNombre(menu.nombre)
      setPrecio(String(Number(menu.precio)))
      setSeccion(String(menu.seccion_id))
      setPlato(String(menu.plato.id))
      setPostre(menu.postre ? String(menu.postre.id) : '')
      setInicio(menu.fecha_inicio)
      setFin(menu.fecha_fin)
    }
    setForm(menu)
  }

  async function guardar() {
    setErrorForm(null)
    const datos = {
      nombre: nombre.trim(),
      descripcion: null,
      precio,
      seccion_id: Number(seccion),
      plato_id: Number(plato),
      postre_id: tipo === 'MENU_EJECUTIVO' ? Number(postre) : undefined,
      fecha_inicio: inicio,
      fecha_fin: fin,
    }
    try {
      if (form === 'nuevo') {
        await crearMenu(tipo, datos)
        setAviso(`Menú ${datos.nombre} creado`)
      } else if (form) {
        await modificarMenu(form.tipo, form.id, datos)
        setAviso(`Menú ${datos.nombre} modificado`)
      }
      setForm(null)
      await recargar()
    } catch (e) {
      setErrorForm(mensajeDe(e))
    }
  }

  async function eliminar(menu: Menu) {
    setError(null)
    try {
      await eliminarMenu(menu.id)
      setAviso(`Menú ${menu.nombre} eliminado`)
      await recargar()
    } catch (e) {
      setError(mensajeDe(e))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Menú ejecutivo (plato + postre, sin bebida) y menú del día con precio promocional y
          vigencia (HU-09b). Se ofrecen en la carta solo mientras están vigentes.
        </p>
        <Button icono="add" onClick={() => abrir('nuevo')}>
          Nuevo menú
        </Button>
      </div>
      {error && <Alert tono="error">{error}</Alert>}
      {aviso && <Alert tono="exito">{aviso}</Alert>}

      <div className="bg-white rounded-2xl border border-borde shadow-xs overflow-x-auto">
        {menus.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">Todavía no hay menús especiales</p>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-amber-50/50 border-b border-borde text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Menú</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Incluye</th>
                <th className="py-3 px-4">Vigencia</th>
                <th className="py-3 px-4 text-right">Precio</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {menus.map((m) => (
                <tr key={m.id}>
                  <td className="py-2.5 px-4 font-semibold text-slate-900">{m.nombre}</td>
                  <td className="py-2.5 px-4">{TIPOS_CARTA[m.tipo].etiqueta}</td>
                  <td className="py-2.5 px-4">
                    {m.plato.nombre}
                    {m.postre && ` + ${m.postre.nombre}`}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="tabular">
                        {fechaCorta(m.fecha_inicio)} al {fechaCorta(m.fecha_fin)}
                      </span>
                      <StatusBadge tono={m.vigente ? 'libre' : 'inactivo'}>
                        {m.vigente ? 'Vigente' : 'No vigente'}
                      </StatusBadge>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right tabular font-semibold">
                    {formatMoneda(m.precio)}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex justify-end gap-2">
                      <Button variante="secundario" onClick={() => abrir(m)}>
                        Editar
                      </Button>
                      <Button variante="secundario" onClick={() => eliminar(m)}>
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        abierto={form !== null}
        onCerrar={cerrar}
        titulo={form === 'nuevo' ? 'Nuevo menú especial' : 'Editar menú especial'}
        acciones={
          <>
            <Button variante="secundario" onClick={cerrar}>
              Cancelar
            </Button>
            <Button
              onClick={guardar}
              disabled={
                !nombre.trim() || !precio || !plato || (tipo === 'MENU_EJECUTIVO' && !postre)
              }
            >
              Guardar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {errorForm && <Alert tono="error">{errorForm}</Alert>}
          {form === 'nuevo' && (
            <div className="flex gap-1.5" role="group" aria-label="Tipo de menú">
              {(['MENU_EJECUTIVO', 'MENU_DEL_DIA'] as TipoMenu[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tipo === t}
                  onClick={() => setTipo(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                    tipo === t
                      ? 'bg-slate-900 text-white'
                      : 'bg-canvas text-slate-600 border border-borde'
                  }`}
                >
                  {TIPOS_CARTA[t].etiqueta}
                </button>
              ))}
            </div>
          )}
          <Field label="Nombre" htmlFor="menu-nombre">
            <input
              id="menu-nombre"
              className={CLASE_INPUT}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio promocional" htmlFor="menu-precio">
              <input
                id="menu-precio"
                type="number"
                min={0}
                step="0.01"
                className={CLASE_INPUT}
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
              />
            </Field>
            <Field label="Sección de la carta" htmlFor="menu-seccion">
              <select
                id="menu-seccion"
                className={CLASE_INPUT}
                value={seccion}
                onChange={(e) => setSeccion(e.target.value)}
              >
                {secciones.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Plato" htmlFor="menu-plato">
            <select
              id="menu-plato"
              className={CLASE_INPUT}
              value={plato}
              onChange={(e) => setPlato(e.target.value)}
            >
              <option value="">Elegí el plato…</option>
              {platos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Field>
          {tipo === 'MENU_EJECUTIVO' && (
            <Field label="Postre" htmlFor="menu-postre" ayuda="El menú ejecutivo no incluye bebida">
              <select
                id="menu-postre"
                className={CLASE_INPUT}
                value={postre}
                onChange={(e) => setPostre(e.target.value)}
              >
                <option value="">Elegí el postre…</option>
                {postres.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vigente desde" htmlFor="menu-inicio">
              <input
                id="menu-inicio"
                type="date"
                className={CLASE_INPUT}
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </Field>
            <Field label="Vigente hasta" htmlFor="menu-fin">
              <input
                id="menu-fin"
                type="date"
                className={CLASE_INPUT}
                value={fin}
                onChange={(e) => setFin(e.target.value)}
              />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  )
}
