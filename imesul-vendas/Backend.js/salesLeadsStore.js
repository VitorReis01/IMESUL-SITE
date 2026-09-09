import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { isDatabaseConfigured, query, withTransaction } from "./db";
import { markCartConverted } from "./cartStore";
import { recordLeadEvent } from "./imebotStore";
import { createCampoGrandeLead, flushRotationCreationAudit } from "./sellerRotationStore";
import {
  COMMERCIAL_UNITS,
  LEAD_FLOW_TYPES,
  LEAD_SITE_ORIGIN,
  CUSTOMER_PHONE_SOURCE,
  isCommercialAutomationEnabledForUnit,
  isValidCommercialUnit,
  isValidLeadFlowType,
} from "../lib/leadFlow";

// Automacao comercial - Fase 1: Lead ID unico + rodizio de vendedores + registro do lead.
// So funciona com DATABASE_URL configurada - sem banco, createLead devolve {ok:false} e quem
// chamou (app/api/leads/route.js) repassa isso ao frontend, que cai no WhatsApp padrao ja
// existente (ver components/QuoteBuilder.jsx). Um lead nunca impede o cliente de falar com a
// IMESUL: o pior cenario possivel e "sem Lead ID/rodizio", nunca "sem WhatsApp".

// --- Lead ID -----------------------------------------------------------------------------

// Alfabeto sem 0/O/1/I/L: evita confundir "0" com "O" e "1"/"I"/"L" ao ler o codigo em voz alta
// ou digitar de volta. 8 caracteres nesse alfabeto de 32 simbolos = 32^8 combinacoes (~1,1
// trilhao) - a colisao por acaso e praticamente impossivel, mas o INSERT ainda trata a colisao
// real (constraint UNIQUE) tentando outro codigo, nunca dependendo so da entropia.
const leadCodeAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const leadCodeLength = 8;
const maxLeadCodeAttempts = 5;

const generateLeadCode = () => {
  const bytes = randomBytes(leadCodeLength);
  let code = "";
  for (let i = 0; i < leadCodeLength; i += 1) {
    code += leadCodeAlphabet[bytes[i] % leadCodeAlphabet.length];
  }
  return `IMESUL-${code}`;
};

// --- Sanitizacao ---------------------------------------------------------------------------

const safeString = (value, fallback = "", limit = 500) =>
  typeof value === "string" ? value.slice(0, limit) : fallback;

const safeUtm = (utm = {}) => ({
  source: safeString(utm?.source, "", 120),
  medium: safeString(utm?.medium, "", 120),
  campaign: safeString(utm?.campaign, "", 160),
  content: safeString(utm?.content, "", 160),
  term: safeString(utm?.term, "", 160),
});

// --- Dedup (clique duplo / retry de rede) ---------------------------------------------------

// Mesmo visitante + mesmo resumo de orcamento, dentro da MESMA janela de 60s, gera a mesma
// chave - clique duplo ou um retry de rede nao cria um segundo lead, so devolve o que ja existe.
// Fora dessa janela (inclusive um pedido identico feito depois), a chave muda e um lead novo e
// criado normalmente - a protecao e curta de proposito, nunca bloqueia um pedido legitimo futuro.
//
// LIMITACAO CONHECIDA (bucket de tempo): Math.floor(Date.now()/dedupWindowMs) tem uma fronteira
// dura. Um clique/retry a poucos milissegundos de distancia PODE cair em buckets diferentes se
// acontecer exatamente na virada do minuto - nesse caso a chave muda e um segundo lead seria
// criado, mesmo sendo a mesma tentativa. Confirmado por teste
// (test/salesLeadsIdempotency.test.js). So afeta quem NAO envia clientRequestId (ver abaixo).
const dedupWindowMs = 60 * 1000;

// Identificador estavel gerado UMA UNICA VEZ no cliente por tentativa comercial (ver
// lib/leadWhatsApp.js), reenviado identico em qualquer retry automatico do MESMO request
// (timeout do browser, retry de proxy/plataforma) - como nao depende de relogio, elimina a
// fronteira de 60s do fallback acima. Validado aqui antes de usar: nunca aceito "cego" e usado
// SOMENTE para compor o hash de dedup - nunca decide seller_id/status/lead_code, que continuam
// calculados so pelo servidor independente do valor recebido.
const clientRequestIdPattern = /^[A-Za-z0-9_-]{8,100}$/;
const isValidClientRequestId = (value) => typeof value === "string" && clientRequestIdPattern.test(value);

