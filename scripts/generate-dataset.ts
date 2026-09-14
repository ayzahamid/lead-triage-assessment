import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = resolve(process.cwd(), 'public/sample-leads.csv')
const COUNT = Number(process.argv[2] ?? 500)

let seed = 20260911
const rnd = (): number => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!
const chance = (p: number): boolean => rnd() < p

const LIVE_DOMAINS = [
  'stripe.com', 'shopify.com', 'hubspot.com', 'atlassian.com', 'zendesk.com',
  'twilio.com', 'cloudflare.com', 'datadoghq.com', 'squarespace.com', 'mailchimp.com',
  'asana.com', 'notion.so', 'figma.com', 'gitlab.com', 'digitalocean.com',
  'godaddy.com', 'wix.com', 'intuit.com', 'salesforce.com', 'zoominfo.com',
]

const DEAD_DOMAINS = [
  'northwind-freight-co.example', 'acme-hvac-services.invalid',
  'pinnacle-dental-grp.example', 'summit-logistics-llc.invalid',
]
const FREE_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com']
const DISPOSABLE = ['mailinator.com', 'yopmail.com', 'guerrillamail.com']
const ROLE_PARTS = ['info', 'sales', 'support', 'admin', 'contact', 'hello', 'accounts']

const FIRST = ['James','Maria','David','Sarah','Michael','Linda','Robert','Priya','Daniel','Aisha','Thomas','Grace','Kevin','Elena','Marcus','Nina','Paul','Rachel','Omar','Claire']
const LAST = ['Whitfield','Okonkwo','Rasmussen','Delgado','Hartley','Nakamura','Bergstrom','Vasquez','Ferreira','Lindqvist','Mbeki','Kowalski','Ahmed','Sorensen','Petrov','Gallagher','Ibrahim','Novak','Silva','Chen']
const COMPANY_A = ['Northwind','Summit','Pinnacle','Ironclad','Blue Ridge','Cornerstone','Redwood','Harbor','Kestrel','Meridian','Granite','Copperline','Foxglove','Silverbrook','Tidewater']
const COMPANY_B = ['Logistics','Manufacturing','Dental Group','HVAC Services','Freight','Industrial','Health Partners','Automotive','Packaging','Fabrication','Plumbing','Electrical','Machining','Distribution','Facilities']

const TITLES_SENIOR = ['Owner','Founder','Co-Founder','Chief Executive Officer','President','Managing Director','CFO','COO','General Manager']
const TITLES_MID = ['VP of Operations','Vice President, Finance','Director of IT','Director of Operations','Head of Procurement','Plant Manager','Operations Manager']
const TITLES_JUNIOR = ['Operations Analyst','Sales Representative','Marketing Coordinator','Intern','Executive Assistant','Junior Accountant','Field Technician']

const INDUSTRIES = ['Logistics','Manufacturing','Healthcare','Construction','Facilities Management','Automotive','Food & Beverage','Industrial Services','Professional Services','Wholesale Distribution']
const CITIES = ['Columbus, OH','Dallas, TX','Tampa, FL','Phoenix, AZ','Charlotte, NC','Indianapolis, IN','Kansas City, MO','Nashville, TN','Salt Lake City, UT','Richmond, VA']

const esc = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

interface Row { [k: string]: string }

function buildRow(i: number): Row {
  const first = pick(FIRST)
  const last = pick(LAST)
  const company = `${pick(COMPANY_A)} ${pick(COMPANY_B)}`

  const title = chance(0.42) ? pick(TITLES_SENIOR) : chance(0.62) ? pick(TITLES_MID) : pick(TITLES_JUNIOR)

  const employees = chance(0.12) ? Math.floor(rnd() * 9) + 1
    : chance(0.70) ? Math.floor(rnd() * 240) + 10
    : Math.floor(rnd() * 9000) + 251

  const revPerHead = 100_000 + Math.floor(rnd() * 200_000)
  const revenue = chance(0.18) ? '' : `$${(employees * revPerHead).toLocaleString('en-US')}`

  const roll = rnd()
  let email: string, domain: string
  if (roll < 0.52) {
    domain = pick(LIVE_DOMAINS)
    email = `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`
  } else if (roll < 0.66) {
    domain = pick(LIVE_DOMAINS)
    email = `${pick(ROLE_PARTS)}@${domain}`
  } else if (roll < 0.78) {
    domain = pick(FREE_DOMAINS)
    email = `${first.toLowerCase()}${last.toLowerCase()}${Math.floor(rnd() * 90) + 10}@${domain}`
  } else if (roll < 0.88) {
    domain = pick(DEAD_DOMAINS)
    email = `${first.toLowerCase()}@${domain}`
  } else if (roll < 0.93) {
    domain = pick(DISPOSABLE)
    email = `${first.toLowerCase()}${Math.floor(rnd() * 900)}@${domain}`
  } else if (roll < 0.96) {
    domain = pick(LIVE_DOMAINS)
    email = `${first.toLowerCase()}.${last.toLowerCase()}@@${domain}`
  } else {
    domain = pick(LIVE_DOMAINS)
    email = ''
  }

  return {
    'Company Name': company,
    'Contact Name': chance(0.05) ? '' : `${first} ${last}`,
    'Job Title': chance(0.08) ? '' : title,
    'Work Email': email,
    'Website': `https://www.${domain}`,
    'Industry': chance(0.07) ? '' : pick(INDUSTRIES),
    'Employee Count': chance(0.10) ? '' : String(employees),
    'Annual Revenue': revenue,
    'Location': pick(CITIES),
    'LinkedIn URL': chance(0.35) ? '' : `https://linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}-${i}`,
    'Phone': chance(0.4) ? '' : `+1 ${Math.floor(rnd() * 800) + 200}-${Math.floor(rnd() * 900) + 100}-${Math.floor(rnd() * 9000) + 1000}`,
  }
}

const rows: Row[] = []
for (let i = 1; i <= COUNT; i++) {
  rows.push(buildRow(i))

  if (chance(0.06) && rows.length > 1) rows.push({ ...rows[rows.length - 1]! })
}

const headers = Object.keys(rows[0]!)
const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h] ?? '')).join(','))].join('\n')

mkdirSync(resolve(process.cwd(), 'data'), { recursive: true })
writeFileSync(OUT, csv, 'utf8')
console.log(`Wrote ${rows.length} rows to ${OUT}`)
