import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { isDatabaseConfigured, query, withTransaction } from "./db";

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
    `SELECT sl.lead_code, sl.seller_id, ss.name AS seller_name, ss.whatsapp AS seller_whatsapp
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
    leadCode: row.lead_code,
    deduped: true,
    seller: row.seller_id ? { name: row.seller_name, whatsapp: row.seller_whatsapp } : null,
  };
};

// --- Rodizio de vendedores -------------------------------------------------------------------

// FOR UPDATE SKIP LOCKED (nao FOR UPDATE simples): sob concorrencia, duas transacoes que
// tentassem travar a MESMA linha (o vendedor ha mais tempo sem receber lead) fariam a segunda
// esperar a primeira commitar e, sob READ COMMITTED, o Postgres devolveria a MESMA linha ja
// atualizada para a segunda transacao - ou seja, os dois leads simultaneos cairiam no mesmo
// vendedor, exatamente o bug que o rodizio precisa evitar. SKIP LOCKED faz a segunda transacao
// pular a linha ja travada e pegar o PROXIMO vendedor da fila imediatamente, sem esperar.
// Retorna null quando nao ha nenhum vendedor ativo cadastrado, ou (caso raro) quando todos os
// ativos estao momentaneamente travados por outras transacoes concorrentes - o lead ainda e
// criado, so sem seller_id (ver createLead).
const assignNextSeller = async (client) => {
  const { rows } = await client.query(
    `SELECT id, name, whatsapp
       FROM sales_sellers
      WHERE active = TRUE
      ORDER BY last_assigned_at ASC NULLS FIRST, id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED`
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
export const createLead = async (payload = {}) => {
  if (!isDatabaseConfigured()) {
    return { ok: false, reason: "DATABASE_URL nao configurada." };
  }

  const visitorId = safeString(payload.visitorId, "visitor-unavailable", 140);
  const quoteSummary = safeString(payload.quoteSummary, "", 4000);
  const idempotencyKey = buildIdempotencyKey(visitorId, quoteSummary);

  try {
    return await withTransaction(async (client) => {
      const existingLead = await findLeadByIdempotencyKey(client, idempotencyKey);
      if (existingLead) return existingLead;

      const seller = await assignNextSeller(client);

      let inserted = null;
      let lastError = null;

      for (let attempt = 0; attempt < maxLeadCodeAttempts && !inserted; attempt += 1) {
        const leadCode = generateLeadCode();

        try {
          const { rows } = await client.query(
            `INSERT INTO sales_leads
               (lead_code, visitor_id, seller_id, customer_name, customer_phone, customer_email,
                origin, source, utm, product, quote_summary, idempotency_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
             RETURNING lead_code`,
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

      return {
        ok: true,
        leadCode: inserted.lead_code,
        deduped: false,
        seller: seller ? { name: seller.name, whatsapp: seller.whatsapp } : null,
      };
    });
  } catch (err) {
    console.error("[sales-leads] falha ao criar lead:", err.message);
    return { ok: false, reason: "Nao foi possivel criar o lead." };
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
