import type { ClienteCreate } from './types'

/** Valores del formulario de cliente, tal como los escribe el usuario. */
export interface FormularioCliente {
  nombre: string
  apellido: string
  telefono: string
  dni: string
  email: string
}

export type ErroresCliente = Partial<Record<keyof FormularioCliente, string>>

export const FORMULARIO_CLIENTE_VACIO: FormularioCliente = {
  nombre: '',
  apellido: '',
  telefono: '',
  dni: '',
  email: '',
}

const TELEFONO = /^[0-9+\-\s()]+$/
const DNI = /^\d{7,8}$/
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
/** Letras Unicode (tildes, ñ) separadas por espacios, apóstrofes, puntos o guiones. */
const PALABRAS = /^\p{L}+(?:[\s'.-]+\p{L}+)*$/u

/** Normaliza a NFC para que tildes y ñ compuestas se validen igual que en el backend. */
function normalizar(texto: string): string {
  return texto.normalize('NFC')
}

/**
 * Valida un nombre o apellido: solo letras, sin dígitos ni otros símbolos.
 * `campo` se usa para armar el mensaje de error.
 */
function validarPalabras(valor: string, campo: 'nombre' | 'apellido', errores: ErroresCliente) {
  const texto = normalizar(valor.trim())
  if (texto.length === 0) {
    errores[campo] = `El ${campo} es obligatorio`
  } else if (texto.length < 2 || texto.length > 50) {
    errores[campo] = `El ${campo} debe tener entre 2 y 50 caracteres`
  } else if (!PALABRAS.test(texto)) {
    errores[campo] = `El ${campo} solo puede contener letras, espacios, apóstrofes y guiones`
  }
}

/**
 * Valida el formulario con las mismas reglas que `ClienteCreate`/`ClienteUpdate`
 * del backend. Devuelve un mensaje por campo con error (objeto vacío si está todo bien).
 */
export function validarCliente(datos: FormularioCliente): ErroresCliente {
  const errores: ErroresCliente = {}

  validarPalabras(datos.nombre, 'nombre', errores)
  validarPalabras(datos.apellido, 'apellido', errores)

  const telefono = datos.telefono.trim()
  if (telefono.length === 0) errores.telefono = 'El teléfono es obligatorio'
  else if (telefono.length < 6 || telefono.length > 20 || !TELEFONO.test(telefono)) {
    errores.telefono = 'El teléfono debe tener entre 6 y 20 caracteres válidos'
  }

  const dni = datos.dni.trim()
  if (dni.length === 0) errores.dni = 'El DNI es obligatorio'
  else if (!DNI.test(dni)) errores.dni = 'El DNI debe tener 7 u 8 dígitos'

  const email = datos.email.trim()
  if (email.length > 100) {
    errores.email = 'El correo no puede superar los 100 caracteres'
  } else if (email.length > 0 && !EMAIL.test(email)) {
    errores.email = 'El correo electrónico no es válido'
  }

  return errores
}

/** Convierte el formulario (ya validado) en los datos que espera la API. */
export function aDatosApi(datos: FormularioCliente): ClienteCreate {
  return {
    nombre: normalizar(datos.nombre.trim()),
    apellido: normalizar(datos.apellido.trim()),
    telefono: datos.telefono.trim(),
    dni: datos.dni.trim(),
    email: datos.email.trim() || null,
  }
}
