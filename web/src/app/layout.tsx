import type { Metadata, Viewport } from 'next'
import { Hind_Siliguri } from 'next/font/google'
import type { ReactNode } from 'react'
import { AppProvider } from '@/lib/app'
import './globals.css'

const bangla = Hind_Siliguri({ subsets: ['bengali', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-bangla', display: 'swap' })

export const metadata: Metadata = {
  title: 'AgriNest',
  description: 'আপনার জমি, ফসল আর কৃষি কর্মকর্তা, এক ম্যাপে।',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg' },
  appleWebApp: { capable: true, title: 'AgriNest', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f1f1f1' },
    { media: '(prefers-color-scheme: dark)', color: '#141919' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn" className={bangla.variable}>
      <body><AppProvider>{children}</AppProvider></body>
    </html>
  )
}
