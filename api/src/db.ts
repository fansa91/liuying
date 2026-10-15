import mysql from 'mysql2/promise'

/**
 * MySQL 连接池, 配置全部走环境变量:
 *   DB_HOST (默认 127.0.0.1), DB_PORT (默认 3306),
 *   DB_USER (默认 root), DB_PASSWORD (默认空), DB_NAME (默认 liuying)
 * 库不存在会自动创建, 表不存在会自动建表。
 */
export let pool: mysql.Pool

export async function initDb(): Promise<void> {
  const host = process.env.DB_HOST ?? '127.0.0.1'
  const port = Number(process.env.DB_PORT ?? 3306)
  const user = process.env.DB_USER ?? 'root'
  const password = process.env.DB_PASSWORD ?? ''
  const database = process.env.DB_NAME ?? 'liuying'

  // 先不连库, 确保库存在
  const admin = mysql.createPool({ host, port, user, password })
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  await admin.end()

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4_unicode_ci',
  })

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(64) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tokens (
      token VARCHAR(128) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL,
      INDEX idx_tokens_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sources (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      source_id VARCHAR(128) NOT NULL,
      name VARCHAR(128) NOT NULL,
      api VARCHAR(1024) NOT NULL,
      sort INT NOT NULL DEFAULT 0,
      updated_at BIGINT NOT NULL,
      UNIQUE KEY uq_user_source (user_id, source_id),
      INDEX idx_user_sources_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_history (
      user_id VARCHAR(64) NOT NULL,
      source VARCHAR(128) NOT NULL,
      video_id VARCHAR(128) NOT NULL,
      data MEDIUMTEXT NOT NULL,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (user_id, source, video_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id VARCHAR(64) PRIMARY KEY,
      data MEDIUMTEXT NOT NULL,
      updated_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}
