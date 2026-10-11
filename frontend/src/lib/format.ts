/**
 * Formatea un monto en pesos argentinos: 78500 → "$ 78.500", 5500.5 → "$ 5.500,50".
 * Acepta string porque el backend envía los Decimal como texto ("5500.00").
 */
export function formatMoneda(valor: number | string): string {
  const numero = Number(valor)
  const decimales = Number.isInteger(numero) ? 0 : 2
  return (
    '$ ' +
    numero.toLocaleString('es-AR', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: 2,
    })
  )
}
