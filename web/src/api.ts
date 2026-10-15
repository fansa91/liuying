export interface SourceInfo {
  id: string
  name: string
  api?: string
}
export interface VodType {
  id: string
  name: string
}
export interface VideoItem {
  source: string
  sourceName: string
  id: string
  name: string
  pic: string
  remarks: string
  year: string
  type: string
}
export interface Episode {
  name: string
  url: string
}
export interface PlayGroup {
  from: string
  episodes: Episode[]
}
export interface VideoDetail extends VideoItem {
  content: string
  plays: PlayGroup[]
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`/api${path}`)
  if (!r.ok) throw new Error(`请求失败: ${r.status}`)
  return r.json()
}

function adminHeaders(): HeadersInit {
  const t = localStorage.getItem('liuying-admin-token') ?? ''
  return t ? { 'x-admin-token': t } : {}
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...adminHeaders(), ...(init?.headers ?? {}) },
  })
  if (!r.ok) {
    const body = await r.json().catch(() => null)
    throw new Error(body?.error ?? `请求失败: ${r.status}`)
  }
  return r.json()
}

export const adminToken = {
  get: () => localStorage.getItem('liuying-admin-token') ?? '',
  set: (t: string) => {
    if (t) localStorage.setItem('liuying-admin-token', t)
    else localStorage.removeItem('liuying-admin-token')
  },
}

export const api = {
  sources: () => get<SourceInfo[]>('/sources'),
  types: (source: string) => get<VodType[]>(`/types?source=${encodeURIComponent(source)}`),
  list: (source: string, t: string, pg = 1) =>
    get<{ page: number; pagecount: number; total: number; list: VideoItem[] }>(
      `/list?source=${encodeURIComponent(source)}&t=${encodeURIComponent(t)}&pg=${pg}`,
    ),
  search: (wd: string, sources: string[]) =>
    get<VideoItem[]>(
      `/search?wd=${encodeURIComponent(wd)}&sources=${sources.map(encodeURIComponent).join(',')}`,
    ),
  detail: (source: string, id: string) =>
    get<VideoDetail>(`/detail?source=${encodeURIComponent(source)}&ids=${encodeURIComponent(id)}`),
  /** 走服务器代理的播放地址 (解决跨域 / 防盗链) */
  proxied: (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`,
  // 源管理 (写操作)
  addSource: (name: string, api: string) =>
    req<{ id: string; name: string }>('/sources', {
      method: 'POST',
      body: JSON.stringify({ name, api }),
    }),
  updateSource: (id: string, name: string, api: string) =>
    req<{ id: string; name: string }>(`/sources/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ name, api }),
    }),
  deleteSource: (id: string) =>
    req<{ ok: boolean }>(`/sources/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  testSource: (api: string) =>
    req<{ ok: boolean; types?: number; error?: string }>('/sources/test', {
      method: 'POST',
      body: JSON.stringify({ api }),
    }),
}
