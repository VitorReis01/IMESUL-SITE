import "server-only";
import { randomBytes } from "node:crypto";
import { isDatabaseConfigured, query } from "./db";
import { isValidCommercialUnit } from "../lib/leadFlow";

// Rastreio de carrinho abandonado (servidor) - SO grava quando o visitante consentiu com
// analytics (checagem de consentimento é feita no cliente antes de chamar a API; ver
// lib/cartTracking.js e o relatório desta fase: sem consentimento, esta tabela nunca recebe
// dados desse visitante). O carrinho FUNCIONAL (localStorage, lib/cart.js) nunca depende disto.
// Sem DATABASE_URL: sincronizar carrinho vira no-op (retorna ok:false), nunca quebra o carrinho
// local nem o checkout - mesma filosofia de "falha de rastreio nunca bloqueia o cliente" usada
// no restante do projeto (ver salesLeadsStore.js).

const cartCodeAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const cartCodeLength = 10;
const maxCartCodeAttempts = 5;

const generateCartCode = () => {
  const bytes = randomBytes(cartCodeLength);
  let code = "";
  for (let i = 0; i < cartCodeLength; i += 1) {
    code += cartCodeAlphabet[bytes[i] % cartCodeAlphabet.length];
  }
  return `CART-${code}`;
};

const safeString = (value, fallback = "", limit = 500) =>
  typeof value === "string" ? value.slice(0, limit) : fallback;

const maxCartTrackItems = 60;

// Reaproveita so os campos tecnicos ja usados pelo carrinho local (lib/cart.js) - nunca aceita
// nome/telefone/e-mail/qualquer PII vindos deste payload (ver auditoria de segurança).
const sanitizeItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items.slice(0, maxCartTrackItems).map((item) => ({
    categoryId: safeString(item?.categoryId, "", 120),
    categoryName: safeString(item?.categoryName, "", 160),
    productId: safeString(item?.productId, "", 120),
    productName: safeString(item?.productName, "", 200),
    measure: safeString(item?.measure, "", 80),
    thickness: safeString(item?.thickness, "", 80),
    length: safeString(item?.length, "", 80),
    details: safeString(item?.details, "", 300),
    quantity: Number.isFinite(Number(item?.quantity)) ? Math.max(0, Math.min(Number(item.quantity), 100000)) : 0,
  }));
};

// cartCode vazio/invalido = criar uma sessao nova. Colisao real de UNIQUE (extremamente rara,
// mesmo padrao de generateLeadCode em salesLeadsStore.js) tenta outro codigo em vez de falhar.
export async function upsertCartSession({ cartCode, visitorId, unit, origin, source, items }) {
  if (!isDatabaseConfigured()) return { ok: false };

  const safeVisitorId = safeString(visitorId, "visitor-unavailable", 140);
  const safeUnit = isValidCommercialUnit(unit) ? unit : null;
  const safeOrigin = safeString(origin, "", 180);
  const safeSource = safeString(source, "", 180);
  const safeItems = sanitizeItems(items);
  const status = safeItems.some((item) => item.quantity > 0) ? "ACTIVE" : "ACTIVE";

  if (cartCode && /^CART-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/.test(cartCode)) {
    const { rows } = await query(
      `UPDATE cart_sessions
       SET visitor_id = $2, unit = COALESCE($3, unit), origin = CASE WHEN $4 <> '' THEN $4 ELSE origin END,
           source = CASE WHEN $5 <> '' THEN $5 ELSE source END, items = $6::jsonb,
           status = CASE WHEN status = 'CONVERTED' THEN status ELSE $7 END,
           updated_at = NOW(), last_activity_at = NOW()
       WHERE cart_code = $1
       RETURNING cart_code`,
      [cartCode, safeVisitorId, safeUnit, safeOrigin, safeSource, JSON.stringify(safeItems), status]
    );

    if (rows[0]) return { ok: true, cartCode: rows[0].cart_code };
    // cartCode informado nao existe (ex.: limpo manualmente no banco) - cria uma sessao nova.
  }

  for (let attempt = 0; attempt < maxCartCodeAttempts; attempt += 1) {
    const candidateCode = generateCartCode();
    try {
      const { rows } = await query(
        `INSERT INTO cart_sessions (cart_code, visitor_id, unit, origin, source, items, status)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
         RETURNING cart_code`,
        [candidateCode, safeVisitorId, safeUnit, safeOrigin, safeSource, JSON.stringify(safeItems), status]
      );
      return { ok: true, cartCode: rows[0].cart_code };
    } catch (err) {
      if (err?.code !== "23505") throw err;
    }
  }

  throw new Error("Não foi possível gerar um código de carrinho único.");
}

// Chamado quando o carrinho vira um Lead ID de verdade (checkout do carrinho) - marca a sessao
// como CONVERTED para nunca aparecer como "abandonada" nos relatorios.
export async function markCartConverted({ cartCode, leadId }) {
  if (!isDatabaseConfigured() || !cartCode || !leadId) return;

  await query(
    `UPDATE cart_sessions SET status = 'CONVERTED', converted_lead_id = $2, updated_at = NOW()
     WHERE cart_code = $1`,
    [cartCode, leadId]
  );
}
