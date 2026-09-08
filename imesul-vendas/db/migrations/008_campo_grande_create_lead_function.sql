-- Move a regiao critica do rodizio de Campo Grande para uma UNICA chamada server-side (funcao
-- PL/pgSQL) - reduz Node<->Supabase de ~5 round-trips (BEGIN + lock + dedup/escolha + insert-e-
-- avanco + COMMIT) para 1 chamada logica. NAO altera a regra de negocio (round-robin puro,
-- vendedor ocupado nao interfere, so vendedores ativos participam) nem a migration 006/007 (nao
-- toca schema/permissoes ja aplicados por elas, so cria a funcao nova).
--
-- POR QUE ISSO E SEGURO PARA IDEMPOTENCIA (mesma armadilha ja encontrada e corrigida na rodada
-- anterior, agora evitada por construcao): dentro de uma funcao PL/pgSQL, cada comando (SELECT/
-- UPDATE/INSERT) recebe seu PROPRIO snapshot MVCC fresco em READ COMMITTED - diferente de uma
-- unica instrucao SQL com varios CTEs (onde o statement INTEIRO compartilha um snapshot fixado
-- no inicio). Por isso e seguro fazer aqui: 1) SELECT ... FOR UPDATE (bloqueia), 2) reconferir
-- dedup DEPOIS de desbloquear - a releitura corretamente enxerga qualquer commit que aconteceu
-- enquanto esperavamos o lock, sem nenhum round-trip de rede entre os passos (tudo roda dentro
-- do mesmo backend do Postgres).
--
-- SECURITY INVOKER (nao DEFINER, e o padrao mas fica explicito): a funcao roda com os privilegios
-- de quem chama (imesul_vendas_app) - nunca eleva privilegio. A role so precisa dos MESMOS GRANTs
-- de tabela que ja tem (migration 006/007) + EXECUTE nesta funcao (concedido abaixo, condicional
-- a role ja existir - mesmo padrao da migration 006 para nao falhar num ambiente onde a role
-- ainda nao foi criada).
--
-- generateLeadCode() continua em JS (Backend.js/salesLeadsStore.js) - a funcao SO recebe o
-- lead_code ja pronto (p_lead_code), nunca gera nem re-tenta internamente. Uma colisao de
-- lead_code (praticamente impossivel, 32^8 combinacoes) vira uma excecao normal do INSERT,
-- propagada ao chamador como erro generico - mesma politica ja adotada na rodada anterior.
CREATE OR REPLACE FUNCTION campo_grande_create_lead(
  p_idempotency_key text,
  p_lead_code text,
  p_visitor_id text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_origin text,
  p_source text,
  p_utm jsonb,
  p_product text,
  p_quote_summary text,
  p_flow_type text,
  p_site_origin text,
  p_page_path text,
  p_customer_phone_source text
)
RETURNS TABLE (
  lead_id bigint,
  lead_code text,
  seller_id bigint,
  seller_name text,
  seller_whatsapp text,
  deduped boolean,
  no_active_seller boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_id bigint;
  v_existing_lead_code text;
  v_existing_seller_id bigint;
  v_existing_seller_name text;
  v_existing_seller_whatsapp text;
  v_last_seller_id bigint;
  v_candidate_id bigint;
  v_candidate_name text;
  v_candidate_whatsapp text;
  v_inserted_id bigint;
  v_inserted_lead_code text;
BEGIN
  -- 1) Dedup RAPIDO, antes de qualquer lock - cobre o caso comum (retry/clique duplo) sem gastar
  -- o lock do cursor a toa. Statement proprio, snapshot fresco.
  SELECT sl.id, sl.lead_code, sl.seller_id, ss.name, ss.whatsapp
    INTO v_existing_id, v_existing_lead_code, v_existing_seller_id, v_existing_seller_name, v_existing_seller_whatsapp
    FROM sales_leads sl
    LEFT JOIN sales_sellers ss ON ss.id = sl.seller_id
   WHERE sl.idempotency_key = p_idempotency_key
   LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing_id, v_existing_lead_code, v_existing_seller_id, v_existing_seller_name, v_existing_seller_whatsapp, TRUE, FALSE;
    RETURN;
  END IF;

  -- 2) Bloqueia SOMENTE o estado de rotacao de campo-grande (nunca sales_sellers/sales_leads
  -- inteiras) - requisito explicito de escopo minimo de lock.
  SELECT last_seller_id INTO v_last_seller_id
    FROM commercial_seller_rotation_state
   WHERE unit = 'campo-grande'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estado do rodizio nao inicializado.';
  END IF;

  -- 3) Reconfere dedup AGORA que o lock foi adquirido - statement NOVO, snapshot NOVO, ve
  -- corretamente qualquer commit que aconteceu enquanto este backend esperava o lock (essa e a
  -- garantia que impede duas requisicoes concorrentes com a MESMA idempotency_key de avancarem o
  -- cursor duas vezes).
  SELECT sl.id, sl.lead_code, sl.seller_id, ss.name, ss.whatsapp
    INTO v_existing_id, v_existing_lead_code, v_existing_seller_id, v_existing_seller_name, v_existing_seller_whatsapp
    FROM sales_leads sl
    LEFT JOIN sales_sellers ss ON ss.id = sl.seller_id
   WHERE sl.idempotency_key = p_idempotency_key
   LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing_id, v_existing_lead_code, v_existing_seller_id, v_existing_seller_name, v_existing_seller_whatsapp, TRUE, FALSE;
    RETURN;
  END IF;

  -- 4) Escolhe o proximo vendedor ATIVO em ordem de id, avancando a partir do cursor e voltando
  -- ao inicio no fim da lista (round-robin puro - "ocupado"/leads abertos NUNCA participam desta
  -- escolha, so o campo active). Mesma logica de CASE ja usada e testada no codigo JS anterior.
  SELECT s.id, s.name, s.whatsapp
    INTO v_candidate_id, v_candidate_name, v_candidate_whatsapp
    FROM sales_sellers s
   WHERE s.unit = 'campo-grande' AND s.active = TRUE
   ORDER BY CASE WHEN v_last_seller_id IS NULL OR s.id > v_last_seller_id THEN 0 ELSE 1 END, s.id
   LIMIT 1;

  IF NOT FOUND THEN
    -- Nenhum vendedor ativo - nao insere lead, nao avanca cursor. Sinalizado por
    -- no_active_seller=TRUE (nunca por excecao - este e um resultado de negocio normal, tratado
    -- pelo chamador como NO_ACTIVE_SELLER, nao como falha inesperada).
    RETURN QUERY SELECT NULL::bigint, NULL::text, NULL::bigint, NULL::text, NULL::text, FALSE, TRUE;
    RETURN;
  END IF;

  -- 5) Insere o lead ja com o vendedor escolhido e a intencao de auditoria (mesmo padrao pos-
  -- commit ja existente - Backend.js/sellerRotationStore.js#flushRotationCreationAudit continua
  -- rodando do lado do Node, sem mudanca).
  INSERT INTO sales_leads (
    lead_code, visitor_id, seller_id, customer_name, customer_phone, customer_email,
    origin, source, utm, product, quote_summary, idempotency_key,
    flow_type, site_origin, unit, page_path, customer_phone_source, rotation_creation_audit
  ) VALUES (
    p_lead_code, p_visitor_id, v_candidate_id, p_customer_name, p_customer_phone, p_customer_email,
    p_origin, p_source, p_utm, p_product, p_quote_summary, p_idempotency_key,
    p_flow_type, p_site_origin, 'campo-grande', p_page_path, p_customer_phone_source,
    jsonb_build_object('flowType', p_flow_type, 'siteOrigin', p_site_origin, 'unit', 'campo-grande', 'sellerId', v_candidate_id)
  )
  RETURNING id, sales_leads.lead_code INTO v_inserted_id, v_inserted_lead_code;

  -- 6) Avanca o cursor - so acontece se o INSERT acima teve sucesso (mesma instrucao/transacao
  -- implicita da chamada de funcao - se o INSERT tivesse lancado excecao, nunca chegariamos aqui,
  -- e nada seria commitado).
  UPDATE commercial_seller_rotation_state
     SET last_seller_id = v_candidate_id
   WHERE unit = 'campo-grande';

  -- 7) Retorna lead + vendedor. 8) O lock e tudo mais e liberado quando esta chamada de funcao
  -- termina (commit implicito da chamada inteira, gerenciado pelo Postgres).
  RETURN QUERY SELECT v_inserted_id, v_inserted_lead_code, v_candidate_id, v_candidate_name, v_candidate_whatsapp, FALSE, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION campo_grande_create_lead(text, text, text, text, text, text, text, text, jsonb, text, text, text, text, text, text) FROM PUBLIC;

-- Concede EXECUTE somente se a role de runtime ja existir (mesmo padrao condicional da migration
-- 006) - em ambientes onde ela ainda nao existe, aplicar db/roles/grant_campo_grande_function.sql
-- manualmente depois de criar a role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'imesul_vendas_app') THEN
    GRANT EXECUTE ON FUNCTION campo_grande_create_lead(text, text, text, text, text, text, text, text, jsonb, text, text, text, text, text, text) TO imesul_vendas_app;
  END IF;
END $$;
