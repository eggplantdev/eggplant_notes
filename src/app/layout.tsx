import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'

import { ActionToast } from '@/components/action-toast'
import { ToastProvider } from '@/components/toast-provider'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'eggplant_ai_notes',
  description: 'Markdown coding notes grouped into subjects, with spaced-repetition recall cards.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
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
