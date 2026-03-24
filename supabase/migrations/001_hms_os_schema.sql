-- HMS OS — Supabase Schema
-- Migración inicial: tablas operacionales de Host My Spot

-- ─── Properties ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  owner_id TEXT,
  owner_name TEXT,
  owner_email TEXT,
  platform_ids JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  commission_rate NUMERIC(5, 4) DEFAULT 0.20,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Pricing Rules ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT REFERENCES properties(id),
  platform TEXT DEFAULT 'all',
  base_price NUMERIC(10, 2) NOT NULL,
  weekend_price NUMERIC(10, 2),
  min_nights INTEGER DEFAULT 1,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, platform)
);

CREATE TABLE IF NOT EXISTS pricing_rules_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT,
  platform TEXT,
  base_price NUMERIC(10, 2),
  weekend_price NUMERIC(10, 2),
  min_nights INTEGER,
  currency TEXT,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archive_reason TEXT
);

-- ─── Expenses ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT REFERENCES properties(id),
  date DATE NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  vendor TEXT,
  requires_owner_approval BOOLEAN DEFAULT FALSE,
  approved BOOLEAN DEFAULT TRUE,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Owner Statements ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS owner_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT REFERENCES properties(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_revenue NUMERIC(12, 2),
  total_expenses NUMERIC(12, 2),
  hms_commission NUMERIC(12, 2),
  net_payout NUMERIC(12, 2),
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'draft', -- draft, reviewed, sent
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Maintenance Tickets ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS maintenance_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT REFERENCES properties(id),
  date DATE NOT NULL,
  category TEXT, -- plomería, electricidad, limpieza, pintura, etc.
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- open, in_progress, completed, cancelled
  cost NUMERIC(10, 2),
  currency TEXT DEFAULT 'USD',
  vendor TEXT,
  requires_approval BOOLEAN DEFAULT FALSE,
  approved BOOLEAN,
  approved_by TEXT,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── HMS Config ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hms_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT DEFAULT 'system'
);

-- ─── Audit Log ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,
  tool TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT NOT NULL,
  payload JSONB,
  risk_level TEXT NOT NULL DEFAULT 'low', -- low, medium, high, critical
  approved_by TEXT,
  result TEXT DEFAULT 'success', -- success, failure, pending
  error TEXT,
  session_id TEXT
);

-- Index for fast queries on audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_risk ON audit_log(risk_level);

-- ─── Guest Profiles ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guest_profiles (
  id TEXT PRIMARY KEY, -- hostex guest_id
  name TEXT,
  email TEXT,
  phone TEXT,
  platform TEXT,
  notes TEXT,
  vip BOOLEAN DEFAULT FALSE,
  first_stay TIMESTAMPTZ,
  last_stay TIMESTAMPTZ,
  total_stays INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Seed: HMS Config ─────────────────────────────────────────────────────────

INSERT INTO hms_config (key, value, description) VALUES
  ('commission_rate', '0.20', 'Tasa de comisión de HMS sobre ingresos brutos'),
  ('approval_threshold_usd', '200', 'Monto en USD que requiere aprobación del propietario'),
  ('owner_contact', '"otainadal@gmail.com"', 'Email del operador principal'),
  ('company', '"Host My Spot"', 'Nombre de la empresa'),
  ('domain', '"hostmyspot.com.do"', 'Dominio principal')
ON CONFLICT (key) DO NOTHING;

-- ─── Row Level Security ───────────────────────────────────────────────────────

-- Enable RLS on sensitive tables
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Service role bypass (HMS OS uses service_role key)
CREATE POLICY "service_role_all" ON expenses FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON owner_statements FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON audit_log FOR ALL TO service_role USING (true);
