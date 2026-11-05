import { useState, type FormEvent } from 'react'

import { ApiError } from '../../api/client'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { CLASE_INPUT, Field } from '../../components/Field'
import { Modal } from '../../components/Modal'
import { crearCliente, modificarCliente } from './api'
import type { Cliente } from './types'
import {
  aDatosApi,
  FORMULARIO_CLIENTE_VACIO,
  validarCliente,
  type ErroresCliente,
  type FormularioCliente,
} from './validaciones'

function desdeCliente(cliente: Cliente): FormularioCliente {
  return {
    nombre: cliente.nombre,
    apellido: cliente.apellido,
    telefono: cliente.telefono,
    dni: cliente.dni,
    email: cliente.email ?? '',
  }
}

interface ClienteFormProps {
  /** Cliente a editar; `null` para el alta. */
  cliente: Cliente | null
  onCerrar: () => void
  onGuardado: (cliente: Cliente) => void
}

/**
 * Alta y edición de clientes (HU-10). Se monta cada vez que se abre, así arranca
 * con los datos del cliente elegido.
 */
export function ClienteForm({ cliente, onCerrar, onGuardado }: ClienteFormProps) {
  const [datos, setDatos] = useState<FormularioCliente>(() =>
    cliente ? desdeCliente(cliente) : FORMULARIO_CLIENTE_VACIO,
  )
  const [errores, setErrores] = useState<ErroresCliente>({})
  const [errorApi, setErrorApi] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function cambiar(campo: keyof FormularioCliente, valor: string) {
    setDatos((anteriores) => ({ ...anteriores, [campo]: valor }))
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setErrorApi(null)
    const nuevosErrores = validarCliente(datos)
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    setGuardando(true)
    try {
      const enviar = aDatosApi(datos)
      const guardado = cliente
        ? await modificarCliente(cliente.id, enviar)
        : await crearCliente(enviar)
      onGuardado(guardado)
    } catch (e) {
      setErrorApi(e instanceof ApiError ? e.message : 'Ocurrió un error inesperado')
    } finally {
      setGuardando(false)
    }
  }

  const invalido = (campo: keyof FormularioCliente) => (errores[campo] ? true : undefined)

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={
        cliente ? `Editar cliente: ${cliente.nombre} ${cliente.apellido}` : 'Registrar cliente'
      }
      ancho="max-w-lg"
      acciones={
        <>
          <Button variante="secundario" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-cliente" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-cliente" onSubmit={guardar} noValidate className="flex flex-col gap-4">
        {errorApi && <Alert tono="error">{errorApi}</Alert>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre" htmlFor="cliente-nombre" error={errores.nombre}>
            <input
              id="cliente-nombre"
              value={datos.nombre}
              onChange={(e) => cambiar('nombre', e.target.value)}
              placeholder="Ej. Juan"
              aria-invalid={invalido('nombre')}
              className={CLASE_INPUT}
              autoFocus
            />
          </Field>

          <Field label="Apellido" htmlFor="cliente-apellido" error={errores.apellido}>
            <input
              id="cliente-apellido"
              value={datos.apellido}
              onChange={(e) => cambiar('apellido', e.target.value)}
              placeholder="Ej. Pérez"
              aria-invalid={invalido('apellido')}
              className={CLASE_INPUT}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="DNI" htmlFor="cliente-dni" error={errores.dni} ayuda="7 u 8 dígitos">
            <input
              id="cliente-dni"
              value={datos.dni}
              onChange={(e) => cambiar('dni', e.target.value)}
              placeholder="Ej. 30123456"
              inputMode="numeric"
              aria-invalid={invalido('dni')}
              className={`${CLASE_INPUT} tabular`}
            />
          </Field>

          <Field label="Teléfono" htmlFor="cliente-telefono" error={errores.telefono}>
            <input
              id="cliente-telefono"
              value={datos.telefono}
              onChange={(e) => cambiar('telefono', e.target.value)}
              placeholder="Ej. 1122334455"
              aria-invalid={invalido('telefono')}
              className={CLASE_INPUT}
            />
          </Field>
        </div>

        <Field label="Correo electrónico (opcional)" htmlFor="cliente-email" error={errores.email}>
          <input
            id="cliente-email"
            type="email"
            value={datos.email}
            onChange={(e) => cambiar('email', e.target.value)}
            placeholder="Ej. juan@example.com"
            aria-invalid={invalido('email')}
            className={CLASE_INPUT}
          />
        </Field>
      </form>
    </Modal>
  )
}
