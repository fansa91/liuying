export interface SourceInfo {
  id: string
  name: string
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
}
