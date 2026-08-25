CREATE TABLE IF NOT EXISTS company_profiles (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  last_verified TEXT,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS company_profiles_verification_status_idx
  ON company_profiles (verification_status);

CREATE INDEX IF NOT EXISTS company_profiles_name_idx
  ON company_profiles (name);

CREATE TABLE IF NOT EXISTS company_catalog_metadata (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  data_year INTEGER NOT NULL,
  catalog_updated TEXT NOT NULL,
  disclaimer TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
