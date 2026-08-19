import { invalidateAdminSession } from "../../../../Backend.js/adminSecurity";
import { checkGlobalApiRateLimit, checkRateLimitLayers } from "../../../../Backend.js/rateLimiter";
import { getRequestIp, methodNotAllowed as sharedMethodNotAllowed, noStoreJson } from "../../../../Backend.js/requestGuards";

// Revoga a sessao admin no servidor. Sem isto, o botao "Sair do admin" so limpava o token
// em memoria no navegador - o token continuava valido no servidor ate o TTL natural.
const methodNotAllowed = () => sharedMethodNotAllowed("POST");

// Idempotente de proposito: sempre responde ok, mesmo sem token ou com token ja expirado.
// Nao ha nada sensivel a proteger aqui alem do proprio token, que so o dono conhece. Rate limit
// generoso so para nunca aceitar rajada infinita (defesa em profundidade, nao critico aqui).
export async function POST(request) {
  // Camada GLOBAL (compartilhada por TODAS as rotas /api, mesma chave por IP) - ALEM do limite
  // especifico abaixo, nunca no lugar dele. Fail closed aqui (diferente do limite especifico
  // logo abaixo, que permanece fail-open de proposito - ver comentario): a garantia global de
  // "20 req/s nunca passam" nao pode ter excecao so porque o endpoint em si e de baixo risco.
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

  try {
    const rateLimit = await checkRateLimitLayers([
      { key: `admin-logout:${getRequestIp(request)}`, windowMs: 60_000, max: 30 },
    ]);
    if (!rateLimit.allowed) {
      return noStoreJson(
        { ok: false, message: "Muitas solicitações. Tente novamente em instantes." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }
  } catch {
    // Rate limiter indisponivel: logout continua sendo processado (baixo risco, idempotente) -
    // o token local ja e descartado pelo cliente independentemente da resposta desta rota.
  }

  try {
    await invalidateAdminSession(request);
  } catch {
    // Falha ao revogar (ex.: banco indisponivel) nao pode travar o logout do lado do cliente;
    // o token local ja e descartado independentemente da resposta desta rota.
  }
  return noStoreJson({ ok: true });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
