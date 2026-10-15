import { randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { db } from './db.js'
import { store } from './sources.js'

const TOKEN_TTL_MS = 30 * 86400 * 1000

export interface AuthUser {
  id: string
  username: string
}

function validUsername(u: string): boolean {
  return /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/.test(u)
}

export function createUser(username: string, password: string): AuthUser {
  username = username.trim()
  if (!validUsername(username)) throw new Error('用户名需为 2-20 位字母/数字/中文/下划线')
  if (password.length < 4) throw new Error('密码至少 4 位')
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (exists) throw new Error('用户名已存在')
  const id = randomUUID()
  const now = Date.now()
  const insertUser = db.prepare(
    'INSERT INTO users(id, username, password_hash, created_at) VALUES(?,?,?,?)',
  )
  const insertSource = db.prepare(
    'INSERT INTO user_sources(id, user_id, source_id, name, api, sort, updated_at) VALUES(?,?,?,?,?,?,?)',
  )
  db.transaction(() => {
    insertUser.run(id, username, bcrypt.hashSync(password, 10), now)
    // 新账号默认继承服务端全局源列表, 开箱即用
    store.all().forEach((s, i) => {
      insertSource.run(randomUUID(), id, s.id, s.name, s.api, i, now)
    })
  })()
  return { id, username }
}

export function verifyUser(username: string, password: string): AuthUser {
  const row = db
    .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
    .get(username.trim()) as any
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    throw new Error('用户名或密码错误')
  }
  return { id: row.id, username: row.username }
}

export function createToken(userId: string): string {
  const token = randomBytes(32).toString('hex')
  const now = Date.now()
  db.prepare('INSERT INTO tokens(token, user_id, created_at, expires_at) VALUES(?,?,?,?)').run(
    token,
    userId,
    now,
    now + TOKEN_TTL_MS,
  )
  return token
}

export function getUserByToken(token: string): AuthUser | null {
  const row = db
    .prepare(
      'SELECT u.id, u.username, t.expires_at FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?',
    )
    .get(token) as any
  if (!row) return null
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM tokens WHERE token = ?').run(token)
    return null
  }
  return { id: row.id, username: row.username }
}

export function revokeToken(token: string): void {
  db.prepare('DELETE FROM tokens WHERE token = ?').run(token)
}
