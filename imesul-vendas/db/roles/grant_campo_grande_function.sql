-- Manual supplement when imesul_vendas_app is created AFTER migration 008.
-- Apply only with migration-owner authorization, never from application startup.
GRANT EXECUTE ON FUNCTION campo_grande_create_lead(text, text, text, text, text, text, text, text, jsonb, text, text, text, text, text, text)
  TO imesul_vendas_app;
