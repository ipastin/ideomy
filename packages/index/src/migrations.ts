export const migrations = [
  `CREATE TABLE index_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE entities (
     id TEXT PRIMARY KEY, path TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
     status TEXT NOT NULL, title TEXT NOT NULL, aliases TEXT NOT NULL,
     sensitivity TEXT NOT NULL, agent_access TEXT NOT NULL
   );
   CREATE TABLE file_state (
     path TEXT PRIMARY KEY, hash TEXT NOT NULL, kind TEXT NOT NULL,
     entity_id TEXT REFERENCES entities(id)
   );
   CREATE TABLE relationships (
     source_id TEXT NOT NULL REFERENCES entities(id), property TEXT NOT NULL,
     ordinal INTEGER NOT NULL, target_ref TEXT NOT NULL,
     target_id TEXT REFERENCES entities(id), resolution TEXT NOT NULL,
     PRIMARY KEY (source_id, property, ordinal)
   );
   CREATE TABLE documents (
     path TEXT PRIMARY KEY, entity_id TEXT REFERENCES entities(id),
     title TEXT NOT NULL, sensitivity TEXT NOT NULL, agent_access TEXT NOT NULL
   );
   CREATE TABLE chunks (
     id INTEGER PRIMARY KEY, path TEXT NOT NULL REFERENCES documents(path),
     ordinal INTEGER NOT NULL, content TEXT NOT NULL,
     UNIQUE (path, ordinal)
   );
   CREATE VIRTUAL TABLE fts_chunks USING fts5(title, content, tokenize='unicode61 remove_diacritics 2');
   CREATE TABLE transactions (
     id TEXT PRIMARY KEY, state TEXT NOT NULL, journal_path TEXT NOT NULL,
     created_at TEXT NOT NULL
   );`,
  `ALTER TABLE documents ADD COLUMN aliases TEXT NOT NULL DEFAULT '[]';
   ALTER TABLE documents ADD COLUMN activity_at TEXT;
   CREATE TABLE wiki_links (
     source_path TEXT NOT NULL REFERENCES documents(path),
     ordinal INTEGER NOT NULL, target_ref TEXT NOT NULL,
     target_path TEXT REFERENCES documents(path), resolution TEXT NOT NULL,
     PRIMARY KEY (source_path, ordinal)
   );
   CREATE INDEX relationships_target_id ON relationships(target_id);
   CREATE INDEX wiki_links_target_path ON wiki_links(target_path);`,
  `ALTER TABLE documents ADD COLUMN capture_marker TEXT;`,
] as const;
