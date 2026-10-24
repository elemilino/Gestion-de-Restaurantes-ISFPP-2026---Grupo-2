import { useState, type FormEvent } from 'react'

import { ApiError } from '../../api/client'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { crearPlato, crearPostre, modificarPlato, modificarPostre } from './api'
import { TIPOS_PRODUCTO } from './tiposProducto'
import type { Producto, ProductoDatos, Seccion, TipoProducto } from './types'
import {
  aDatosApi,
  FORMULARIO_VACIO,
  validarProducto,
  type ErroresProducto,
  type FormularioProducto,
} from './validaciones'

interface ConfigTipo {
  /** Campos propios del tipo, además de los comunes. */
  campos: (keyof FormularioProducto)[]
  crear: (datos: ProductoDatos) => Promise<Producto>
  modificar: (id: number, datos: ProductoDatos) => Promise<Producto>
}

/**
 * Tipos que se pueden cargar desde el formulario. Para habilitar uno nuevo alcanza con
 * agregarlo acá (y sus reglas en validaciones.ts).
 */
const CONFIG_TIPOS: Partial<Record<TipoProducto, ConfigTipo>> = {
  PLATO: { campos: ['porcion_gramos'], crear: crearPlato, modificar: modificarPlato },
  POSTRE: { campos: ['porcion_gramos'], crear: crearPostre, modificar: modificarPostre },
}

const TIPOS_HABILITADOS = Object.keys(CONFIG_TIPOS) as TipoProducto[]

function desdeProducto(p: Producto): FormularioProducto {
  return {
    nombre: p.nombre,
    descripcion: p.descripcion ?? '',
    precio: String(Number(p.precio)),
    seccion_id: String(p.seccion_id),
    porcion_gramos: p.porcion_gramos?.toString() ?? '',
  }
}

interface ProductoFormProps {
  /** Producto a editar; `null` para el alta. */
  producto: Producto | null
  secciones: Seccion[]
  onCerrar: () => void
  onGuardado: (producto: Producto) => void
}

/**
 * Alta y edición de productos (HU-04a). El selector de tipo cambia los campos propios.
 * Se monta cada vez que se abre, así arranca con los datos del producto elegido.
 */
export function ProductoForm({ producto, secciones, onCerrar, onGuardado }: ProductoFormProps) {
  const [tipo, setTipo] = useState<TipoProducto>(producto?.tipo ?? TIPOS_HABILITADOS[0])
  const [datos, setDatos] = useState<FormularioProducto>(() =>
    producto ? desdeProducto(producto) : FORMULARIO_VACIO,
  )
  const [errores, setErrores] = useState<ErroresProducto>({})
  const [errorApi, setErrorApi] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const config = CONFIG_TIPOS[tipo]
  const tieneCampo = (campo: keyof FormularioProducto) => config?.campos.includes(campo) ?? false

  function cambiar(campo: keyof FormularioProducto, valor: string) {
    setDatos((anteriores) => ({ ...anteriores, [campo]: valor }))
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setErrorApi(null)
    const nuevosErrores = validarProducto(tipo, datos)
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0 || !config) return

    setGuardando(true)
    try {
      const enviar = aDatosApi(tipo, datos)
      const guardado = producto
        ? await config.modificar(producto.id, enviar)
        : await config.crear(enviar)
      onGuardado(guardado)
    } catch (e) {
      setErrorApi(e instanceof ApiError ? e.message : 'Ocurrió un error inesperado')
    } finally {
      setGuardando(false)
    }
  }

  const invalido = (campo: keyof FormularioProducto) => (errores[campo] ? true : undefined)

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={producto ? `Editar ${producto.nombre}` : 'Nuevo producto'}
      ancho="max-w-lg"
      acciones={
        <>
          <Button variante="secundario" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-producto" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-producto" onSubmit={guardar} noValidate className="flex flex-col gap-4">
        {errorApi && <Alert tono="error">{errorApi}</Alert>}

        <fieldset className="flex flex-col gap-1">
          <legend className="text-xs font-bold text-slate-700 mb-1">Tipo</legend>
          <div className="flex gap-2" role="radiogroup" aria-label="Tipo de producto">
            {(Object.keys(TIPOS_PRODUCTO) as TipoProducto[]).map((t) => {
              const habilitado = TIPOS_HABILITADOS.includes(t) && !producto
              const elegido = tipo === t
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={elegido}
                  disabled={!habilitado && !elegido}
                  onClick={() => habilitado && setTipo(t)}
                  className={`flex-1 h-11 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 ${
                    elegido
                      ? 'bg-brand-50 border-brand-600 text-brand-800'
                      : 'bg-white border-borde text-slate-600 hover:bg-amber-50'
                  }`}
                >
                  <Icon name={TIPOS_PRODUCTO[t].icono} className="text-base" />
                  {TIPOS_PRODUCTO[t].etiqueta}
                </button>
              )
            })}
          </div>
          {producto && (
            <p className="text-xs text-slate-500">El tipo no se puede cambiar al editar.</p>
          )}
        </fieldset>

        <Field label="Nombre" htmlFor="producto-nombre" error={errores.nombre}>
          <input
            id="producto-nombre"
            value={datos.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
            placeholder="Ej. Ñoquis con salsa"
            aria-invalid={invalido('nombre')}
            className={CLASE_INPUT}
          />
        </Field>

        <Field
          label="Descripción (opcional)"
          htmlFor="producto-descripcion"
          error={errores.descripcion}
        >
          <textarea
            id="producto-descripcion"
            value={datos.descripcion}
            onChange={(e) => cambiar('descripcion', e.target.value)}
            rows={2}
            aria-invalid={invalido('descripcion')}
            className={`${CLASE_INPUT} h-auto py-2 resize-none`}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio ($)" htmlFor="producto-precio" error={errores.precio}>
            <input
              id="producto-precio"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={datos.precio}
              onChange={(e) => cambiar('precio', e.target.value)}
              aria-invalid={invalido('precio')}
              className={`${CLASE_INPUT} tabular`}
            />
          </Field>

          <Field label="Sección" htmlFor="producto-seccion" error={errores.seccion_id}>
            <select
              id="producto-seccion"
              value={datos.seccion_id}
              onChange={(e) => cambiar('seccion_id', e.target.value)}
              aria-invalid={invalido('seccion_id')}
              className={CLASE_INPUT}
            >
              <option value="">Seleccionar…</option>
              {secciones.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {tieneCampo('porcion_gramos') && (
          <Field
            label="Porción en gramos (opcional)"
            htmlFor="producto-porcion"
            error={errores.porcion_gramos}
          >
            <input
              id="producto-porcion"
              type="number"
              min={1}
              step={1}
              value={datos.porcion_gramos}
              onChange={(e) => cambiar('porcion_gramos', e.target.value)}
              aria-invalid={invalido('porcion_gramos')}
              className={`${CLASE_INPUT} tabular`}
            />
          </Field>
        )}
      </form>
    </Modal>
  )
}
