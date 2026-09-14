const KEY = 'lead-workspace-id'

export function getWorkspaceId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const existing = window.localStorage.getItem(KEY)
    if (existing) return existing
    const id = `ws_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
    window.localStorage.setItem(KEY, id)
    return id
  } catch {

    return `ws_session_${Math.random().toString(36).slice(2, 10)}`
  }
}
