/**
 * Banderas SVG inline de las 3 sedes del Mundial 2026.
 * Diseñadas con detalles representativos (no réplicas oficiales) y
 * optimizadas como vectores ligeros (<1 KB cada una).
 */

interface FlagProps {
  className?: string
}

export function FlagUSA({ className = 'h-4 w-6' }: FlagProps) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-label="Estados Unidos">
      <rect width="30" height="20" fill="#B22234" />
      <g fill="#FFFFFF">
        <rect y="1.5" width="30" height="1.5" />
        <rect y="4.5" width="30" height="1.5" />
        <rect y="7.5" width="30" height="1.5" />
        <rect y="10.5" width="30" height="1.5" />
        <rect y="13.5" width="30" height="1.5" />
        <rect y="16.5" width="30" height="1.5" />
      </g>
      <rect width="12" height="10.5" fill="#3C3B6E" />
      <g fill="#FFFFFF">
        <circle cx="2.5" cy="2" r="0.4" />
        <circle cx="5.5" cy="2" r="0.4" />
        <circle cx="8.5" cy="2" r="0.4" />
        <circle cx="2.5" cy="5" r="0.4" />
        <circle cx="5.5" cy="5" r="0.4" />
        <circle cx="8.5" cy="5" r="0.4" />
        <circle cx="2.5" cy="8" r="0.4" />
        <circle cx="5.5" cy="8" r="0.4" />
        <circle cx="8.5" cy="8" r="0.4" />
      </g>
    </svg>
  )
}

export function FlagMexico({ className = 'h-4 w-6' }: FlagProps) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-label="México">
      <rect width="10" height="20" fill="#006847" />
      <rect x="10" width="10" height="20" fill="#FFFFFF" />
      <rect x="20" width="10" height="20" fill="#CE1126" />
      <circle cx="15" cy="10" r="2.5" fill="none" stroke="#8B4513" strokeWidth="0.4" />
      <path d="M 13 10 Q 15 8 17 10" fill="none" stroke="#006847" strokeWidth="0.4" />
    </svg>
  )
}

export function FlagCanada({ className = 'h-4 w-6' }: FlagProps) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-label="Canadá">
      <rect width="7.5" height="20" fill="#FF0000" />
      <rect x="7.5" width="15" height="20" fill="#FFFFFF" />
      <rect x="22.5" width="7.5" height="20" fill="#FF0000" />
      <path
        d="M 15 5
           L 15.5 7.5
           L 17.5 6.5
           L 17 8.5
           L 19 9
           L 17.5 10
           L 18 12
           L 16 11
           L 15 14
           L 14 11
           L 12 12
           L 12.5 10
           L 11 9
           L 13 8.5
           L 12.5 6.5
           L 14.5 7.5 Z"
        fill="#FF0000"
      />
    </svg>
  )
}
