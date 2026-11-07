CREATE TABLE correction_history (
 id TEXT PRIMARY KEY,
 session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 document_kind TEXT NOT NULL,
 fields TEXT NOT NULL,
 created_at TEXT NOT NULL
);
