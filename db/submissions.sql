CREATE TABLE IF NOT EXISTS company_submissions (
  id TEXT PRIMARY KEY,
  request_type TEXT NOT NULL CHECK (request_type IN ('add', 'edit')),
  company_name TEXT NOT NULL,
  company_slug TEXT,
  website TEXT,
  submitter_name TEXT NOT NULL,
  submitter_email TEXT NOT NULL,
  message TEXT NOT NULL,
  is_portal_request BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'awaiting_review' CHECK (status IN ('awaiting_review', 'in_progress', 'verified', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE company_submissions DROP CONSTRAINT IF EXISTS company_submissions_status_check;
ALTER TABLE company_submissions
  ADD CONSTRAINT company_submissions_status_check
  CHECK (status IN ('pending', 'reviewed', 'accepted', 'awaiting_review', 'in_progress', 'verified', 'rejected'));

UPDATE company_submissions SET status = 'awaiting_review' WHERE status IN ('pending', 'reviewed');
UPDATE company_submissions SET status = 'verified' WHERE status = 'accepted';

ALTER TABLE company_submissions DROP CONSTRAINT IF EXISTS company_submissions_status_check;
ALTER TABLE company_submissions
  ADD CONSTRAINT company_submissions_status_check
  CHECK (status IN ('awaiting_review', 'in_progress', 'verified', 'rejected'));

ALTER TABLE company_submissions ALTER COLUMN status SET DEFAULT 'awaiting_review';

ALTER TABLE company_submissions
  ADD COLUMN IF NOT EXISTS is_portal_request BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS company_submissions_email_idx ON company_submissions (submitter_email);
CREATE INDEX IF NOT EXISTS company_submissions_status_idx ON company_submissions (status);
