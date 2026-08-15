/**
 * Los cuatro iconos que usan las pantallas del comprador, en SVG y en línea.
 *
 * SVG y no mapas de bits ni emoji: es la regla «Vector-Only Assets» de la skill
 * `ui-ux-pro-max`, y además permite que hereden el color del texto con
 * `currentColor`, así que el mismo icono sirve en los dos temas sin duplicarse.
 *
 * Todos son decorativos —siempre acompañan a un texto que dice lo mismo—, así
 * que van con `aria-hidden`: un lector de pantalla que los nombrara repetiría
 * lo que la persona ya acaba de oír.
 */

interface IconoProps {
  className?: string
}

function Svg({ children, className }: IconoProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className === undefined ? 'icono' : `icono ${className}`}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function IconoReloj({ className }: IconoProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  )
}

export function IconoPantalla({ className }: IconoProps) {
  return (
    <Svg className={className}>
      <path d="M3 5h18v11H3z" />
      <path d="M8 20h8M12 16v4" />
    </Svg>
  )
}

export function IconoEntrada({ className }: IconoProps) {
  return (
    <Svg className={className}>
      <path d="M3 9V6h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4Z" />
      <path d="M12 6v10" strokeDasharray="2 2" />
    </Svg>
  )
}

export function IconoFlecha({ className }: IconoProps) {
  return (
    <Svg className={className}>
      <path d="M5 12h13M13 6l6 6-6 6" />
    </Svg>
  )
}
