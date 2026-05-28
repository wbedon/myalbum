'use client'

const COLORS = [
  '#7C3AED', // purple
  '#2563EB', // blue
  '#059669', // green
  '#D97706', // amber
  '#DC2626', // red
  '#0891B2', // cyan
  '#65A30D', // lime
  '#DB2777', // pink
  '#EA580C', // orange
  '#0284C7', // sky
]

export function avatarColor(username: string): string {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) & 0x7fffffff
  }
  return COLORS[hash % COLORS.length]
}

const SIZES = {
  xs:  { container: 'w-6  h-6',  text: 'text-[10px]' },
  sm:  { container: 'w-8  h-8',  text: 'text-sm'     },
  md:  { container: 'w-10 h-10', text: 'text-base'   },
  lg:  { container: 'w-14 h-14', text: 'text-xl'     },
  xl:  { container: 'w-20 h-20', text: 'text-3xl'    },
}

interface Props {
  username: string
  size?: keyof typeof SIZES
  className?: string
}

export default function Avatar({ username, size = 'sm', className = '' }: Props) {
  const { container, text } = SIZES[size]
  const color   = avatarColor(username)
  const initial = (username[0] ?? '?').toUpperCase()
  return (
    <div
      className={`${container} rounded-full flex items-center justify-center font-bold shrink-0 ${text} ${className}`}
      style={{ backgroundColor: color, color: '#fff' }}
    >
      {initial}
    </div>
  )
}