export const buildIdempotencyKey = (visitorId, quoteSummary, clientRequestId) => {
  if (isValidClientRequestId(clientRequestId)) {
    return createHash("sha256").update(`crid:${visitorId}:${clientRequestId}`).digest("hex").slice(0, 40);
  }

  // Fallback legado - usado quando o chamador nao envia clientRequestId (ex.: lead criado
  // internamente pelo webhook do IMEbot em app/api/imebot/webhook/route.js, que ja tem sua
  // propria dedup por conversa/telefone via findActiveWhatsappImebotLeadByPhone).
  const timeBucket = Math.floor(Date.now() / dedupWindowMs);
  return createHash("sha256").update(`${visitorId}|${quoteSummary}|${timeBucket}`).digest("hex").slice(0, 40);
};

// client opcional: sem ele, roda como leitura avulsa via pool (query de ./db) - usado ANTES de
// decidir o vendedor, fora de qualquer transacao (ver createLead). Com client, roda dentro da
// transacao de criacao do lead - usado so no tratamento de colisao concorrente de
// idempotency_key (ver o catch do INSERT abaixo).
const findLeadByIdempotencyKey = async (idempotencyKey, client) => {
  const runQuery = client ? client.query.bind(client) : query;
  const { rows } = await runQuery(
    `SELECT sl.id, sl.lead_code, sl.seller_id, sl.unit, sl.flow_type, ss.name AS seller_name, ss.whatsapp AS seller_whatsapp
       FROM sales_leads sl
       LEFT JOIN sales_sellers ss ON ss.id = sl.seller_id
      WHERE sl.idempotency_key = $1
      LIMIT 1`,
    [idempotencyKey]
  );

  const row = rows[0];
  if (!row) return null;

  return {
    ok: true,
    leadId: row.id,
    leadCode: row.lead_code,
    unit: row.unit,
    flowType: row.flow_type,
    deduped: true,
    seller: row.seller_id ? { id: row.seller_id, name: row.seller_name, whatsapp: row.seller_whatsapp } : null,
  };
};

// --- Rodizio de vendedores -------------------------------------------------------------------

// Legacy unscoped requests retain their existing timestamp-based assignment.
// Campo Grande uses sellerRotationStore inside the lead transaction instead.
// Dourados never enters either rotation path.
const seller_assignment_max_attempts = 3;
const seller_assignment_retry_delay_ms = 25;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const selectAvailableSeller = async (unit) => {
  const { rows } = await query(
    unit
      ? `UPDATE sales_sellers
            SET last_assigned_at = NOW()
          WHERE id = (
            SELECT id FROM sales_sellers
             WHERE active = TRUE AND unit = $1
             ORDER BY last_assigned_at ASC NULLS FIRST, id ASC
             LIMIT 1
             FOR UPDATE SKIP LOCKED
          )
        RETURNING id, name, whatsapp`
      : `UPDATE sales_sellers
            SET last_assigned_at = NOW()
          WHERE id = (
            SELECT id FROM sales_sellers
             WHERE active = TRUE
             ORDER BY last_assigned_at ASC NULLS FIRST, id ASC
             LIMIT 1
             FOR UPDATE SKIP LOCKED
          )
        RETURNING id, name, whatsapp`,
    unit ? [unit] : []
  );
  return rows[0] || null;
};

// Retry curto continua existindo como camada extra (agora bem mais barato - cada tentativa e so
// a instrucao atomica acima, nao uma transacao inteira) para o caso raro residual de duas
// instrucoes colidindo no mesmissimo instante.
export const assignNextSeller = async (unit = null) => {
  if (unit && !isCommercialAutomationEnabledForUnit(unit)) return null;
  // Campo Grande must be assigned atomically with createLead, never independently.
  if (isCommercialAutomationEnabledForUnit(unit)) {
    throw new Error("Use createLead para atribuir vendedor de Campo Grande.");
  }

  let seller = null;
  for (let attempt = 0; attempt < seller_assignment_max_attempts && !seller; attempt += 1) {
    if (attempt > 0) await sleep(seller_assignment_retry_delay_ms * attempt);
    seller = await selectAvailableSeller(unit);
  }

  return seller;
};

