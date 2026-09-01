import { isAdminRequest } from "../../../../Backend.js/adminSecurity";
import { clearAnalyticsEvents } from "../../../../Backend.js/analyticsStore";
import { checkGlobalApiRateLimit, checkRateLimitLayers } from "../../../../Backend.js/rateLimiter";
import { checkOrigin, forbidden, getRequestIp, methodNotAllowed as sharedMethodNotAllowed, noStoreJson } from "../../../../Backend.js/requestGuards";

// Limpa eventos locais apenas a partir do painel admin autenticado.
const methodNotAllowed = () => sharedMethodNotAllowed("DELETE");

export async function DELETE(request) {
  // Sessão via cookie HttpOnly SameSite=Strict - ação MUTÁVEL (apaga dados), então exige Origin
  // em produção (mesmo padrão de /api/admin/login) além do SameSite=Strict do cookie, que já
  // impede o navegador de enviar o cookie numa requisição cross-site (ver relatório de hardening,
  // seção CSRF - por que essa camada é suficiente sem um token CSRF dedicado).
  if (!checkOrigin(request, { requireOriginInProduction: true }).allowed) return forbidden();

  try {
    // Falha ao verificar a sessao (ex.: banco indisponivel) nunca deve liberar acesso -
    // trata como nao autorizado (fail-closed), nunca deixa o erro estourar sem resposta.
    if (!(await isAdminRequest(request))) {
      return noStoreJson({ ok: false, message: "Acesso não autorizado." }, { status: 401 });
    }
  } catch {
    return noStoreJson({ ok: false, message: "Acesso não autorizado." }, { status: 401 });
  }

  // Camada GLOBAL (compartilhada por TODAS as rotas /api, mesma chave por IP) - ALEM do limite
  // especifico abaixo, nunca no lugar dele. Ver Backend.js/rateLimiter.js.
  try {
    const globalLimit = await checkGlobalApiRateLimit(request);
    if (!globalLimit.allowed) {
      return noStoreJson(
        { ok: false, message: "Muitas solicitações. Tente novamente em instantes." },
        { status: 429, headers: { "Retry-After": String(globalLimit.retryAfterSeconds) } }
      );
    }
  } catch {
    return noStoreJson({ ok: false, message: "Serviço temporariamente indisponível." }, { status: 503 });
  }

  // Defesa em profundidade: mesmo com sessao valida, um token comprometido nao deveria
  // conseguir disparar limpezas em rajada.
  try {
    const rateLimit = await checkRateLimitLayers([
      { key: `analytics-clear:${getRequestIp(request)}`, windowMs: 60_000, max: 5 },
    ]);
    if (!rateLimit.allowed) {
      return noStoreJson(
        { ok: false, message: "Muitas solicitações. Tente novamente em instantes." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }
  } catch {
    return noStoreJson({ ok: false, message: "Serviço temporariamente indisponível." }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const visitorId = (searchParams.get("visitorId") || "").slice(0, 120);
    await clearAnalyticsEvents({ visitorId });

    return noStoreJson({ ok: true });
  } catch {
    return noStoreJson({ ok: false, message: "Não foi possível limpar os eventos." }, { status: 500 });
  }
}

export const GET = methodNotAllowed;
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
