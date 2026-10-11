/** Ícono de Material Symbols Outlined. Nombres en https://fonts.google.com/icons */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden="true">
      {name}
    </span>
  )
}
