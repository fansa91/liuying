import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface VodSource {
  id: string
  name: string
  /** AppleCMS 采集接口地址, e.g. https://example.com/api.php/provide/vod */
  api: string
  timeoutMs?: number
}

const SOURCES_PATH = process.env.SOURCES_PATH ?? resolve(process.cwd(), 'sources.json')

function readFile(): VodSource[] {
  if (!existsSync(SOURCES_PATH)) return []
  try {
    const raw = JSON.parse(readFileSync(SOURCES_PATH, 'utf-8'))
    const list: VodSource[] = Array.isArray(raw) ? raw : (raw.sources ?? [])
    return list.filter((s) => s && s.id && s.api)
  } catch {
    return []
  }
}

/** 内存 + sources.json 双写的源仓库, web 端增删改都走这里 */
class SourceStore {
  private list: VodSource[] = readFile()

  all(): VodSource[] {
    return this.list
  }
  get(id: string): VodSource | undefined {
    return this.list.find((s) => s.id === id)
  }
  upsert(s: VodSource): void {
    const i = this.list.findIndex((x) => x.id === s.id)
    if (i >= 0) this.list[i] = s
    else this.list.push(s)
    this.save()
  }
  remove(id: string): boolean {
    const i = this.list.findIndex((x) => x.id === id)
    if (i < 0) return false
    this.list.splice(i, 1)
    this.save()
    return true
  }
  private save(): void {
    writeFileSync(SOURCES_PATH, JSON.stringify(this.list, null, 2) + '\n')
  }
}

export const store = new SourceStore()
