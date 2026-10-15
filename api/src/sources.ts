import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface VodSource {
  id: string
  name: string
  /** AppleCMS 采集接口地址, e.g. https://example.com/api.php/provide/vod */
  api: string
  timeoutMs?: number
}

export function loadSources(): VodSource[] {
  const p = process.env.SOURCES_PATH ?? resolve(process.cwd(), 'sources.json')
  if (!existsSync(p)) {
    console.warn(`[liuying] sources.json not found at ${p}, starting with an empty source list`)
    return []
  }
  const raw = JSON.parse(readFileSync(p, 'utf-8'))
  const list: VodSource[] = Array.isArray(raw) ? raw : (raw.sources ?? [])
  return list
    .filter((s) => s && s.id && s.api)
    .map((s) => ({ timeoutMs: 15000, ...s }))
}
