CREATE TABLE IF NOT EXISTS sessions (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, transport TEXT NOT NULL,
 updated_at INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 0, profile TEXT,
 messages TEXT NOT NULL DEFAULT '[]', recommendation TEXT NOT NULL DEFAULT '[]',
 advisor_step INTEGER NOT NULL DEFAULT 0, consent TEXT
);
CREATE TABLE IF NOT EXISTS quotes (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, data TEXT NOT NULL, current INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS quotes_session ON quotes(session_id);
CREATE TABLE IF NOT EXISTS documents (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, status TEXT NOT NULL, fields TEXT NOT NULL, issues TEXT NOT NULL,
 evidence TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS documents_kind ON documents(session_id, kind);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 quote_id TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL, data TEXT NOT NULL,
 UNIQUE(session_id, idempotency_key)
);
