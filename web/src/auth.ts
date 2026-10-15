const KEY = 'liuying-token'

export const getToken = (): string => localStorage.getItem(KEY) ?? ''
export const setToken = (t: string): void => {
  localStorage.setItem(KEY, t)
}
export const clearToken = (): void => {
  localStorage.removeItem(KEY)
}
export const isLoggedIn = (): boolean => !!getToken()

async function authReq<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? `请求失败: ${r.status}`)
  return j as T
}

export const apiRegister = (username: string, password: string) =>
  authReq<{ token: string; username: string }>('/auth/register', { username, password })

export const apiLogin = (username: string, password: string) =>
  authReq<{ token: string; username: string }>('/auth/login', { username, password })

export async function apiLogout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
  } catch {
    /* ignore */
  }
  clearToken()
}
