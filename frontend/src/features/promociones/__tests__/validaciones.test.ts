import { describe, expect, it } from 'vitest'

import type { Promocion } from '../types'
import {
  aDatosApi,
  aFormulario,
  cambiosRespectoDe,
  conflictosDeProductos,
  estadoPromocion,
  FORMULARIO_PROMOCION_VACIO,
  formatearFecha,
  formatearFechaEntrada,
  textoAFecha,
  validarPromocion,
  type FormularioPromocion,
} from '../validaciones'

/** Fecha ISO a `dias` de hoy, calculada en hora local. */
function fecha(dias: number): string {
  const hoy = new Date()
  const local = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias)
  const mes = String(local.getMonth() + 1).padStart(2, '0')
  const dia = String(local.getDate()).padStart(2, '0')
  return `${local.getFullYear()}-${mes}-${dia}`
}

const FORMULARIO_VALIDO: FormularioPromocion = {
  descripcion: '2x1 en hamburguesas',
  descuento: '15',
  fecha_inicio: fecha(0),
  fecha_fin: fecha(5),
  productos_ids: [10],
}

function promocion(cambios: Partial<Promocion> = {}): Promocion {
  return {
    id: 1,
    descripcion: 'Promo',
    fecha_inicio: fecha(0),
    fecha_fin: fecha(5),
    descuento: '10.00',
    activo: true,
    vigente: true,
    productos: [{ id: 10, nombre: 'Hamburguesa' }],
    ...cambios,
  }
}

describe('validarPromocion (CA2 y CA3)', () => {
  it('acepta un formulario válido', () => {
    expect(validarPromocion(FORMULARIO_VALIDO)).toEqual({})
  })

  it('rechaza la descripción vacía, corta o demasiado larga', () => {
    expect(validarPromocion({ ...FORMULARIO_VALIDO, descripcion: '   ' }).descripcion).toBe(
      'La descripción es obligatoria',
    )
    expect(validarPromocion({ ...FORMULARIO_VALIDO, descripcion: 'ab' }).descripcion).toBe(
      'La descripción debe tener entre 3 y 200 caracteres',
    )
    expect(
      validarPromocion({ ...FORMULARIO_VALIDO, descripcion: 'x'.repeat(201) }).descripcion,
    ).toBe('La descripción debe tener entre 3 y 200 caracteres')
  })

  it.each(['', 'abc', '10.123', '0', '-5', '100.01'])('rechaza el descuento "%s"', (descuento) => {
    expect(validarPromocion({ ...FORMULARIO_VALIDO, descuento }).descuento).toBeDefined()
  })

  it('acepta descuentos con hasta dos decimales', () => {
    expect(validarPromocion({ ...FORMULARIO_VALIDO, descuento: '0.01' })).toEqual({})
    expect(validarPromocion({ ...FORMULARIO_VALIDO, descuento: '100' })).toEqual({})
    expect(validarPromocion({ ...FORMULARIO_VALIDO, descuento: '99.99' })).toEqual({})
  })

  it('rechaza fechas faltantes y una fecha de inicio pasada', () => {
    const sinFechas = validarPromocion({
      ...FORMULARIO_VALIDO,
      fecha_inicio: '',
      fecha_fin: '',
    })
    expect(sinFechas.fecha_inicio).toBe('La fecha de inicio es obligatoria')
    expect(sinFechas.fecha_fin).toBe('La fecha de fin es obligatoria')

    expect(validarPromocion({ ...FORMULARIO_VALIDO, fecha_inicio: fecha(-1) }).fecha_inicio).toBe(
      'La fecha de inicio no puede ser anterior a hoy',
    )
  })

  it('permite conservar una fecha de inicio pasada al editar (CA4)', () => {
    expect(
      validarPromocion({ ...FORMULARIO_VALIDO, fecha_inicio: fecha(-10) }, fecha(-10)),
    ).toEqual({})
  })

  it('rechaza una fecha de fin igual o anterior a la de inicio', () => {
    expect(
      validarPromocion({
        ...FORMULARIO_VALIDO,
        fecha_inicio: fecha(5),
        fecha_fin: fecha(5),
      }).fecha_fin,
    ).toBe('La fecha de fin debe ser posterior a la fecha de inicio')

    expect(
      validarPromocion({
        ...FORMULARIO_VALIDO,
        fecha_inicio: fecha(5),
        fecha_fin: fecha(4),
      }).fecha_fin,
    ).toBe('La fecha de fin debe ser posterior a la fecha de inicio')
  })

  it('exige al menos un producto', () => {
    expect(validarPromocion({ ...FORMULARIO_VALIDO, productos_ids: [] }).productos_ids).toBe(
      'Seleccioná al menos un producto',
    )
  })
})

