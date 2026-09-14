export interface ProviderFingerprint {
  name: string
  patterns: RegExp[]
  catchAll: boolean
}

export const PROVIDERS: ProviderFingerprint[] = [
  { name: 'Google Workspace', patterns: [/aspmx\.l\.google\.com$/i, /googlemail\.com$/i, /google\.com$/i], catchAll: true },
  { name: 'Microsoft 365', patterns: [/\.mail\.protection\.outlook\.com$/i, /outlook\.com$/i], catchAll: true },
  { name: 'Proofpoint', patterns: [/pphosted\.com$/i, /ppe-hosted\.com$/i], catchAll: true },
  { name: 'Mimecast', patterns: [/mimecast\.com$/i], catchAll: true },
  { name: 'Barracuda', patterns: [/barracudanetworks\.com$/i, /ess\.barracuda\.com$/i], catchAll: true },
  { name: 'Cisco Ironport', patterns: [/iphmx\.com$/i], catchAll: true },
  { name: 'Zoho Mail', patterns: [/zoho\.com$/i, /zohomail\.com$/i], catchAll: false },
  { name: 'Fastmail', patterns: [/messagingengine\.com$/i], catchAll: false },
  { name: 'ProtonMail', patterns: [/protonmail\.ch$/i, /proton\.me$/i], catchAll: false },
  { name: 'Yandex', patterns: [/yandex\.net$/i], catchAll: false },
  { name: 'Rackspace', patterns: [/emailsrvr\.com$/i], catchAll: true },
  { name: 'GoDaddy', patterns: [/secureserver\.net$/i], catchAll: true },
  { name: 'Namecheap Private Email', patterns: [/privateemail\.com$/i], catchAll: true },
  { name: 'Amazon SES', patterns: [/amazonaws\.com$/i], catchAll: true },
  { name: 'Cloudflare Email Routing', patterns: [/mx\.cloudflare\.net$/i], catchAll: true },
]

export function fingerprintProvider(mxHosts: string[]): { provider: string | null; catchAll: boolean } {
  for (const host of mxHosts) {
    for (const p of PROVIDERS) {
      if (p.patterns.some((re) => re.test(host))) return { provider: p.name, catchAll: p.catchAll }
    }
  }

  return { provider: mxHosts.length ? 'Self-hosted / Other' : null, catchAll: false }
}

export const FREE_PROVIDER_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com',
  'live.com', 'msn.com', 'me.com', 'mac.com', 'gmx.com', 'gmx.net', 'mail.com',
  'yandex.ru', 'protonmail.com', 'proton.me', 'zoho.com', 'inbox.com', 'ymail.com',
])

export const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'temp-mail.org', '10minutemail.com', 'throwawaymail.com',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com', 'dispostable.com',
  'maildrop.cc', 'fakeinbox.com', 'tempmail.net', 'mohmal.com', 'emailondeck.com',
])

export const ROLE_LOCAL_PARTS = new Set([
  'info', 'sales', 'support', 'admin', 'contact', 'hello', 'help', 'office', 'team',
  'billing', 'accounts', 'accounting', 'careers', 'jobs', 'hr', 'marketing', 'press',
  'noreply', 'no-reply', 'donotreply', 'webmaster', 'postmaster', 'abuse', 'enquiries',
  'inquiries', 'general', 'mail', 'service', 'customerservice', 'orders',
])
