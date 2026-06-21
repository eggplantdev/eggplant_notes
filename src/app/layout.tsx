import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'

// Build-time env gate: importing these runs their Zod parse, failing the build on a missing/bad var.
import '@/lib/env'
import '@/lib/env.server'
import { ActionToast } from '@/components/action-toast'
import { ToastProvider } from '@/components/toast-provider'
import { BRAND_DARK } from '@/components/brand/brand-colors'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'eggplant_notes',
  description: 'AI powered notes with spaced-repetition recall cards.',
  // Tells iOS Safari to launch "Add to Home Screen" standalone (no browser chrome) and emits the
  // apple-mobile-web-app-* meta. The manifest covers this for Android/Chrome; iOS needs it here.
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Eggplant' },
}

export const viewport: Viewport = {
  themeColor: BRAND_DARK,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      // Inline so the browser paints brand-dark from the FIRST frame, before globals.css loads. The
      // `.dark { color-scheme; --background }` rules are render-blocking but still resolve a beat after
      // the HTML — in that gap the UA paints its default WHITE canvas (the intro flash). Setting both
      // here, in the initial markup, removes that pre-stylesheet white frame and inter-page blanks.
      style={{ colorScheme: 'dark', backgroundColor: BRAND_DARK }}
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Suspense fallback={null}>
          <ActionToast />
        </Suspense>
        <ToastProvider />
      </body>
    </html>
  )
}
