import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { loadSources, type VodSource } from './sources.js'

const app = new Hono()
app.use('/api/*', cors())

const sources = loadSources()
const byId = new Map(sources.map((s) => [s.id, s]))

async function fetchJson(source: VodSource, params: Record<string, string>): Promise<any> {
  const u = new URL(source.api)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), source.timeoutMs ?? 15000)
  try {
    const r = await fetch(u, { signal: ctrl.signal, headers: { 'User-Agent': 'LiuYing/0.1' } })
    if (!r.ok) throw new Error(`upstream ${r.status}`)
    return await r.json()
  } finally {
    clearTimeout(t)
  }
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

function normVideo(s: VodSource, v: any): VideoItem {
  return {
    source: s.id,
    sourceName: s.name,
    id: String(v.vod_id ?? ''),
    name: v.vod_name ?? '',
    pic: v.vod_pic ?? '',
    remarks: v.vod_remarks ?? '',
    year: String(v.vod_year ?? ''),
    type: v.type_name ?? '',
  }
}

/** 源列表 */
app.get('/api/sources', (c) => c.json(sources.map((s) => ({ id: s.id, name: s.name }))))

/** 每个源的分类 (缓存 1 小时) */
const typeCache = new Map<string, { at: number; data: { id: string; name: string }[] }>()
app.get('/api/types', async (c) => {
  const s = byId.get(c.req.query('source') ?? '')
  if (!s) return c.json({ error: 'unknown source' }, 400)
  const hit = typeCache.get(s.id)
  if (hit && Date.now() - hit.at < 3600_000) return c.json(hit.data)
  const data = await fetchJson(s, { ac: 'list' })
  const list = (data.class ?? []).map((t: any) => ({ id: String(t.type_id), name: t.type_name }))
  typeCache.set(s.id, { at: Date.now(), data: list })
  return c.json(list)
})

/** 按分类取影片列表 */
app.get('/api/list', async (c) => {
  const s = byId.get(c.req.query('source') ?? '')
  if (!s) return c.json({ error: 'unknown source' }, 400)
  const t = c.req.query('t') ?? ''
  const pg = c.req.query('pg') ?? '1'
  const data = await fetchJson(s, { ac: 'videolist', t, pg })
  return c.json({
    page: Number(data.page ?? pg),
    pagecount: Number(data.pagecount ?? 1),
    total: Number(data.total ?? 0),
    list: (data.list ?? []).map((v: any) => normVideo(s, v)),
  })
})

/** 聚合搜索: 不传 sources = 搜全部源, 传 sources=a,b = 只搜指定源 */
app.get('/api/search', async (c) => {
  const wd = (c.req.query('wd') ?? '').trim()
  if (!wd) return c.json([])
  const ids = (c.req.query('sources') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  const targets = (ids.length ? ids.map((id) => byId.get(id)) : [...byId.values()]).filter(
    (s): s is VodSource => !!s,
  )
  const settled = await Promise.allSettled(
    targets.map(async (s) => {
      const data = await fetchJson(s, { ac: 'videolist', wd, pg: '1' })
      return (data.list ?? []).map((v: any) => normVideo(s, v))
    }),
  )
  const out: VideoItem[] = []
  for (const r of settled) if (r.status === 'fulfilled') out.push(...r.value)
  return c.json(out)
})

/** 详情 + 播放地址解析 (vod_play_url 按 $$$ 分线路, # 分集, $ 分隔集名和地址) */
app.get('/api/detail', async (c) => {
  const s = byId.get(c.req.query('source') ?? '')
  const ids = c.req.query('ids') ?? ''
  if (!s || !ids) return c.json({ error: 'bad request' }, 400)
  const data = await fetchJson(s, { ac: 'videolist', ids })
  const v = (data.list ?? [])[0]
  if (!v) return c.json({ error: 'not found' }, 404)
  const groups = String(v.vod_play_url ?? '').split('$$$')
  const froms = String(v.vod_play_from ?? '').split('$$$')
  const plays = groups.map((g, i) => ({
    from: froms[i] || `线路${i + 1}`,
    episodes: g
      .split('#')
      .map((e) => {
        const idx = e.lastIndexOf('$')
        return idx > 0 ? { name: e.slice(0, idx), url: e.slice(idx + 1) } : { name: e, url: e }
      })
      .filter((e) => e.url),
  }))
  return c.json({ ...normVideo(s, v), content: v.vod_content ?? '', plays })
})

/**
 * 通用代理: 解决播放时的跨域 / 防盗链。
 * m3u8 会被重写, 分片地址指回本代理, 浏览器只需访问同源。
 */
const proxied = (u: string) => `/api/proxy?url=${encodeURIComponent(u)}`

app.get('/api/proxy', async (c) => {
  const raw = c.req.query('url') ?? ''
  let target: URL
  try {
    target = new URL(raw)
    if (!/^https?:$/.test(target.protocol)) throw new Error('bad protocol')
  } catch {
    return c.text('bad url', 400)
  }
  const upstream = await fetch(target, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
  })
  const headers = new Headers()
  const ct = upstream.headers.get('content-type') ?? ''
  if (ct) headers.set('content-type', ct)
  headers.set('Access-Control-Allow-Origin', '*')
  if (/mpegurl/i.test(ct) || /\.m3u8($|\?)/i.test(target.pathname)) {
    const text = await upstream.text()
    const abs = (u: string) => new URL(u, target).toString()
    const body = text
      .split('\n')
      .map((line) => {
        const t = line.trim()
        if (!t) return line
        if (t.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${proxied(abs(u))}"`)
        return proxied(abs(t))
      })
      .join('\n')
    headers.set('content-type', 'application/vnd.apple.mpegurl')
    return new Response(body, { status: upstream.status, headers })
  }
  return new Response(upstream.body, { status: upstream.status, headers })
})

app.get('/api/health', (c) => c.json({ ok: true, sources: sources.length }))

const port = Number(process.env.PORT ?? 3000)
console.log(`[liuying] api listening on :${port}, ${sources.length} sources`)
serve({ fetch: app.fetch, port })
