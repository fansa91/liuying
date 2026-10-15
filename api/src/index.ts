import { randomUUID } from 'node:crypto'
import { serve } from '@hono/node-server'
import { Hono, type Context, type Next } from 'hono'
import { cors } from 'hono/cors'
import { createToken, createUser, getUserByToken, revokeToken, verifyUser } from './auth.js'
import { initDb, pool } from './db.js'
import { store, type VodSource } from './sources.js'

try {
  await initDb()
} catch (e: any) {
  console.error(
    `[liuying] MySQL 连接失败 (${process.env.DB_HOST ?? '127.0.0.1'}:${process.env.DB_PORT ?? 3306}): ${e.message}`,
  )
  console.error('[liuying] 请检查 MySQL 是否运行, 以及 DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME 环境变量')
  process.exit(1)
}

const app = new Hono<{ Variables: { userId?: string; username?: string } }>()
app.use('/api/*', cors())

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? ''

async function admin(c: Context, next: Next) {
  if (ADMIN_TOKEN && c.req.header('x-admin-token') !== ADMIN_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  await next()
}

/** 解析 Bearer token, 有效则注入 userId/username (可选鉴权, 匿名可过) */
async function authOptional(c: Context, next: Next) {
  const m = (c.req.header('authorization') ?? '').match(/^Bearer (.+)$/)
  if (m) {
    const u = await getUserByToken(m[1])
    if (u) {
      c.set('userId', u.id)
      c.set('username', u.username)
    }
  }
  await next()
}
app.use('/api/*', authOptional)

async function authRequired(c: Context, next: Next) {
  if (!c.get('userId')) return c.json({ error: 'unauthorized' }, 401)
  await next()
}

/** 源写操作: 登录用户改自己的列表, 未登录走 ADMIN_TOKEN */
async function sourceWrite(c: Context, next: Next) {
  if (c.get('userId')) {
    await next()
    return
  }
  await admin(c, next)
}

const userIdOf = (c: Context): string | undefined => c.get('userId')

// ---------------------------------------------------------------------------
// 源存储抽象: 登录用户走 user_sources 表 (天然多端一致), 未登录走全局 sources.json
// ---------------------------------------------------------------------------
interface UserSource {
  id: string
  name: string
  api: string
}

function sourceOps(userId?: string) {
  if (!userId) {
    return {
      list: async (): Promise<UserSource[]> => store.all(),
      get: async (id: string): Promise<UserSource | undefined> => store.get(id),
      upsert: async (s: UserSource): Promise<void> => {
        store.upsert({ ...s, timeoutMs: 15000 })
      },
      remove: async (id: string): Promise<boolean> => store.remove(id),
    }
  }
  return {
    list: async (): Promise<UserSource[]> => {
      const [rows] = await pool.execute(
        'SELECT source_id AS id, name, api FROM user_sources WHERE user_id = ? ORDER BY sort, id',
        [userId],
      )
      return rows as UserSource[]
    },
    get: async (id: string): Promise<UserSource | undefined> => {
      const [rows] = await pool.execute(
        'SELECT source_id AS id, name, api FROM user_sources WHERE user_id = ? AND source_id = ?',
        [userId, id],
      )
      return (rows as UserSource[])[0]
    },
    upsert: async (s: UserSource): Promise<void> => {
      const [rows] = await pool.execute(
        'SELECT id FROM user_sources WHERE user_id = ? AND source_id = ?',
        [userId, s.id],
      )
      const now = Date.now()
      if ((rows as any[]).length) {
        await pool.execute(
          'UPDATE user_sources SET name = ?, api = ?, updated_at = ? WHERE user_id = ? AND source_id = ?',
          [s.name, s.api, now, userId, s.id],
        )
      } else {
        const [m] = await pool.execute(
          'SELECT COALESCE(MAX(sort), -1) AS m FROM user_sources WHERE user_id = ?',
          [userId],
        )
        await pool.execute(
          'INSERT INTO user_sources(id, user_id, source_id, name, api, sort, updated_at) VALUES(?,?,?,?,?,?,?)',
          [randomUUID(), userId, s.id, s.name, s.api, (m as any[])[0].m + 1, now],
        )
      }
    },
    remove: async (id: string): Promise<boolean> => {
      const [r] = await pool.execute('DELETE FROM user_sources WHERE user_id = ? AND source_id = ?', [
        userId,
        id,
      ])
      return (r as any).affectedRows > 0
    },
  }
}

const toVod = (s: UserSource): VodSource => ({ ...s, timeoutMs: 15000 })

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

function normVideo(s: { id: string; name: string }, v: any): VideoItem {
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

// ---------------------------------------------------------------------------
// 账号
// ---------------------------------------------------------------------------
app.post('/api/auth/register', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  try {
    const u = await createUser(String(body.username ?? ''), String(body.password ?? ''))
    return c.json({ token: await createToken(u.id), username: u.username })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'register failed' }, 400)
  }
})

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  try {
    const u = await verifyUser(String(body.username ?? ''), String(body.password ?? ''))
    return c.json({ token: await createToken(u.id), username: u.username })
  } catch (e: any) {
    return c.json({ error: e.message ?? 'login failed' }, 400)
  }
})

