import type { Metadata, Viewport } from 'next'
import { I18nProvider } from '../i18n/I18nProvider'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'AgriSathi — অ্যাগ্রিসাথী',
  description: 'বাংলায় আপনার AI কৃষি সহায়ক',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'AgriSathi' },
}

export const viewport: Viewport = {
  themeColor: '#f1f1f1',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  )
}
