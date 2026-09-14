'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { m } from 'motion/react'
import { KeyRound, ListChecks, Mail, Menu, Moon, PanelLeftClose, PanelLeftOpen, ShieldCheck, Sun, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fmtInt } from '@/lib/format'
import { spring } from '@/lib/motion'
import { Button } from './ui'

interface Section { href: string; label: string; icon: LucideIcon; hint: string }

const SECTIONS: Section[] = [
  { href: '/', label: 'Triage', icon: ListChecks, hint: 'Verify, score and export your list' },
  { href: '/outreach', label: 'Outreach', icon: Mail, hint: 'Write the first email or message' },
  { href: '/validate', label: 'Validate', icon: ShieldCheck, hint: 'Check addresses without a file' },
]

export function AppShell({
  children,
  libraryCount,
  onOpenKey,
}: {
  children: ReactNode
  libraryCount?: number
  onOpenKey?: () => void
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(false)

  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    try { setCollapsed(localStorage.getItem('rail-collapsed') === '1') } catch {}
  }, [])
  useEffect(() => { setOpen(false) }, [pathname])

  const toggleCollapsed = (): void => {
    setCollapsed((was) => {
      const next = !was
      try { localStorage.setItem('rail-collapsed', next ? '1' : '0') } catch {}
      return next
    })
  }

  const toggleTheme = (): void => {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch {}
    setDark(next)
  }

  const rail = (mini: boolean): ReactNode => (
    <div className="flex h-full flex-col">
      <div className={`flex items-center gap-2 py-4 ${mini ? 'justify-center px-2' : 'px-4'}`}>
        <Link href="/" className="flex min-w-0 items-center gap-2" title={mini ? 'Lead Triage' : undefined}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-white">L</span>
          {mini ? null : <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">Lead Triage</span>}
        </Link>
      </div>

      <nav aria-label="Sections" className={`flex-1 ${mini ? 'px-2' : 'px-2'}`}>
        {SECTIONS.map(({ href, label, icon: Icon, hint }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}

              aria-label={mini ? label : undefined}
              title={mini ? `${label}: ${hint}` : undefined}
              className={`group relative flex rounded-lg transition-colors duration-150 ${
                mini ? 'items-center justify-center px-2 py-2.5' : 'items-start gap-2.5 px-2.5 py-2'
              } ${active ? 'bg-accent-wash text-ink' : 'text-muted hover:bg-line-soft hover:text-ink'}`}
            >
              {active ? (
                <m.span
                  layoutId="rail-active"
                  transition={spring}
                  className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent"
                  aria-hidden="true"
                />
              ) : null}
              <Icon className={`h-4 w-4 shrink-0 ${mini ? '' : 'mt-0.5'} ${active ? 'text-accent' : ''}`} aria-hidden="true" />
              {mini ? null : (
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{label}</span>
                  <span className="block text-[11px] leading-snug text-faint">{hint}</span>
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className={`space-y-2 border-t border-line py-3 ${mini ? 'px-2' : 'px-4'}`}>
        {typeof libraryCount === 'number' ? (
          mini ? (
            <p className="fig text-center text-[12px] font-semibold" title={`${fmtInt(libraryCount)} leads in your library`}>
              {fmtInt(libraryCount)}
            </p>
          ) : (
            <p className="flex items-baseline justify-between text-[12px] text-muted">
              <span>In your library</span>
              <span className="fig font-semibold text-ink">{fmtInt(libraryCount)}</span>
            </p>
          )
        ) : null}
        <div className={`flex items-center gap-1 ${mini ? 'flex-col' : ''}`}>
          {onOpenKey ? (
            <Button
              variant="quiet" size="sm" onClick={onOpenKey}
              aria-label={mini ? 'API key' : undefined}
              title={mini ? 'API key' : undefined}
              className={mini ? '' : 'flex-1 justify-start'}
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              {mini ? null : 'API key'}
            </Button>
          ) : null}
          <Button variant="quiet" size="sm" onClick={toggleTheme} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>
            {dark ? <Sun className="h-3.5 w-3.5" aria-hidden="true" /> : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-dvh">
      <m.aside
        animate={{ width: collapsed ? '3.75rem' : '13.5rem' }}
        transition={spring}
        className="hidden shrink-0 overflow-hidden border-r border-line bg-surface lg:block"
      >
        <div className="sticky top-0 flex h-dvh flex-col">
          <div className="min-h-0 flex-1">{rail(collapsed)}</div>
          <div className={`border-t border-line py-2 ${collapsed ? 'px-2' : 'px-3'}`}>
            <Button
              variant="quiet"
              size="sm"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={collapsed ? 'w-full justify-center' : 'w-full justify-start'}
            >
              {collapsed
                ? <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden="true" />
                : <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />}
              {collapsed ? null : 'Collapse'}
            </Button>
          </div>
        </div>
      </m.aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <m.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[var(--color-scrim)]"
          />
          <m.aside
            initial={{ x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={spring}
            className="relative h-full w-[15rem] border-r border-line bg-surface"
          >
            <Button
              variant="quiet" size="sm" aria-label="Close menu"
              className="absolute right-2 top-3" onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
            {rail(false)}
          </m.aside>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2 lg:hidden">
          <Button variant="quiet" size="sm" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="text-[13px] font-semibold">Lead Triage</span>
        </div>
        <main id="main">{children}</main>
      </div>
    </div>
  )
}