app.post('/api/auth/logout', authRequired, async (c) => {
  const m = (c.req.header('authorization') ?? '').match(/^Bearer (.+)$/)
  if (m) await revokeToken(m[1])
  return c.json({ ok: true })
})

app.get('/api/auth/me', authRequired, (c) => c.json({ username: c.get('username') }))

// ---------------------------------------------------------------------------
// 同步: 历史 + 设置 (last-write-wins)。源列表存在服务端账号下, 天然一致, 不走同步。
// ---------------------------------------------------------------------------
app.get('/api/sync/pull', authRequired, async (c) => {
  const userId = userIdOf(c)!
  const since = Number(c.req.query('since') ?? 0)
  const [history] = await pool.execute(
    'SELECT source, video_id, data, updated_at FROM user_history WHERE user_id = ? AND updated_at > ? ORDER BY updated_at',
    [userId, since],
  )
  const [srows] = await pool.execute('SELECT data, updated_at FROM user_settings WHERE user_id = ?', [
    userId,
  ])
  const settings = (srows as any[])[0]
  return c.json({
    history,
    settings: settings && settings.updated_at > since ? settings : null,
    serverTime: Date.now(),
  })
})

app.post('/api/sync/push', authRequired, async (c) => {
  const userId = userIdOf(c)!
  const body = await c.req.json().catch(() => ({}))
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (const h of body.history ?? []) {
      if (!h.source || !h.video_id || !h.updated_at) continue
      const [rows] = await conn.execute(
        'SELECT updated_at FROM user_history WHERE user_id = ? AND source = ? AND video_id = ?',
        [userId, String(h.source), String(h.video_id)],
      )
      const cur = (rows as any[])[0]
      if (!cur || Number(h.updated_at) > cur.updated_at) {
        const data = String(h.data ?? '{}')
        const ts = Number(h.updated_at)
        await conn.execute(
          `INSERT INTO user_history(user_id, source, video_id, data, updated_at) VALUES(?,?,?,?,?)
           ON DUPLICATE KEY UPDATE data = ?, updated_at = ?`,
          [userId, String(h.source), String(h.video_id), data, ts, data, ts],
        )
      }
    }
    const s = body.settings
    if (s && s.updated_at) {
      const [rows] = await conn.execute('SELECT updated_at FROM user_settings WHERE user_id = ?', [
        userId,
      ])
      const cur = (rows as any[])[0]
      if (!cur || Number(s.updated_at) > cur.updated_at) {
        const data = String(s.data ?? '{}')
        const ts = Number(s.updated_at)
        await conn.execute(
          `INSERT INTO user_settings(user_id, data, updated_at) VALUES(?,?,?)
           ON DUPLICATE KEY UPDATE data = ?, updated_at = ?`,
          [userId, data, ts, data, ts],
        )
      }
    }
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
  return c.json({ serverTime: Date.now() })
})

