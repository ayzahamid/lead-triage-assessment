import { DEFAULT_ICP } from './types'

export interface IcpPrefs {
  employeesMin: number
  employeesMax: number
  targetIndustries: string[]
}

const KEY = 'lead-triage-icp'

export const DEFAULT_PREFS: IcpPrefs = {
  employeesMin: DEFAULT_ICP.employeesMin,
  employeesMax: DEFAULT_ICP.employeesMax,
  targetIndustries: DEFAULT_ICP.targetIndustries,
}

export const SUGGESTED_INDUSTRIES = [
  'Logistics', 'Manufacturing', 'Healthcare', 'Construction', 'Facilities Management',
  'Automotive', 'Food & Beverage', 'Industrial Services', 'Professional Services',
  'Wholesale Distribution',
]

const clampSize = (n: number, fallback: number): number =>
  Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n) : fallback

export function readIcp(): IcpPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<IcpPrefs>
    const min = clampSize(Number(parsed.employeesMin), DEFAULT_PREFS.employeesMin)
    const max = clampSize(Number(parsed.employeesMax), DEFAULT_PREFS.employeesMax)
    return {

      employeesMin: Math.min(min, max),
      employeesMax: Math.max(min, max),
      targetIndustries: Array.isArray(parsed.targetIndustries)
        ? parsed.targetIndustries.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 12)
        : [],
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function writeIcp(prefs: IcpPrefs): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {

  }
}

export function icpParams(prefs: IcpPrefs): URLSearchParams {
  const p = new URLSearchParams()
  p.set('min', String(prefs.employeesMin))
  p.set('max', String(prefs.employeesMax))
  if (prefs.targetIndustries.length) p.set('industries', prefs.targetIndustries.join(','))
  return p
}

export const isDefaultIcp = (p: IcpPrefs): boolean =>
  p.employeesMin === DEFAULT_PREFS.employeesMin &&
  p.employeesMax === DEFAULT_PREFS.employeesMax &&
  p.targetIndustries.length === 0

export function describePrefs(p: IcpPrefs): string {
  const size = `${p.employeesMin}–${p.employeesMax} staff`
  if (!p.targetIndustries.length) return `${size}, any industry`
  if (p.targetIndustries.length === 1) return `${size}, ${p.targetIndustries[0]}`
  return `${size}, ${p.targetIndustries.length} industries`
}
