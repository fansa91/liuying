import { resolve } from 'node:path'
import Database from 'better-sqlite3'

const DB_PATH = process.env.DB_PATH ?? resolve(process.cwd(), 'liuying.db')

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tokens_user ON tokens(user_id);
CREATE TABLE IF NOT EXISTS user_sources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  name TEXT NOT NULL,
  api TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, source_id)
);
CREATE INDEX IF NOT EXISTS idx_user_sources_user ON user_sources(user_id);
CREATE TABLE IF NOT EXISTS user_history (
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  video_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, source, video_id)
);
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`)
