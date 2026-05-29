import type { Metadata } from 'next'
import { Inter, Anton, Saira_Condensed } from 'next/font/google'
import './globals.css'
import PwaInit from '@/components/PwaInit'

const inter = Inter({ subsets: ['latin'] })
const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
})
const saira = Saira_Condensed({
  subsets: ['latin'],
  weight: ['500', '700', '900'],
  variable: '--font-saira',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MyAlbum 2026 — Hacé tu sticker del Mundial',
  description:
    'Subí tu foto, la IA quita el fondo y vos elegís tu plantilla del Mundial 2026. 100% en el navegador, sin servidores.',
  manifest: '/manifest.json',
  themeColor: '#3D2761',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MyAlbum',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body
        className={`${inter.className} ${anton.variable} ${saira.variable} bg-mundial-cream min-h-screen text-mundial-purple antialiased`}
      >
        <PwaInit />
        {children}
      </body>
    </html>
  )
}
