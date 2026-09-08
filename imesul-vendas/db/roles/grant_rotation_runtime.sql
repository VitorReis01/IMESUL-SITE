-- Manual supplement when imesul_vendas_app is created AFTER migration 006.
-- Apply only with migration-owner authorization, never from application startup.
GRANT SELECT, UPDATE ON commercial_seller_rotation_state TO imesul_vendas_app;
DROP POLICY IF EXISTS rotation_runtime ON commercial_seller_rotation_state;
CREATE POLICY rotation_runtime ON commercial_seller_rotation_state
  FOR ALL TO imesul_vendas_app USING (unit = 'campo-grande')
  WITH CHECK (unit = 'campo-grande');
