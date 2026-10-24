import { useState, type FormEvent } from 'react'

import { ApiError } from '../../api/client'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { cambiarStock } from './api'
import type { Producto } from './types'
import { validarStock } from './validaciones'

interface StockModalProps {
  producto: Producto
  onCerrar: () => void
  onGuardado: (producto: Producto) => void
}

/** HU-04d: cargar, cambiar o dejar de controlar el stock de un producto. */
export function StockModal({ producto, onCerrar, onGuardado }: StockModalProps) {
  const [sinControl, setSinControl] = useState(producto.stock === null)
  const [valor, setValor] = useState(producto.stock?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)
  const [errorApi, setErrorApi] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setErrorApi(null)
    const mensaje = sinControl ? null : validarStock(valor)
    setError(mensaje)
    if (mensaje) return

    setGuardando(true)
    try {
      onGuardado(await cambiarStock(producto.id, sinControl ? null : Number(valor)))
    } catch (e) {
      setErrorApi(e instanceof ApiError ? e.message : 'Ocurrió un error inesperado')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={`Stock de ${producto.nombre}`}
      acciones={
        <>
          <Button variante="secundario" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-stock" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-stock" onSubmit={guardar} noValidate className="flex flex-col gap-4">
        {errorApi && <Alert tono="error">{errorApi}</Alert>}
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={sinControl}
            onChange={(e) => {
              setSinControl(e.target.checked)
              setError(null)
            }}
            className="w-4 h-4 accent-brand-600"
          />
          No controlar stock
        </label>
        <Field
          label="Unidades en stock"
          htmlFor="stock-valor"
          error={error ?? undefined}
          ayuda="Al llegar a 0 el producto aparece como No disponible."
        >
          <input
            id="stock-valor"
            type="number"
            min={0}
            step={1}
            value={sinControl ? '' : valor}
            disabled={sinControl}
            onChange={(e) => setValor(e.target.value)}
            aria-invalid={error ? true : undefined}
            className={`${CLASE_INPUT} tabular`}
          />
        </Field>
      </form>
    </Modal>
  )
}
