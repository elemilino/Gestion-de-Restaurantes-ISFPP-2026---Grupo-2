import { useCallback, useEffect, useState } from 'react'

import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { StatusBadge } from '../../components/StatusBadge'
import { mensajeDe } from '../../lib/errores'
import { crearMedioPago, eliminarMedioPago, listarMediosPago, modificarMedioPago } from './api'
import type { MedioPago, TipoAcreditacion } from './types'

type EstadoForm = null | 'nuevo' | MedioPago

/** HU-07a/b: alta, listado, modificación y baja lógica de medios de pago. */
export function MediosPagoPage() {
  const [medios, setMedios] = useState<MedioPago[]>([])
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [form, setForm] = useState<EstadoForm>(null)
  const [nombre, setNombre] = useState('')
  const [acreditacion, setAcreditacion] = useState<TipoAcreditacion>('Inmediata')
  const [recargo, setRecargo] = useState('0')
  const [errorForm, setErrorForm] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    try {
      setMedios(await listarMediosPago())
      setError(null)
    } catch (e) {
      setError(mensajeDe(e))
    }
  }, [])

  useEffect(() => {
    let vigente = true
    listarMediosPago()
      .then((m) => vigente && setMedios(m))
      .catch((e) => vigente && setError(mensajeDe(e)))
    return () => {
      vigente = false
    }
  }, [])

  const cerrar = useCallback(() => setForm(null), [])

  function abrir(medio: MedioPago | 'nuevo') {
    setErrorForm(null)
    setNombre(medio === 'nuevo' ? '' : medio.nombre)
    setAcreditacion(medio === 'nuevo' ? 'Inmediata' : medio.tipo_acreditacion)
    setRecargo(medio === 'nuevo' ? '0' : String(Number(medio.porcentaje_recargo)))
    setForm(medio)
  }

  async function guardar() {
    if (Number(recargo) < 0) {
      setErrorForm('El recargo no puede ser un valor negativo')
      return
    }
    const datos = {
      nombre: nombre.trim(),
      tipo_acreditacion: acreditacion,
      porcentaje_recargo: recargo || '0',
    }
    try {
      if (form === 'nuevo') {
        await crearMedioPago(datos)
        setAviso(`Medio de pago ${datos.nombre} registrado`)
      } else if (form) {
        await modificarMedioPago(form.id, { ...datos, activo: form.activo })
        setAviso(`Medio de pago ${datos.nombre} modificado`)
      }
      setForm(null)
      await recargar()
    } catch (e) {
      setErrorForm(mensajeDe(e))
    }
  }

  async function darDeBaja(medio: MedioPago) {
    try {
      await eliminarMedioPago(medio.id)
      setAviso(`Medio de pago ${medio.nombre} dado de baja`)
      await recargar()
    } catch (e) {
      setError(mensajeDe(e))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Medios con los que se cobran las facturas y las señas (HU-07a/b).
        </p>
        <Button icono="add" onClick={() => abrir('nuevo')}>
          Nuevo medio de pago
        </Button>
      </div>
      {error && <Alert tono="error">{error}</Alert>}
      {aviso && <Alert tono="exito">{aviso}</Alert>}
      <div className="bg-white rounded-2xl border border-borde shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-amber-50/50 border-b border-borde text-[10px] uppercase tracking-wider text-slate-500">
              <th className="py-3 px-4">Nombre</th>
              <th className="py-3 px-4">Acreditación</th>
              <th className="py-3 px-4 text-right">Recargo</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {medios.map((m) => (
              <tr key={m.id}>
                <td className="py-2.5 px-4 font-semibold text-slate-900">{m.nombre}</td>
                <td className="py-2.5 px-4">{m.tipo_acreditacion}</td>
                <td className="py-2.5 px-4 text-right tabular">{Number(m.porcentaje_recargo)} %</td>
                <td className="py-2.5 px-4">
                  <StatusBadge tono={m.activo ? 'libre' : 'inactivo'}>
                    {m.activo ? 'Activo' : 'Inactivo'}
                  </StatusBadge>
                </td>
                <td className="py-2.5 px-4">
                  <div className="flex justify-end gap-2">
                    <Button variante="secundario" onClick={() => abrir(m)}>
                      Editar
                    </Button>
                    {m.activo && (
                      <Button variante="secundario" onClick={() => darDeBaja(m)}>
                        Dar de baja
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        abierto={form !== null}
        onCerrar={cerrar}
        titulo={form === 'nuevo' ? 'Nuevo medio de pago' : 'Editar medio de pago'}
        acciones={
          <>
            <Button variante="secundario" onClick={cerrar}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={!nombre.trim()}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {errorForm && <Alert tono="error">{errorForm}</Alert>}
          <Field label="Nombre" htmlFor="medio-nombre">
            <input
              id="medio-nombre"
              className={CLASE_INPUT}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </Field>
          <Field label="Tipo de acreditación" htmlFor="medio-acreditacion">
            <select
              id="medio-acreditacion"
              className={CLASE_INPUT}
              value={acreditacion}
              onChange={(e) => setAcreditacion(e.target.value as TipoAcreditacion)}
            >
              <option value="Inmediata">Inmediata</option>
              <option value="Diferida">Diferida</option>
            </select>
          </Field>
          <Field label="Recargo (%)" htmlFor="medio-recargo" ayuda="0 si no aplica">
            <input
              id="medio-recargo"
              type="number"
              step="0.01"
              className={CLASE_INPUT}
              value={recargo}
              onChange={(e) => setRecargo(e.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