// --- Criacao do lead -------------------------------------------------------------------------

// Campo Grande: lock cursor, recheck idempotency, insert lead and advance cursor;
// COMMIT before publishing creation events. Other units retain their existing flow.
// allowWhatsappOrigin: SOMENTE true quando chamado internamente pelo webhook do IMEbot (nunca
// alcancavel a partir do payload de /api/leads, que e' publico/nao autenticado) - ver
// createWhatsappImebotLead abaixo. Sem essa trava, um cliente do site poderia mandar
// siteOrigin="whatsapp" e poluir os relatorios "por site" com uma origem que nunca aconteceu de
// verdade (nao e' uma falha de autorizacao/seguranca de dados, mas nao ha motivo para confiar
// nisso vindo de fora).
export const createLead = async (payload = {}, { allowWhatsappOrigin = false } = {}) => {
  if (!isDatabaseConfigured()) {
    return { ok: false, reason: "DATABASE_URL nao configurada." };
  }

  const visitorId = safeString(payload.visitorId, "visitor-unavailable", 140);
  const quoteSummary = safeString(payload.quoteSummary, "", 4000);
  // clientRequestId so participa do hash de dedup (ver buildIdempotencyKey) - nunca usado em
  // nenhum outro campo abaixo (seller_id/status/lead_code continuam decididos so pelo servidor).
  const clientRequestId = safeString(payload.clientRequestId, "", 100);
  const idempotencyKey = buildIdempotencyKey(visitorId, quoteSummary, clientRequestId);

  // Nunca confia cegamente em flowType/unit/siteOrigin vindos do payload: cai para um valor
  // seguro conhecido se o valor enviado nao estiver na allowlist (ver lib/leadFlow.js).
  const flowType = isValidLeadFlowType(payload.flowType) ? payload.flowType : LEAD_FLOW_TYPES.GUIDED_QUOTE;
  const siteOrigin = payload.siteOrigin === LEAD_SITE_ORIGIN.INSTITUCIONAL
    ? LEAD_SITE_ORIGIN.INSTITUCIONAL
    : allowWhatsappOrigin && payload.siteOrigin === LEAD_SITE_ORIGIN.WHATSAPP
      ? LEAD_SITE_ORIGIN.WHATSAPP
      : LEAD_SITE_ORIGIN.VENDAS;
  const unit = isValidCommercialUnit(payload.unit) ? payload.unit : null;

  // Dourados NUNCA cria sales_leads - regra de arquitetura territorial (ver
  // lib/douradosDispatch.js/lib/leadWhatsApp.js, que ja desviam antes de chegar aqui pelo
  // fluxo normal do site). Esta trava e' a garantia do lado do SERVIDOR: sem ela, uma chamada
  // direta a /api/leads com unit="dourados" (bypassando o frontend) cairia no caminho legado
  // abaixo e inseriria um lead orfao (sem rodizio, sem seller, nunca atendido por ninguem) -
  // ver relatorio do pentest desta fase (ACHADO-02). Verificada ANTES de qualquer busca de
  // idempotencia, escolha de vendedor ou INSERT - nenhuma consulta ao banco acontece para
  // Dourados neste ponto. Escopo deliberadamente restrito a Dourados (nao um "!isCommercialAutomationEnabledForUnit(unit)"
  // generico) para nao alterar o comportamento de nenhuma outra unidade legada existente.
  if (unit === COMMERCIAL_UNITS.DOURADOS) {
    return { ok: false, reason: "unit_not_supported" };
  }

  const pagePath = safeString(payload.pagePath, "", 180);
  const usesRotation = isCommercialAutomationEnabledForUnit(unit);
  const customerPhone = safeString(payload.customerPhone, "", 40);
  const leadValues = [
    safeString(payload.customerName, "", 120), customerPhone,
    safeString(payload.customerEmail, "", 160), safeString(payload.origin, "", 180),
    safeString(payload.source, "", 180), JSON.stringify(safeUtm(payload.utm)),
    safeString(payload.product, "", 200), quoteSummary, idempotencyKey,
    flowType, siteOrigin, unit, pagePath,
    siteOrigin === LEAD_SITE_ORIGIN.WHATSAPP ? CUSTOMER_PHONE_SOURCE.META_INBOUND
      : customerPhone ? CUSTOMER_PHONE_SOURCE.LEAD_FORM : null,
  ];
  const flushAudit = async () => {
    if (!usesRotation) return;
    try {
      await flushRotationCreationAudit();
    } catch {
      console.error("[sales-leads] auditoria pendente; sera retomada na proxima criacao/retry.");
    }
  };

  try {
    // Fast retry path; Campo Grande also rechecks after acquiring its cursor lock.
    const existingLead = await findLeadByIdempotencyKey(idempotencyKey);
    if (existingLead) {
      await flushAudit();
      return existingLead;
    }

    // Campo Grande: TODA a regiao critica (dedup + lock do cursor + escolha do vendedor + INSERT
    // + avanco do cursor) roda numa UNICA chamada de funcao PL/pgSQL server-side
    // (campo_grande_create_lead) - 1 round-trip Node<->Supabase, sem BEGIN/COMMIT explicito (a
    // propria chamada de funcao ja e atomica). Ver sellerRotationStore.js e
    // db/migrations/008_campo_grande_create_lead_function.sql para o raciocinio completo.
    if (usesRotation) {
      const leadCode = generateLeadCode();
      const outcome = await createCampoGrandeLead({
        idempotencyKey,
        leadCode,
        visitorId,
        customerName: leadValues[0],
        customerPhone: leadValues[1],
        customerEmail: leadValues[2],
        origin: leadValues[3],
        source: leadValues[4],
        utm: leadValues[5],
        product: leadValues[6],
        quoteSummary: leadValues[7],
        flowType: leadValues[9],
        siteOrigin: leadValues[10],
        pagePath: leadValues[12],
        customerPhoneSource: leadValues[13],
      });

      let result;
      if (outcome.existingLead) {
        result = outcome.existingLead;
      } else if (outcome.noActiveSeller) {
        const error = new Error("Nenhum vendedor ativo em Campo Grande.");
        error.code = "NO_ACTIVE_SELLER";
        throw error;
      } else {
        result = {
          ok: true,
          leadId: outcome.inserted.leadId,
          leadCode: outcome.inserted.leadCode,
          unit,
          flowType,
          deduped: false,
          seller: outcome.inserted.seller,
        };
      }

      await flushAudit();
      return result;
    }

    // Legacy (sem rotation) - so chega aqui fora de Campo Grande. Nao e o gargalo sob
    // investigacao nesta rodada; corrida real de idempotency_key ainda pode acontecer aqui,
    // porque este caminho nao tem nenhum lock equivalente ao cursor do rodizio - por isso
    // continua usando withTransaction + SAVEPOINT, sem alteracao.
    const legacySeller = await assignNextSeller(unit);

    const result = await withTransaction(async (client) => {
      const seller = legacySeller;
      let inserted = null;
      let lastError = null;

      for (let attempt = 0; attempt < maxLeadCodeAttempts && !inserted; attempt += 1) {
        const leadCode = generateLeadCode();

        // SAVEPOINT em volta de cada tentativa de INSERT: sem isso, um erro (23505 - colisao de
        // lead_code OU de idempotency_key) deixa a transacao INTEIRA em estado "aborted" - a
        // proxima instrucao (inclusive a busca abaixo pelo lead concorrente, ou a proxima
        // tentativa de INSERT) falharia so por isso, com "current transaction is aborted,
        // commands ignored until end of transaction block", mascarando o erro real e QUEBRANDO
        // o proprio tratamento de colisao concorrente de idempotency_key (a busca do lead
        // concorrente nunca conseguia rodar). ROLLBACK TO SAVEPOINT devolve so este INSERT,
        // sem afetar BEGIN/COMMIT nem nada feito antes dele na mesma transacao.
        await client.query("SAVEPOINT insert_lead_attempt");

        try {
          const { rows } = await client.query(
            `INSERT INTO sales_leads
               (lead_code, visitor_id, seller_id, customer_name, customer_phone, customer_email,
                origin, source, utm, product, quote_summary, idempotency_key,
                flow_type, site_origin, unit, page_path, customer_phone_source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17)
             RETURNING id, lead_code`,
            [leadCode, visitorId, seller?.id ?? null, ...leadValues]
          );
          inserted = rows[0];
          await client.query("RELEASE SAVEPOINT insert_lead_attempt");
        } catch (err) {
          await client.query("ROLLBACK TO SAVEPOINT insert_lead_attempt");
          await client.query("RELEASE SAVEPOINT insert_lead_attempt");

          // 23505 = unique_violation (Postgres). Duas causas possiveis aqui:
          // - colisao no lead_code (extremamente rara): tenta de novo com outro codigo.
          // - colisao na idempotency_key: outra requisicao concorrente com o MESMO clique/retry
          //   ja criou o lead entre a checagem acima e este INSERT - busca e devolve ela. So
          //   funciona corretamente por causa do ROLLBACK TO SAVEPOINT acima (ver comentario).
          if (err.code === "23505" && String(err.constraint || "").includes("idempotency_key")) {
            const concurrentLead = await findLeadByIdempotencyKey(idempotencyKey, client);
            if (concurrentLead) return concurrentLead;
          }
          if (err.code !== "23505") throw err;
          lastError = err;
        }
      }

      if (!inserted) {
        throw lastError || new Error("Nao foi possivel gerar um Lead ID unico.");
      }

      await recordLeadEvent(client, {
        leadId: inserted.id,
        eventType: "LEAD_CREATED",
        actorType: "system",
        metadata: { flowType, siteOrigin, unit },
      });
      if (seller) {
        await recordLeadEvent(client, { leadId: inserted.id, eventType: "SELLER_ASSIGNED", actorType: "system", actorId: String(seller.id) });
      }

      return {
        ok: true,
        leadId: inserted.id,
        leadCode: inserted.lead_code,
        unit,
        flowType,
        deduped: false,
        seller: seller ? { id: seller.id, name: seller.name, whatsapp: seller.whatsapp } : null,
      };
    });
    await flushAudit();
    return result;
  } catch (err) {
    console.error("[sales-leads] falha ao criar lead:", err.message);
    if (err.code === "NO_ACTIVE_SELLER") {
      return { ok: false, code: "NO_ACTIVE_SELLER", reason: "Nenhum vendedor ativo em Campo Grande." };
    }
    return { ok: false, reason: "Nao foi possivel criar o lead." };
  }
};

