import { randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from './db.js'
import { store } from './sources.js'

const TOKEN_TTL_MS = 30 * 86400 * 1000

export interface AuthUser {
  id: string
  username: string
}

function validUsername(u: string): boolean {
  return /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/.test(u)
}

export async function createUser(username: string, password: string): Promise<AuthUser> {
  username = username.trim()
  if (!validUsername(username)) throw new Error('用户名需为 2-20 位字母/数字/中文/下划线')
  if (password.length < 4) throw new Error('密码至少 4 位')
  const [exists] = await pool.execute('SELECT id FROM users WHERE username = ?', [username])
  if ((exists as any[]).length) throw new Error('用户名已存在')
  const id = randomUUID()
  const now = Date.now()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute('INSERT INTO users(id, username, password_hash, created_at) VALUES(?,?,?,?)', [
      id,
      username,
      bcrypt.hashSync(password, 10),
      now,
    ])
    // 新账号默认继承服务端全局源列表, 开箱即用
    const seeds = store.all()
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]
      await conn.execute(
        'INSERT INTO user_sources(id, user_id, source_id, name, api, sort, updated_at) VALUES(?,?,?,?,?,?,?)',
        [randomUUID(), id, s.id, s.name, s.api, i, now],
      )
    }
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
  return { id, username }
}

export async function verifyUser(username: string, password: string): Promise<AuthUser> {
  const [rows] = await pool.execute('SELECT id, username, password_hash FROM users WHERE username = ?', [
    username.trim(),
  ])
  const row = (rows as any[])[0]
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    throw new Error('用户名或密码错误')
  }
  return { id: row.id, username: row.username }
}

export async function createToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const now = Date.now()
  await pool.execute('INSERT INTO tokens(token, user_id, created_at, expires_at) VALUES(?,?,?,?)', [
    token,
    userId,
    now,
    now + TOKEN_TTL_MS,
  ])
  return token
}

export async function getUserByToken(token: string): Promise<AuthUser | null> {
  const [rows] = await pool.execute(
    'SELECT u.id, u.username, t.expires_at FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?',
    [token],
  )
  const row = (rows as any[])[0]
  if (!row) return null
  if (row.expires_at < Date.now()) {
    await pool.execute('DELETE FROM tokens WHERE token = ?', [token])
    return null
  }
  return { id: row.id, username: row.username }
}

export async function revokeToken(token: string): Promise<void> {
  await pool.execute('DELETE FROM tokens WHERE token = ?', [token])
}