describe('conversión de datos', () => {
  it('aDatosApi recorta espacios y conserva las fechas ISO', () => {
    expect(
      aDatosApi({
        ...FORMULARIO_VALIDO,
        descripcion: '  Promo  ',
        descuento: ' 25.50 ',
      }),
    ).toEqual({
      descripcion: 'Promo',
      descuento: '25.50',
      fecha_inicio: FORMULARIO_VALIDO.fecha_inicio,
      fecha_fin: FORMULARIO_VALIDO.fecha_fin,
      productos_ids: [10],
    })
  })

  it('aFormulario precarga los datos de la promoción', () => {
    expect(aFormulario(promocion())).toEqual({
      descripcion: 'Promo',
      descuento: '10.00',
      fecha_inicio: fecha(0),
      fecha_fin: fecha(5),
      productos_ids: [10],
    })
  })

  it('cambiosRespectoDe devuelve solo los campos modificados', () => {
    const original = aFormulario(promocion())

    expect(cambiosRespectoDe(original, original)).toEqual({})
    expect(cambiosRespectoDe({ ...original, descripcion: 'Otra' }, original)).toEqual({
      descripcion: 'Otra',
    })
    expect(cambiosRespectoDe({ ...original, fecha_fin: fecha(9) }, original)).toEqual({
      fecha_fin: fecha(9),
    })
  })

  it('cambiosRespectoDe detecta cambios de productos sin importar el orden', () => {
    const original = { ...aFormulario(promocion()), productos_ids: [10, 11] }

    expect(cambiosRespectoDe({ ...original, productos_ids: [11, 10] }, original)).toEqual({})
    expect(cambiosRespectoDe({ ...original, productos_ids: [10] }, original)).toEqual({
      productos_ids: [10],
    })
  })
})

describe('estadoPromocion', () => {
  it('calcula vigente, programada, vencida e inactiva', () => {
    expect(estadoPromocion(promocion())).toBe('vigente')
    expect(estadoPromocion(promocion({ fecha_inicio: fecha(2), fecha_fin: fecha(5) }))).toBe(
      'programada',
    )
    expect(
      estadoPromocion(
        promocion({
          fecha_inicio: fecha(-10),
          fecha_fin: fecha(-1),
          activo: false,
        }),
      ),
    ).toBe('vencida')
    expect(estadoPromocion(promocion({ activo: false }))).toBe('inactiva')
  })
})

describe('helpers de fecha', () => {
  it('formatea ISO como dd/mm/aaaa', () => {
    expect(formatearFecha('2026-11-09')).toBe('09/11/2026')
    expect(formatearFecha('')).toBe('')
    expect(formatearFecha('09/11/2026')).toBe('')
  })

  it('formatea la entrada del usuario como dd/mm/aaaa', () => {
    expect(formatearFechaEntrada('09112026')).toBe('09/11/2026')
    expect(formatearFechaEntrada('09/11/2026')).toBe('09/11/2026')
    expect(formatearFechaEntrada('09-11-2026')).toBe('09/11/2026')
    expect(formatearFechaEntrada('09/11')).toBe('09/11')
    expect(formatearFechaEntrada('abc')).toBe('')
  })

  it('convierte dd/mm/aaaa a ISO y rechaza fechas inválidas', () => {
    expect(textoAFecha('09/11/2026')).toBe('2026-11-09')
    expect(textoAFecha('31/02/2026')).toBe('')
    expect(textoAFecha('09/11')).toBe('')
    expect(textoAFecha('')).toBe('')
  })
})

describe('conflictosDeProductos', () => {
  const seleccion = [10, 11]

  it('marca los productos de promociones activas que se superponen', () => {
    const conflictos = conflictosDeProductos(
      [
        promocion({
          id: 2,
          descripcion: 'Promo existente',
          fecha_inicio: fecha(1),
          fecha_fin: fecha(3),
          productos: [
            { id: 10, nombre: 'Hamburguesa' },
            { id: 12, nombre: 'Pizza' },
          ],
        }),
      ],
      seleccion,
      fecha(0),
      fecha(5),
    )

    expect([...conflictos.keys()]).toEqual([10])
    expect(conflictos.get(10)?.[0].descripcion).toBe('Promo existente')
  })

  it('ignora promociones inactivas, la propia y las que no se superponen', () => {
    const promociones = [
      promocion({ id: 2, activo: false }),
      promocion({ id: 3 }),
      promocion({ id: 4, fecha_inicio: fecha(10), fecha_fin: fecha(15) }),
    ]

    expect(conflictosDeProductos(promociones, seleccion, fecha(0), fecha(5), 3).size).toBe(0)
  })

  it('ignora productos que no están en la selección', () => {
    const promociones = [
      promocion({
        id: 2,
        productos: [{ id: 99, nombre: 'Otro' }],
      }),
    ]

    expect(conflictosDeProductos(promociones, seleccion, fecha(0), fecha(5)).size).toBe(0)
  })
})

describe('FORMULARIO_PROMOCION_VACIO', () => {
  it('arranca sin datos', () => {
    expect(FORMULARIO_PROMOCION_VACIO).toEqual({
      descripcion: '',
      descuento: '',
      fecha_inicio: '',
      fecha_fin: '',
      productos_ids: [],
    })
  })
})
