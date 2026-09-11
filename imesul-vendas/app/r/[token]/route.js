import { consumeHandoffToken } from "../../../Backend.js/handoffStore";
import { checkGlobalApiRateLimit, checkRateLimitLayers } from "../../../Backend.js/rateLimiter";
import { getRequestIp } from "../../../Backend.js/requestGuards";

// Token legítimo é sempre randomBytes(32).toString("base64url") (ver lib/handoffTokens.js) - 43
// caracteres exatos. A folga aqui é generosa o bastante para nunca rejeitar um token real, só
// corta payloads absurdos (milhares de caracteres) ANTES de gastar hash SHA-256 + round-trip no
// Postgres com eles - custo zero para o caso legítimo, fecha uma forma barata de flood.
const maxTokenLength = 128;

const noStore = (body, init = {}) =>
  new Response(body, { ...init, headers: { "Cache-Control": "no-store", ...(init.headers || {}) } });

// Rota pública que consulta e escreve no banco (ver Backend.js/handoffStore.js#consumeHandoffToken)
// e redireciona para o WhatsApp de um vendedor real - sem limite algum, um flood contra
// /r/<qualquer-coisa> vira flood direto no Postgres. Duas camadas, iguais em espírito às já
// usadas em outras rotas públicas deste projeto: uma global compartilhada (api:global, mesma de
// toda /api) e uma específica desta rota com burst curto + janela de 1 minuto. FAIL CLOSED: se o
// Postgres do rate limiter falhar, trata como bloqueado (nunca libera a rota só porque o rate
// limiter caiu - ver Backend.js/rateLimiter.js).
const checkHandoffRateLimit = async (request) => {
  const globalLimit = await checkGlobalApiRateLimit(request);
  if (!globalLimit.allowed) return globalLimit;

  return checkRateLimitLayers([
    { key: `handoff-token:burst:${getRequestIp(request)}`, windowMs: 10_000, max: 10 },
    { key: `handoff-token:minute:${getRequestIp(request)}`, windowMs: 60_000, max: 30 },
  ]);
};

export async function GET(request, { params }) {
  const token = params?.token;
  if (!token) return noStore("Link inválido.", { status: 400 });
  if (token.length > maxTokenLength) return noStore("Link inválido.", { status: 400 });

  let rateLimit;
  try {
    rateLimit = await checkHandoffRateLimit(request);
  } catch {
    return noStore("Não foi possível abrir o atendimento agora.", { status: 503 });
  }
  if (!rateLimit.allowed) {
    return noStore("Muitas solicitações. Tente novamente em instantes.", {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    });
  }

  try {
    const result = await consumeHandoffToken(token);
    if (!result.ok) return noStore(result.reason || "Link indisponível.", { status: result.status || 400 });

    // Redirect construído manualmente (em vez de Response.redirect) só para poder anexar
    // Cache-Control: no-store também aqui - o destino é dinâmico (WhatsApp do vendedor sorteado),
    // nunca deve ser cacheado por navegador/proxy intermediário.
    return new Response(null, {
      status: 302,
      headers: { Location: result.redirectUrl, "Cache-Control": "no-store" },
    });
  } catch {
    return noStore("Não foi possível abrir o atendimento agora.", { status: 503 });
  }
}
