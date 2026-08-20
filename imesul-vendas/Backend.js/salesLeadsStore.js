import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { isDatabaseConfigured, query, withTransaction } from "./db";
import { markCartConverted } from "./cartStore";
import { recordLeadEvent } from "./imebotStore";
import {
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
const dedupWindowMs = 60 * 1000;
const buildIdempotencyKey = (visitorId, quoteSummary) => {
  const timeBucket = Math.floor(Date.now() / dedupWindowMs);
  return createHash("sha256").update(`${visitorId}|${quoteSummary}|${timeBucket}`).digest("hex").slice(0, 40);
};

const findLeadByIdempotencyKey = async (client, idempotencyKey) => {
  const { rows } = await client.query(
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

// FOR UPDATE SKIP LOCKED (nao FOR UPDATE simples): sob concorrencia, duas transacoes que
// tentassem travar a MESMA linha (o vendedor ha mais tempo sem receber lead) fariam a segunda
// esperar a primeira commitar e, sob READ COMMITTED, o Postgres devolveria a MESMA linha ja
// atualizada para a segunda transacao - ou seja, os dois leads simultaneos cairiam no mesmo
// vendedor, exatamente o bug que o rodizio precisa evitar. SKIP LOCKED faz a segunda transacao
// pular a linha ja travada e pegar o PROXIMO vendedor da fila imediatamente, sem esperar.
// Retorna null quando nao ha nenhum vendedor ativo cadastrado (para a unidade pedida, se houver),
// ou (caso raro) quando todos os candidatos estao momentaneamente travados por outras transacoes
// concorrentes - o lead ainda e criado, so sem seller_id (ver createLead).
//
// unit e OPCIONAL de proposito: quando informada, o filtro e ESTRITO (so vendedores daquela
// unidade) - nunca cai silenciosamente para vendedor de outra unidade (exigencia explicita desta
// fase). Sem unit (fluxo legado/sem unidade conhecida), usa o pool geral de vendedores ativos,
// exatamente como antes desta fase.
//
// CORREÇÃO DE ESCOPO (instrução explícita do usuário): rodízio ativo SOMENTE para
// unit = "campo-grande" nesta fase. unit = "dourados" NUNCA aciona rodízio - devolve null direto,
// sem nem consultar sales_sellers, preservando o fluxo comercial atual de Dourados (o frontend
// cai no WhatsApp padrão já existente). Isso vale mesmo que, no futuro, alguém cadastre um
// vendedor com unit = "dourados" no banco: a automação para Dourados só deve ligar depois de uma
// nova instrução explícita, nunca silenciosamente por causa de um cadastro no banco.
const assignNextSeller = async (client, unit = null) => {
  if (unit && !isCommercialAutomationEnabledForUnit(unit)) return null;

  const { rows } = await client.query(
    unit
      ? `SELECT id, name, whatsapp
           FROM sales_sellers
          WHERE active = TRUE AND unit = $1
          ORDER BY last_assigned_at ASC NULLS FIRST, id ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED`
      : `SELECT id, name, whatsapp
           FROM sales_sellers
          WHERE active = TRUE
          ORDER BY last_assigned_at ASC NULLS FIRST, id ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED`,
    unit ? [unit] : []
  );

  const seller = rows[0];
  if (!seller) return null;

  await client.query("UPDATE sales_sellers SET last_assigned_at = NOW() WHERE id = $1", [seller.id]);
  return seller;
};

// --- Criacao do lead -------------------------------------------------------------------------

// Cria o lead dentro de uma unica transacao: confere dedup, escolhe vendedor (rodizio com lock)
// e insere - tudo ou nada. Nunca lanca para quem chamou: qualquer falha (banco fora do ar, etc.)
// vira {ok:false}, e a rota (app/api/leads/route.js) devolve isso ao frontend, que cai no
// WhatsApp padrao existente.
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
  const idempotencyKey = buildIdempotencyKey(visitorId, quoteSummary);

  // Nunca confia cegamente em flowType/unit/siteOrigin vindos do payload: cai para um valor
  // seguro conhecido se o valor enviado nao estiver na allowlist (ver lib/leadFlow.js).
  const flowType = isValidLeadFlowType(payload.flowType) ? payload.flowType : LEAD_FLOW_TYPES.GUIDED_QUOTE;
  const siteOrigin = payload.siteOrigin === LEAD_SITE_ORIGIN.INSTITUCIONAL
    ? LEAD_SITE_ORIGIN.INSTITUCIONAL
    : allowWhatsappOrigin && payload.siteOrigin === LEAD_SITE_ORIGIN.WHATSAPP
      ? LEAD_SITE_ORIGIN.WHATSAPP
      : LEAD_SITE_ORIGIN.VENDAS;
  const unit = isValidCommercialUnit(payload.unit) ? payload.unit : null;
  const pagePath = safeString(payload.pagePath, "", 180);

  try {
    return await withTransaction(async (client) => {
      const existingLead = await findLeadByIdempotencyKey(client, idempotencyKey);
      if (existingLead) return existingLead;

      const seller = await assignNextSeller(client, unit);

      let inserted = null;
      let lastError = null;

      for (let attempt = 0; attempt < maxLeadCodeAttempts && !inserted; attempt += 1) {
        const leadCode = generateLeadCode();

        try {
          const { rows } = await client.query(
            `INSERT INTO sales_leads
               (lead_code, visitor_id, seller_id, customer_name, customer_phone, customer_email,
                origin, source, utm, product, quote_summary, idempotency_key,
                flow_type, site_origin, unit, page_path, customer_phone_source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17)
             RETURNING id, lead_code`,
            [
              leadCode,
              visitorId,
              seller?.id ?? null,
              safeString(payload.customerName, "", 120),
              safeString(payload.customerPhone, "", 40),
              safeString(payload.customerEmail, "", 160),
              safeString(payload.origin, "", 180),
              safeString(payload.source, "", 180),
              JSON.stringify(safeUtm(payload.utm)),
              safeString(payload.product, "", 200),
              quoteSummary,
              idempotencyKey,
              flowType,
              siteOrigin,
              unit,
              pagePath,
              siteOrigin === LEAD_SITE_ORIGIN.WHATSAPP
                ? CUSTOMER_PHONE_SOURCE.META_INBOUND
                : safeString(payload.customerPhone, "", 40)
                  ? CUSTOMER_PHONE_SOURCE.LEAD_FORM
                  : null,
            ]
          );
          inserted = rows[0];
        } catch (err) {
          // 23505 = unique_violation (Postgres). Duas causas possiveis aqui:
          // - colisao no lead_code (extremamente rara): tenta de novo com outro codigo.
          // - colisao na idempotency_key: outra requisicao concorrente com o MESMO clique/retry
          //   ja criou o lead entre a checagem acima e este INSERT - busca e devolve ela.
          if (err.code === "23505" && String(err.constraint || "").includes("idempotency_key")) {
            const concurrentLead = await findLeadByIdempotencyKey(client, idempotencyKey);
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
  } catch (err) {
    console.error("[sales-leads] falha ao criar lead:", err.message);
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
