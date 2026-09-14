import type { Metadata, Viewport } from 'next'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
import { MotionProvider } from '@/components/MotionProvider'
import './globals.css'

const archivo = Archivo({
  subsets: ['latin'],

  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo',
  display: 'swap',
})
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-plex-mono',
  display: 'swap',

  preload: false,
})

export const metadata: Metadata = {
  title: 'Lead Triage',
  description:
    'Verify deliverability and rank scraped B2B leads against your ideal customer profile before a bad list burns your sending domain.',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f5f3' },
    { media: '(prefers-color-scheme: dark)', color: '#161917' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-paper"
        >
          Skip to main content
        </a>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  )
}
