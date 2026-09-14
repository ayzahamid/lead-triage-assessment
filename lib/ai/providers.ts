export type ProviderId = 'gemini' | 'opencode-go'
export type Protocol = 'google' | 'openai'

export interface Provider {
  id: ProviderId
  label: string
  protocol: Protocol

  consoleUrl: string
  keyHint: string

  modelsUrl: string
  modelsNeedKey: boolean
  chatUrl: (model: string) => string
  defaultModel: string

  excludes: RegExp
  note: string

  extraHeaders?: (sessionId: string) => Record<string, string>
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    protocol: 'google',
    consoleUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza… or AQ.…',
    modelsUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    modelsNeedKey: true,
    chatUrl: (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
    defaultModel: 'gemini-3.6-flash',

    excludes: /(image|tts|audio|embedding|aqa|vision|veo|imagen|transcribe|speech|live|native|robotics|computer-use|guard)/i,
    note: 'Free tier, no card. 28 models including Flash and Pro.',
  },

  'opencode-go': {
    id: 'opencode-go',
    label: 'OpenCode Go',
    protocol: 'openai',
    consoleUrl: 'https://opencode.ai/docs/go/',
    keyHint: 'Your OpenCode Go key',
    modelsUrl: 'https://opencode.ai/zen/go/v1/models',
    modelsNeedKey: false,
    chatUrl: () => 'https://opencode.ai/zen/go/v1/chat/completions',
    defaultModel: 'deepseek-v4-flash',
    excludes: /(vision|image|embed|tts|audio|transcribe|guard|omni)/i,
    note: 'Fixed subscription. 35 models including Kimi, DeepSeek and Qwen.',

    extraHeaders: (sessionId) => ({ 'x-opencode-session': sessionId }),
  },
}

export const DEFAULT_PROVIDER: ProviderId = 'gemini'

export function isProviderId(value: string | null | undefined): value is ProviderId {
  return value === 'gemini' || value === 'opencode-go'
}

export interface ModelOption {
  id: string

  family: string
}

export function familyOf(id: string): string {
  const head = id.split(/[-.\d]/)[0]
  return head && head.length > 1 ? head : id
}

export function rankModel(id: string): number {
  let score = 0

  if (/(mini|flash|lite|haiku|nano|small)/i.test(id)) score -= 3

  if (/free/i.test(id)) score += 1
  if (/(contributor|preview|exp|codex)/i.test(id)) score += 2
  if (/(pro|opus|ultra|max|astra|sol|terra)/i.test(id)) score += 3
  return score
}
