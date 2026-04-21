import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'La Force et la Douleur · Pablo',
  description: 'Seguimiento de entrenamiento y peso',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
