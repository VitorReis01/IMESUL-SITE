-- Campo Grande only. Dourados keeps its existing independent flow.
CREATE TABLE IF NOT EXISTS commercial_seller_rotation_state (
  unit TEXT PRIMARY KEY CHECK (unit = 'campo-grande'),
  -- Intentionally no FK: deleting/disabling the last seller must not reset the cursor.
  last_seller_id BIGINT
);

INSERT INTO commercial_seller_rotation_state (unit, last_seller_id)
VALUES ('campo-grande', NULL) ON CONFLICT (unit) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_sales_sellers_active_rotation
  ON sales_sellers (unit, id) WHERE active = TRUE;

-- Minimal durable audit intent, written in the same INSERT as the lead.
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS rotation_creation_audit JSONB;
CREATE INDEX IF NOT EXISTS idx_sales_leads_rotation_audit_pending
  ON sales_leads (id)
  WHERE unit = 'campo-grande' AND rotation_creation_audit IS NOT NULL;

ALTER TABLE commercial_seller_rotation_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON commercial_seller_rotation_state FROM PUBLIC;

-- Existing deployments may still use the owner. Grant only to the reviewed runtime
-- role when it exists; never expose cursor state through Supabase anon/authenticated.
DO $$
DECLARE api_role TEXT;
BEGIN
  -- Supabase default privileges may grant these roles directly. RLS does not
  -- protect TRUNCATE, so revoking PUBLIC alone is insufficient.
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON commercial_seller_rotation_state FROM %I', api_role);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'imesul_vendas_app') THEN
    GRANT SELECT, UPDATE ON commercial_seller_rotation_state TO imesul_vendas_app;
    DROP POLICY IF EXISTS rotation_runtime ON commercial_seller_rotation_state;
    CREATE POLICY rotation_runtime ON commercial_seller_rotation_state
      FOR ALL TO imesul_vendas_app USING (unit = 'campo-grande')
      WITH CHECK (unit = 'campo-grande');
  END IF;
END $$;
