import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Valida a assinatura x-hub-signature-256 dos webhooks da Meta (WhatsApp Cloud API) - HMAC-SHA256
// do corpo cru da requisição, usando META_APP_SECRET. NUNCA usar JSON.stringify(req.json()) para
// recalcular a assinatura - precisa ser exatamente os bytes crus recebidos, antes de qualquer
// parse (por isso a rota do webhook lê request.text() primeiro, nunca request.json() direto).
export const verifyMetaSignature = (rawBody, signatureHeader) => {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return { ok: false, reason: "META_APP_SECRET não configurado." };

  const header = String(signatureHeader || "");
  if (!header.startsWith("sha256=")) return { ok: false, reason: "Assinatura ausente ou em formato inválido." };

  const providedHex = header.slice("sha256=".length).trim();
  if (!/^[0-9a-f]{64}$/i.test(providedHex)) return { ok: false, reason: "Assinatura em formato inválido." };

  const expectedHex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const providedBuf = Buffer.from(providedHex, "hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return { ok: false, reason: "Assinatura não confere." };
  }

  return { ok: true };
};
