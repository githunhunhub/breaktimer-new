-- D1 schema for anonymous installation metrics (SPEC-0018, ADR-0019).
-- One row per installation, plus one row per installation per active day.

CREATE TABLE IF NOT EXISTS installs (
  install_id      TEXT PRIMARY KEY,
  first_seen_day  TEXT NOT NULL, -- client first-launch day (YYYY-MM-DD)
  last_seen_day   TEXT NOT NULL,
  first_version   TEXT NOT NULL,
  os              TEXT NOT NULL, -- windows-10 / windows-11 / windows / …
  arch            TEXT NOT NULL, -- x64 / arm64 / x86
  locale          TEXT NOT NULL, -- language tag only, no time zone
  channel         TEXT NOT NULL, -- installer / portable
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS installs_first_seen_day
  ON installs (first_seen_day);

CREATE TABLE IF NOT EXISTS daily_active (
  install_id  TEXT NOT NULL,
  day         TEXT NOT NULL,
  version     TEXT NOT NULL,
  channel     TEXT NOT NULL,
  PRIMARY KEY (install_id, day)
);

CREATE INDEX IF NOT EXISTS daily_active_day
  ON daily_active (day);
