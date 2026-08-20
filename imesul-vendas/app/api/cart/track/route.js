import { upsertCartSession } from "../../../../Backend.js/cartStore";
import { checkGlobalApiRateLimit, checkRateLimitLayers } from "../../../../Backend.js/rateLimiter";
import {
  checkOrigin,
  forbidden,
  getRequestIp,
  hasValidJsonContentType,
  methodNotAllowed as sharedMethodNotAllowed,
  noStoreJson,
} from "../../../../Backend.js/requestGuards";

// Sincroniza o carrinho no servidor para métricas de abandono (GERAL, seção "carrinho" do
// relatório desta fase). O cliente só chama esta rota depois de consentimento de analytics
// (ver lib/cartTracking.js) e sempre com debounce/batching - nunca a cada clique de
// quantidade, para não consumir o orçamento do rate limit global compartilhado com /api/leads.
const methodNotAllowed = () => sharedMethodNotAllowed("POST");

const serviceUnavailable = () =>
  noStoreJson({ ok: false, error: "Serviço temporariamente indisponível." }, { status: 503 });

export async function POST(request) {
  if (!checkOrigin(request, { requireOriginInProduction: true }).allowed) return forbidden();
  if (!hasValidJsonContentType(request)) {
    return noStoreJson({ ok: false, error: "Content-Type inválido." }, { status: 415 });
  }

  let globalLimit;
  try {
    globalLimit = await checkGlobalApiRateLimit(request);
  } catch {
    return serviceUnavailable();
  }
  if (!globalLimit.allowed) {
    return noStoreJson(
      { ok: false, error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(globalLimit.retryAfterSeconds) } }
    );
  }

  // Chave/janela PRÓPRIAS desta rota (nunca compartilhada com a de /api/leads) - garante que o
  // rastreio opcional de carrinho tem seu próprio orçamento e nunca consome o de leads.
  const ip = getRequestIp(request);
  let rateLimit;
  try {
    rateLimit = await checkRateLimitLayers([{ key: `cart-track:${ip}`, windowMs: 60_000, max: 20 }]);
  } catch {
    return serviceUnavailable();
  }
  if (!rateLimit.allowed) {
    return noStoreJson(
      { ok: false, error: "Muitas requisições. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 20_000) {
    return noStoreJson({ ok: false, error: "Carrinho inválido." }, { status: 413 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return noStoreJson({ ok: false, error: "Carrinho inválido." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return noStoreJson({ ok: false, error: "Carrinho inválido." }, { status: 400 });
  }

  try {
    const result = await upsertCartSession({
      cartCode: typeof payload.cartCode === "string" ? payload.cartCode : "",
      visitorId: payload.visitorId,
      unit: payload.unit,
      origin: payload.origin,
      source: payload.source,
      items: payload.items,
    });

    if (!result.ok) {
      return noStoreJson({ ok: false, error: "Rastreio de carrinho indisponível." }, { status: 503 });
    }

    return noStoreJson({ ok: true, cartCode: result.cartCode });
  } catch {
    return noStoreJson({ ok: false, error: "Não foi possível sincronizar o carrinho." }, { status: 500 });
  }
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