// Liga o carrinho rastreado (Backend.js/cartStore.js) ao lead criado a partir dele - so chamado
// para o fluxo CART e so quando o cliente enviou um cartCode (rastreio opcional, com
// consentimento de analytics). Nunca bloqueia/atrasa a criacao do lead: e chamado DEPOIS do
// lead ja criado, e uma falha aqui so fica em log (o lead em si ja foi confirmado ao cliente).
export const linkCartToLead = async ({ cartCode, leadId }) => {
  if (!cartCode || !leadId) return;

  try {
    await markCartConverted({ cartCode, leadId });
  } catch (err) {
    console.error("[sales-leads] falha ao vincular carrinho ao lead:", err.message);
  }
};

// Rate limit deste endpoint agora e feito em app/api/leads/route.js via
// Backend.js/rateLimiter.js (Postgres, distribuido entre instancias serverless - ver auditoria
// de seguranca). O limitador em memoria que existia aqui foi removido por nao ser suficiente
// nesse cenario (instancias diferentes nao compartilhavam o Map()).

// --- Diagnostico (uso interno/CLI futuro - nao expor como endpoint publico) ------------------

export const countActiveSellers = async () => {
  if (!isDatabaseConfigured()) return 0;
  const { rows } = await query("SELECT COUNT(*)::int AS count FROM sales_sellers WHERE active = TRUE");
  return rows[0]?.count ?? 0;
};