// ---------------------------------------------------------------------------
// 源管理
// ---------------------------------------------------------------------------
/** 源列表 (含接口地址, 供管理页用) */
app.get('/api/sources', async (c) => c.json(await sourceOps(userIdOf(c)).list()))

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'src'
}

function validApiUrl(api: string): URL | null {
  try {
    const u = new URL(api)
    return /^https?:$/.test(u.protocol) ? u : null
  } catch {
    return null
  }
}

const randSuffix = () => Math.random().toString(36).slice(2, 6)

/** 添加源 */
app.post('/api/sources', sourceWrite, async (c) => {
  const ops = sourceOps(userIdOf(c))
  const body = await c.req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim()
  const url = validApiUrl(String(body.api ?? '').trim())
  if (!name) return c.json({ error: 'name required' }, 400)
  if (!url) return c.json({ error: 'invalid api url' }, 400)
  let id = String(body.id ?? '').trim() || slugify(name)
  if (await ops.get(id)) id = `${id}-${randSuffix()}`
  await ops.upsert({ id, name, api: url.toString() })
  return c.json({ id, name }, 201)
})

/** 修改源 */
app.put('/api/sources/:id', sourceWrite, async (c) => {
  const ops = sourceOps(userIdOf(c))
  const cur = await ops.get(c.req.param('id') ?? '')
  if (!cur) return c.json({ error: 'not found' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const name = String(body.name ?? cur.name).trim()
  const url = validApiUrl(String(body.api ?? cur.api).trim())
  if (!name) return c.json({ error: 'name required' }, 400)
  if (!url) return c.json({ error: 'invalid api url' }, 400)
  await ops.upsert({ id: cur.id, name, api: url.toString() })
  typeCache.delete(cacheKey(c, cur.id))
  return c.json({ id: cur.id, name })
})

/** 删除源 */
app.delete('/api/sources/:id', sourceWrite, async (c) => {
  const ops = sourceOps(userIdOf(c))
  const id = c.req.param('id') ?? ''
  if (!(await ops.remove(id))) return c.json({ error: 'not found' }, 404)
  typeCache.delete(cacheKey(c, id))
  return c.json({ ok: true })
})

/** 测试源连通性: 尝试拉取分类, 返回分类数量 */
app.post('/api/sources/test', sourceWrite, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const url = validApiUrl(String(body.api ?? '').trim())
  if (!url) return c.json({ ok: false, error: '接口地址无效' })
  try {
    const data = await fetchJson(
      { id: 'test', name: 'test', api: url.toString(), timeoutMs: 15000 },
      { ac: 'list' },
    )
    return c.json({ ok: true, types: (data.class ?? []).length })
  } catch (e: any) {
    return c.json({ ok: false, error: String(e?.message ?? e) })
  }
})

/**
 * 从 URL 批量导入源列表。
 * 接受 JSON 数组 [{name, api}] 或 {sources:[...]} / {list:[...]}。
 */
app.post('/api/sources/import-url', sourceWrite, async (c) => {
  const ops = sourceOps(userIdOf(c))
  const body = await c.req.json().catch(() => ({}))
  const url = validApiUrl(String(body.url ?? '').trim())
  if (!url) return c.json({ error: 'invalid url' }, 400)
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 15000)
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'LiuYing/0.1' } })
    clearTimeout(t)
    if (!r.ok) throw new Error(`http ${r.status}`)
    const j = await r.json()
    const arr: any[] = Array.isArray(j) ? j : (j.sources ?? j.list ?? [])
    let added = 0
    for (const it of arr) {
      const name = String(it?.name ?? '').trim()
      const api = validApiUrl(String(it?.api ?? it?.url ?? '').trim())
      if (!name || !api) continue
      let sid = slugify(name)
      if (await ops.get(sid)) sid = `${sid}-${randSuffix()}`
      await ops.upsert({ id: sid, name, api: api.toString() })
      added++
    }
    return c.json({ added })
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 400)
  }
})

