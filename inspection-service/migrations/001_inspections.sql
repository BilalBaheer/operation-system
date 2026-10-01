CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS inspections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       TEXT NOT NULL,
  structure_id     TEXT NOT NULL,
  inspector_id     TEXT NOT NULL,
  inspection_date  DATE NOT NULL,
  condition_rating SMALLINT NOT NULL CHECK (condition_rating BETWEEN 1 AND 5),
  priority         TEXT NOT NULL CHECK (priority IN ('IMMEDIATE', 'HIGH', 'ROUTINE', 'MONITOR')),
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS findings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  element       TEXT NOT NULL,
  severity      TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'major', 'critical'))
);

-- Outbox table: events wait here until a relay forwards them to Azure Service Bus
CREATE TABLE IF NOT EXISTS outbox_events (
  id           BIGSERIAL PRIMARY KEY,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inspections_project ON inspections(project_id);
CREATE INDEX IF NOT EXISTS idx_inspections_priority_status ON inspections(priority, status);
CREATE INDEX IF NOT EXISTS idx_findings_inspection ON findings(inspection_id);
