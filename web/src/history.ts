export interface HistoryItem {
  source: string
  sourceName: string
  id: string
  name: string
  pic: string
  remarks: string
  groupIndex: number
  groupName: string
  episodeIndex: number
  episodeName: string
  /** 秒, 该集内的播放进度 */
  position: number
  updatedAt: number
}

const KEY = 'liuying-history'
const MAX = 100

export function getHistory(): HistoryItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function findHistory(source: string, id: string): HistoryItem | undefined {
  return getHistory().find((h) => h.source === source && h.id === id)
}

/** 新增或更新一条记录 (按 source+id 去重, 置顶, 最多保留 MAX 条) */
export function saveHistory(item: HistoryItem): void {
  const list = getHistory().filter((h) => !(h.source === item.source && h.id === item.id))
  list.unshift(item)
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* ignore */
  }
}

export function removeHistory(source: string, id: string): void {
  const list = getHistory().filter((h) => !(h.source === source && h.id === id))
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return '刚刚'
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`
  if (s < 86400 * 2) return '昨天'
  const d = new Date(ts)
  return `${d.getMonth() + 1}-${d.getDate()}`
}
