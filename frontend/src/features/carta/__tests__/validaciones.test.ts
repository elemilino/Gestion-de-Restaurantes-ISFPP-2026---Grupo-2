import { describe, expect, it } from 'vitest'

import { aDatosApi, FORMULARIO_VACIO, validarProducto } from '../validaciones'

const PLATO_VALIDO = {
  ...FORMULARIO_VACIO,
  nombre: 'Ñoquis con salsa',
  descripcion: 'Ñoquis de papa con salsa fileto',
  precio: '5000',
  seccion_id: '2',
  porcion_gramos: '350',
}

describe('validarProducto: plato', () => {
  it('acepta un plato válido', () => {
    expect(validarProducto('PLATO', PLATO_VALIDO)).toEqual({})
  })

  it('acepta un plato sin descripción ni porción y con 2 decimales', () => {
    const datos = { ...PLATO_VALIDO, descripcion: '', porcion_gramos: '', precio: '4500.50' }
    expect(validarProducto('PLATO', datos)).toEqual({})
  })

  it.each(['', 'ab', '  ab  ', 'x'.repeat(61)])('rechaza el nombre "%s"', (nombre) => {
    expect(validarProducto('PLATO', { ...PLATO_VALIDO, nombre }).nombre).toBe(
      'El nombre debe tener entre 3 y 60 caracteres',
    )
  })

  it('rechaza una descripción de más de 200 caracteres', () => {
    const datos = { ...PLATO_VALIDO, descripcion: 'x'.repeat(201) }
    expect(validarProducto('PLATO', datos).descripcion).toBe(
      'La descripción no puede superar los 200 caracteres',
    )
  })

  it.each(['', '0', '-1', 'abc'])('rechaza el precio "%s"', (precio) => {
    expect(validarProducto('PLATO', { ...PLATO_VALIDO, precio }).precio).toBe(
      'El precio debe ser mayor a 0',
    )
  })

  it('rechaza un precio con más de 2 decimales', () => {
    expect(validarProducto('PLATO', { ...PLATO_VALIDO, precio: '10.555' }).precio).toBe(
      'El precio puede tener hasta 2 decimales',
    )
  })

  it('pide elegir una sección', () => {
    expect(validarProducto('PLATO', { ...PLATO_VALIDO, seccion_id: '' }).seccion_id).toBe(
      'Elegí una sección',
    )
  })

  it.each(['0', '-5', '1.5', 'abc'])('rechaza la porción "%s"', (porcion_gramos) => {
    expect(validarProducto('PLATO', { ...PLATO_VALIDO, porcion_gramos }).porcion_gramos).toBe(
      'La porción debe ser un número entero mayor a 0',
    )
  })

  it('arma los datos para la API', () => {
    expect(aDatosApi('PLATO', { ...PLATO_VALIDO, descripcion: '  ' })).toEqual({
      nombre: 'Ñoquis con salsa',
      descripcion: null,
      precio: '5000',
      seccion_id: 2,
      porcion_gramos: 350,
    })
  })
})

describe('validarProducto: postre', () => {
  const POSTRE_VALIDO = {
    ...FORMULARIO_VACIO,
    nombre: 'Flan casero',
    precio: '3000',
    seccion_id: '5',
  }

  it('acepta un postre válido, con o sin porción', () => {
    expect(validarProducto('POSTRE', POSTRE_VALIDO)).toEqual({})
    expect(validarProducto('POSTRE', { ...POSTRE_VALIDO, porcion_gramos: '120' })).toEqual({})
  })

  it('usa las mismas reglas que el plato', () => {
    const errores = validarProducto('POSTRE', {
      ...POSTRE_VALIDO,
      precio: '0',
      seccion_id: '',
      porcion_gramos: '1.5',
    })
    expect(errores).toEqual({
      precio: 'El precio debe ser mayor a 0',
      seccion_id: 'Elegí una sección',
      porcion_gramos: 'La porción debe ser un número entero mayor a 0',
    })
  })

  it('envía la porción del postre', () => {
    expect(aDatosApi('POSTRE', { ...POSTRE_VALIDO, porcion_gramos: '120' })).toMatchObject({
      porcion_gramos: 120,
    })
  })
})
