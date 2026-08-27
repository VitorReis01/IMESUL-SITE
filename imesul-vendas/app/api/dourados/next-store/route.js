import { getNextDouradosDestination } from "../../../../Backend.js/douradosAlternatorStore";
import { checkGlobalApiRateLimit, checkRateLimitLayers } from "../../../../Backend.js/rateLimiter";
import {
  checkOrigin,
  forbidden,
  getRequestIp,
  methodNotAllowed as sharedMethodNotAllowed,
  noStoreJson,
} from "../../../../Backend.js/requestGuards";

// Alternador 1-por-1 Dourados Centro/Fabrica (arquitetura territorial - ver
// lib/commercialRegions.js e lib/douradosDispatch.js). NAO cria lead, NAO aciona IMEbot/rodizio.
// Sem corpo de requisicao: o cliente so pede "qual e o proximo destino" - nada sobre o visitante
// e enviado nem armazenado. So chamada pelo proprio site de vendas (mesma origem) - ao contrario
// de /api/leads, nao precisa de headers CORS (nunca chamada cross-origin pelo institucional).
const methodNotAllowed = () => sharedMethodNotAllowed("POST");

const serviceUnavailable = () =>
  noStoreJson({ ok: false, error: "Serviço temporariamente indisponível." }, { status: 503 });

export async function POST(request) {
  if (!checkOrigin(request, { requireOriginInProduction: true }).allowed) return forbidden();

  let globalLimit;
  try {
    globalLimit = await checkGlobalApiRateLimit(request);
  } catch {
    return serviceUnavailable();
  }
  if (!globalLimit.allowed) {
    return noStoreJson(
      { ok: false, error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(Math.max(globalLimit.retryAfterSeconds, 1)) } }
    );
  }

  // Camada especifica desta rota, alem da global - mesmo padrao de /api/cart/track. Generosa o
  // suficiente para nao travar clientes reais (varias abas, retry de rede), restritiva o
  // suficiente para nao virar um jeito barato de esgotar o rate limit global.
  const ip = getRequestIp(request);
  let rateLimit;
  try {
    rateLimit = await checkRateLimitLayers([
      { key: `dourados-next-store:burst:${ip}`, windowMs: 10_000, max: 3 },
      { key: `dourados-next-store:minute:${ip}`, windowMs: 60_000, max: 10 },
    ]);
  } catch {
    return serviceUnavailable();
  }
  if (!rateLimit.allowed) {
    return noStoreJson(
      { ok: false, error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(Math.max(rateLimit.retryAfterSeconds, 1)) } }
    );
  }

  try {
    const store = await getNextDouradosDestination();
    return noStoreJson({ ok: true, store });
  } catch {
    return noStoreJson({ ok: false, error: "Não foi possível determinar o destino." }, { status: 500 });
  }
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
