import { describe, expect, it } from 'vitest'

import { formatMoneda } from '../lib/format'

describe('formatMoneda', () => {
  it('usa el formato argentino sin decimales para montos enteros', () => {
    expect(formatMoneda(78500)).toBe('$ 78.500')
    expect(formatMoneda(1842500)).toBe('$ 1.842.500')
  })

  it('acepta los Decimal que manda el backend como texto', () => {
    expect(formatMoneda('5500.00')).toBe('$ 5.500')
    expect(formatMoneda('5500.50')).toBe('$ 5.500,50')
  })
})