// ---------------------------------------------------------------------------
// 内容接口 (分类/列表/搜索/详情), 按登录状态读对应源列表
// ---------------------------------------------------------------------------
const typeCache = new Map<string, { at: number; data: { id: string; name: string }[] }>()
const cacheKey = (c: Context, id: string) => `${userIdOf(c) ?? 'global'}:${id}`

/** 每个源的分类 (缓存 1 小时) */
app.get('/api/types', async (c) => {
  const ops = sourceOps(userIdOf(c))
  const s = await ops.get(c.req.query('source') ?? '')
  if (!s) return c.json({ error: 'unknown source' }, 400)
  const key = cacheKey(c, s.id)
  const hit = typeCache.get(key)
  if (hit && Date.now() - hit.at < 3600_000) return c.json(hit.data)
  const data = await fetchJson(toVod(s), { ac: 'list' })
  const list = (data.class ?? []).map((t: any) => ({ id: String(t.type_id), name: t.type_name }))
  typeCache.set(key, { at: Date.now(), data: list })
  return c.json(list)
})

/** 按分类取影片列表 */
app.get('/api/list', async (c) => {
  const ops = sourceOps(userIdOf(c))
  const s = await ops.get(c.req.query('source') ?? '')
  if (!s) return c.json({ error: 'unknown source' }, 400)
  const t = c.req.query('t') ?? ''
  const pg = c.req.query('pg') ?? '1'
  const data = await fetchJson(toVod(s), { ac: 'videolist', t, pg })
  return c.json({
    page: Number(data.page ?? pg),
    pagecount: Number(data.pagecount ?? 1),
    total: Number(data.total ?? 0),
    list: (data.list ?? []).map((v: any) => normVideo(s, v)),
  })
})

/** 聚合搜索: 不传 sources = 搜全部源, 传 sources=a,b = 只搜指定源 */
app.get('/api/search', async (c) => {
  const ops = sourceOps(userIdOf(c))
  const wd = (c.req.query('wd') ?? '').trim()
  if (!wd) return c.json([])
  const ids = (c.req.query('sources') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  const targets: (UserSource | undefined)[] = ids.length
    ? await Promise.all(ids.map((id) => ops.get(id)))
    : await ops.list()
  const valid = targets.filter((s): s is UserSource => !!s)
  const settled = await Promise.allSettled(
    valid.map(async (s) => {
      const data = await fetchJson(toVod(s), { ac: 'videolist', wd, pg: '1' })
      return (data.list ?? []).map((v: any) => normVideo(s, v))
    }),
  )
  const out: VideoItem[] = []
  for (const r of settled) if (r.status === 'fulfilled') out.push(...r.value)
  return c.json(out)
})

/** 详情 + 播放地址解析 (vod_play_url 按 $$$ 分线路, # 分集, $ 分隔集名和地址) */
app.get('/api/detail', async (c) => {
  const ops = sourceOps(userIdOf(c))
  const s = await ops.get(c.req.query('source') ?? '')
  const ids = c.req.query('ids') ?? ''
  if (!s || !ids) return c.json({ error: 'bad request' }, 400)
  const data = await fetchJson(toVod(s), { ac: 'videolist', ids })
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
        if (t.startsWith('#'))
          return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${proxied(abs(u))}"`)
        return proxied(abs(t))
      })
      .join('\n')
    headers.set('content-type', 'application/vnd.apple.mpegurl')
    return new Response(body, { status: upstream.status, headers })
  }
  return new Response(upstream.body, { status: upstream.status, headers })
})

app.get('/api/health', async (c) =>
  c.json({
    ok: true,
    user: c.get('username') ?? null,
    sources: (await sourceOps(userIdOf(c)).list()).length,
  }),
)

const port = Number(process.env.PORT ?? 3000)
console.log(`[liuying] api listening on :${port}`)
serve({ fetch: app.fetch, port })
