import type { Transition, Variants } from 'motion/react'

export const spring: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }
export const springSoft: Transition = { type: 'spring', stiffness: 260, damping: 30 }
export const ease: Transition = { duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }

export const stagger = (delayChildren = 0.04, staggerChildren = 0.03): Variants => ({
  initial: {},
  animate: { transition: { delayChildren, staggerChildren } },
})

export const riseItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: spring },
}

export const popItem: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: spring },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.12 } },
}

export const dialogIn: Variants = {
  initial: { opacity: 0, scale: 0.97, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0, transition: spring },
  exit: { opacity: 0, scale: 0.98, y: 6, transition: { duration: 0.14 } },
}

export const press = { whileTap: { scale: 0.97 }, transition: spring } as const
