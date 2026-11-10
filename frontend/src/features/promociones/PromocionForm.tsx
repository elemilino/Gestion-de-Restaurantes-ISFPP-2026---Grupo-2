import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { ApiError } from '../../api/client'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { listarProductos, listarSecciones } from '../carta/api'
import type { Producto, Seccion } from '../carta/types'
import { crearPromocion, listarPromociones, modificarPromocion } from './api'
import { CampoFecha } from './CampoFecha'
import { mensajeDeError } from './errores'
import { ProductosSelector } from './ProductosSelector'
import type { Promocion } from './types'
import {
  aDatosApi,
  aFormulario,
  cambiosRespectoDe,
  conflictosDeProductos,
  FORMULARIO_PROMOCION_VACIO,
  validarPromocion,
  type ErroresPromocion,
  type FormularioPromocion,
} from './validaciones'

interface PromocionFormProps {
  /** Promoción a editar; `null` para el alta. */
  promocion: Promocion | null
  onCerrar: () => void
  onGuardado: (promocion: Promocion) => void
}

/**
 * Alta y edición de promociones (HU-09a). Se monta cada vez que se abre, así
 * arranca con los datos de la promoción elegida.
 */
export function PromocionForm({ promocion, onCerrar, onGuardado }: PromocionFormProps) {
  const [datos, setDatos] = useState<FormularioPromocion>(() =>
    promocion ? aFormulario(promocion) : FORMULARIO_PROMOCION_VACIO,
  )
  const original = useMemo(() => (promocion ? aFormulario(promocion) : null), [promocion])
  const [errores, setErrores] = useState<ErroresPromocion>({})
  const [errorApi, setErrorApi] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  /** Productos que chocan con otra promoción activa, con las promociones que los usan. */
  const [conflictos, setConflictos] = useState<Map<number, Promocion[]>>(new Map())

  const [productos, setProductos] = useState<Producto[]>([])
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [cargandoProductos, setCargandoProductos] = useState(true)
  const [errorProductos, setErrorProductos] = useState<string | null>(null)

  useEffect(() => {
    let montado = true
    Promise.all([listarProductos(), listarSecciones()])
      .then(([listaProductos, listaSecciones]) => {
        if (!montado) return
        setProductos(listaProductos)
        setSecciones(listaSecciones)
      })
      .catch((e) => montado && setErrorProductos(mensajeDeError(e)))
      .finally(() => montado && setCargandoProductos(false))
    return () => {
      montado = false
    }
  }, [])

  function nombreProducto(id: number): string {
    return (
      productos.find((p) => p.id === id)?.nombre ??
      promocion?.productos.find((p) => p.id === id)?.nombre ??
      `Producto ${id}`
    )
  }

  function cambiar(campo: keyof FormularioPromocion, valor: string) {
    setConflictos(new Map())
    setDatos((anteriores) => ({ ...anteriores, [campo]: valor }))
  }

  function alternarProducto(id: number) {
    setConflictos(new Map())
    setDatos((anteriores) => ({
      ...anteriores,
      productos_ids: anteriores.productos_ids.includes(id)
        ? anteriores.productos_ids.filter((productoId) => productoId !== id)
        : [...anteriores.productos_ids, id],
    }))
  }

  function seleccionarVisibles(ids: number[]) {
    setConflictos(new Map())
    setDatos((anteriores) => {
      const conjunto = new Set(anteriores.productos_ids)
      ids.forEach((id) => conjunto.add(id))
      return { ...anteriores, productos_ids: [...conjunto] }
    })
  }

  function limpiarSeleccion() {
    setConflictos(new Map())
    setDatos((anteriores) => ({ ...anteriores, productos_ids: [] }))
  }

  /** Al chocar con otra promoción, marca en la lista los productos afectados. */
  async function marcarConflictos(e: unknown) {
    if (!(e instanceof ApiError) || e.code !== 'PROMOCION_SUPERPUESTA') {
      setConflictos(new Map())
      setErrorApi(mensajeDeError(e))
      return
    }

    try {
      const actuales = await listarPromociones()
      const mapa = conflictosDeProductos(
        actuales,
        datos.productos_ids,
        datos.fecha_inicio,
        datos.fecha_fin,
        promocion?.id,
      )
      setConflictos(mapa)

      const nombres = [...mapa.keys()].map(nombreProducto)
      setErrorApi(
        nombres.length > 0
          ? `Estos productos ya tienen una promoción activa en ese período: ${nombres.join(', ')}.`
          : mensajeDeError(e),
      )
    } catch {
      setConflictos(new Map())
      setErrorApi(mensajeDeError(e))
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setErrorApi(null)
    setConflictos(new Map())

    const nuevosErrores = validarPromocion(datos, promocion?.fecha_inicio)
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    setGuardando(true)
    try {
      let guardada: Promocion
      if (promocion && original) {
        const cambios = cambiosRespectoDe(datos, original)
        guardada =
          Object.keys(cambios).length === 0
            ? promocion
            : await modificarPromocion(promocion.id, cambios)
      } else {
        guardada = await crearPromocion(aDatosApi(datos))
      }
      onGuardado(guardada)
    } catch (e) {
      await marcarConflictos(e)
    } finally {
      setGuardando(false)
    }
  }

  const invalido = (campo: keyof FormularioPromocion) => (errores[campo] ? true : undefined)

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={promocion ? 'Editar promoción' : 'Registrar promoción'}
      ancho="max-w-2xl"
      acciones={
        <>
          <Button variante="secundario" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-promocion" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-promocion" onSubmit={guardar} noValidate className="flex flex-col gap-4">
        {errorApi && <Alert tono="error">{errorApi}</Alert>}

        <Field
          label="Descripción"
          htmlFor="promocion-descripcion"
          error={errores.descripcion}
          ayuda="Ej. 2x1 en hamburguesas"
        >
          <input
            id="promocion-descripcion"
            value={datos.descripcion}
            onChange={(e) => cambiar('descripcion', e.target.value)}
            placeholder="Ej. 2x1 en hamburguesas"
            aria-invalid={invalido('descripcion')}
            className={CLASE_INPUT}
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field
            label="Descuento (%)"
            htmlFor="promocion-descuento"
            error={errores.descuento}
            ayuda="Mayor a 0 y hasta 100"
          >
            <input
              id="promocion-descuento"
              type="number"
              inputMode="decimal"
              min="0.01"
              max="100"
              step="0.01"
              value={datos.descuento}
              onChange={(e) => cambiar('descuento', e.target.value)}
              placeholder="Ej. 15"
              aria-invalid={invalido('descuento')}
              className={`${CLASE_INPUT} tabular`}
            />
          </Field>

          <Field label="Desde" htmlFor="promocion-inicio" error={errores.fecha_inicio}>
            <CampoFecha
              id="promocion-inicio"
              etiqueta="Desde"
              value={datos.fecha_inicio}
              onChange={(iso) => cambiar('fecha_inicio', iso)}
              ariaInvalid={invalido('fecha_inicio')}
            />
          </Field>

          <Field label="Hasta" htmlFor="promocion-fin" error={errores.fecha_fin}>
            <CampoFecha
              id="promocion-fin"
              etiqueta="Hasta"
              alineacion="derecha"
              value={datos.fecha_fin}
              onChange={(iso) => cambiar('fecha_fin', iso)}
              ariaInvalid={invalido('fecha_fin')}
            />
          </Field>
        </div>

        <ProductosSelector
          productos={productos}
          secciones={secciones}
          seleccionados={datos.productos_ids}
          productosDePromocion={promocion?.productos ?? []}
          conflictos={conflictos}
          cargando={cargandoProductos}
          error={errorProductos}
          errorSeleccion={errores.productos_ids}
          onAlternar={alternarProducto}
          onSeleccionarVisibles={seleccionarVisibles}
          onLimpiar={limpiarSeleccion}
        />
      </form>
    </Modal>
  )
}
