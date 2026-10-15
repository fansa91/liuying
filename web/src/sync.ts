import { watch } from 'vue'
import { clearToken, getToken } from './auth'
import { getHistory, mergeHistoryItem } from './history'
import { getSettingsTs, setSettingsTs, settings } from './settings'

const LS_PUSH = 'liuying-last-push'
const LS_PULL = 'liuying-last-pull'

let lastPushAt = Number(localStorage.getItem(LS_PUSH) ?? 0)
let lastPullAt = Number(localStorage.getItem(LS_PULL) ?? 0)
let pushTimer: ReturnType<typeof setTimeout> | null = null
let applyingRemote = false

function persist() {
  try {
    localStorage.setItem(LS_PUSH, String(lastPushAt))
    localStorage.setItem(LS_PULL, String(lastPullAt))
  } catch {
    /* ignore */
  }
}

export function getLastSyncAt(): number {
  return Math.max(lastPushAt, lastPullAt)
}

async function authed(path: string, init?: RequestInit): Promise<any> {
  const r = await fetch(`/api${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (r.status === 401) {
    clearToken()
    throw new Error('登录已过期, 请重新登录')
  }
  if (!r.ok) throw new Error(`同步失败: ${r.status}`)
  return r.json()
}

/** 本地有改动时调用, 防抖 2s 后同步 */
export function queueSync(): void {
  if (!getToken()) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    syncNow().catch(() => {})
  }, 2000)
}

export async function syncNow(): Promise<void> {
  if (!getToken()) return
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  // 先拉后推: 新设备登录时先拿到云端数据, 本地匿名历史再合并上去
  await pull()
  await push()
}

async function push(): Promise<void> {
  const history = getHistory()
    .filter((h) => h.updatedAt > lastPushAt)
    .map((h) => ({
      source: h.source,
      video_id: h.id,
      data: JSON.stringify(h),
      updated_at: h.updatedAt,
    }))
  const settingsTs = getSettingsTs()
  const body: any = {}
  if (history.length) body.history = history
  if (settingsTs > lastPushAt) {
    body.settings = { data: JSON.stringify({ ...settings }), updated_at: settingsTs }
  }
  if (!body.history && !body.settings) return
  const j = await authed('/sync/push', { method: 'POST', body: JSON.stringify(body) })
  lastPushAt = Math.max(lastPushAt, j.serverTime)
  persist()
}

async function pull(): Promise<void> {
  const j = await authed(`/sync/pull?since=${lastPullAt}`)
  let historyChanged = false
  for (const it of j.history ?? []) {
    try {
      const h = JSON.parse(it.data)
      h.updatedAt = it.updated_at
      if (mergeHistoryItem(h)) historyChanged = true
    } catch {
      /* ignore */
    }
  }
  if (j.settings && j.settings.updated_at > getSettingsTs()) {
    applyingRemote = true
    try {
      Object.assign(settings, JSON.parse(j.settings.data))
      setSettingsTs(j.settings.updated_at)
    } finally {
      applyingRemote = false
    }
  }
  lastPullAt = Math.max(lastPullAt, j.serverTime)
  persist()
  if (historyChanged) window.dispatchEvent(new CustomEvent('liuying-history-changed'))
}

/** 应用启动时调用一次: 监听设置变化自动推, 启动/每5分钟/回前台自动拉 */
export function initSync(): void {
  watch(
    settings,
    () => {
      if (applyingRemote) return
      setSettingsTs(Date.now())
      queueSync()
    },
    { deep: true },
  )
  if (!getToken()) return
  syncNow().catch(() => {})
  setInterval(() => {
    pull().catch(() => {})
  }, 5 * 60 * 1000)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pull().catch(() => {})
  })
}
