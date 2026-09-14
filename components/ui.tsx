'use client'

import clsx from 'clsx'
import { m, useMotionValue, useSpring, useTransform, useReducedMotion } from 'motion/react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { Deliverability, Tier } from '@/lib/types'
import { spring } from '@/lib/motion'
import { STATUS_ICON } from './charts'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'accent' | 'outline' | 'quiet'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'outline', size = 'md', className, ...props }: ButtonProps) {
  return (
    <m.button
      whileTap={props.disabled ? undefined : { scale: 0.97 }}
      transition={spring}
      {...(props as React.ComponentProps<typeof m.button>)}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium',
        'transition-[background-color,border-color,color,box-shadow] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'px-2.5 py-1.5 text-[12.5px]' : 'px-3.5 py-2 text-[13.5px]',
        variant === 'accent' && 'bg-accent text-white shadow-[0_1px_2px_rgba(16,19,26,0.16)] hover:bg-accent-hi',
        variant === 'outline' && 'border border-line bg-surface text-ink hover:border-faint',
        variant === 'quiet' && 'text-muted hover:bg-line-soft hover:text-ink',
        className,
      )}
    />
  )
}

const STATUS_TONE: Record<Deliverability, string> = {
  deliverable: 'bg-clear-wash text-clear',
  risky: 'bg-hold-wash text-hold',
  undeliverable: 'bg-dead-wash text-dead',
  unknown: 'bg-idle-wash text-idle',
}

export function StatusPill({ status, muted = false }: { status: Deliverability; muted?: boolean }) {
  const Icon = STATUS_ICON[status]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium capitalize',
        STATUS_TONE[status],
        muted && 'opacity-55',
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {status}
    </span>
  )
}

const TIER_TONE: Record<Tier, string> = {
  A: 'bg-clear text-white',
  B: 'bg-accent-wash text-accent',
  C: 'bg-hold-wash text-hold',
  D: 'bg-idle-wash text-idle',
}

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span className={clsx('fig inline-flex h-5 w-5 items-center justify-center rounded-md text-[11.5px] font-semibold', TIER_TONE[tier])}>
      {tier}
    </span>
  )
}

export function Counter({ value, format }: { value: number; format: (n: number) => string }) {
  const reduce = useReducedMotion()
  const raw = useMotionValue(0)

  const springy = useSpring(raw, { stiffness: 260, damping: 34, mass: 0.35 })
  const text = useTransform(springy, (v) => format(Math.round(v)))

  useEffect(() => {
    if (reduce) { raw.jump(value); return }
    raw.set(0)
    const t = setTimeout(() => raw.set(value), 60)
    return () => clearTimeout(t)
  }, [value, raw, reduce])

  if (reduce) return <>{format(value)}</>
  return <m.span>{text}</m.span>
}

export function Stat({ value, label, tone }: { value: ReactNode; label: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className={clsx('fig text-[27px] font-semibold leading-none tracking-[-0.02em]', tone ?? 'text-ink')}>
        {value}
      </div>
      <div className="mt-2 text-[12.5px] leading-snug text-muted">{label}</div>
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx('animate-spin', className)} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
