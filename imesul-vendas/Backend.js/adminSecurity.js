import { randomBytes, timingSafeEqual } from "node:crypto";

// Centraliza a sessão admin e a proteção contra brute force/abuso do login.
// As rotas de login e analytics usam este módulo para validar acesso administrativo.
const adminSessions = new Map();
const sessionTtlMs = 8 * 60 * 60 * 1000;

const getBearerToken = (request) => {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
};

const cleanupExpiredSessions = () => {
  const now = Date.now();
  adminSessions.forEach((session, token) => {
    if (session.expiresAt <= now) adminSessions.delete(token);
  });
};

// Sessao admin de demonstracao em memoria. Em producao, usar cookies seguros e armazenamento persistente.
export const createAdminSession = () => {
  cleanupExpiredSessions();
  const token = randomBytes(32).toString("hex");
  adminSessions.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + sessionTtlMs,
  });
  return token;
};

export const isAdminRequest = (request) => {
  cleanupExpiredSessions();
  const token = getBearerToken(request);
  return Boolean(token && adminSessions.has(token));
};

// Revoga a sessao no servidor no logout: sem isso, um token capturado antes do logout
// (XSS, extensao maliciosa, rede comprometida) continuaria valido ate o TTL natural (8h).
// Idempotente: chamar sem token ou com token ja expirado nao tem efeito nem gera erro.
export const invalidateAdminSession = (request) => {
  const token = getBearerToken(request);
  if (token) adminSessions.delete(token);
};

// Compara sem revelar por tempo de execução se o valor está parcialmente correto.
// Nunca lança por tamanho diferente (isso já vazaria informação pelo tipo de erro).
export const safeCompare = (a, b) => {
  const bufA = Buffer.from(String(a ?? ""), "utf8");
  const bufB = Buffer.from(String(b ?? ""), "utf8");

  if (bufA.length !== bufB.length) {
    // Roda uma comparação de custo equivalente para não vazar o tamanho pelo tempo de resposta.
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
};

// Limitador de janela deslizante reutilizável. Estado fica em memória do processo:
// não é compartilhado entre instâncias serverless (ver nota no relatório de hardening).
const maxTrackedKeysPerLimiter = 5000;

const createSlidingWindowLimiter = ({ windowMs, max }) => {
  const hits = new Map();

  const cleanupIfLarge = (now) => {
    if (hits.size < maxTrackedKeysPerLimiter) return;
    hits.forEach((entry, key) => {
      if (entry.resetAt <= now) hits.delete(key);
    });
  };

  const check = (key) => {
    const now = Date.now();
    cleanupIfLarge(now);
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    return {
      allowed: current.count < max,
      retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
    };
  };

  const hit = (key) => {
    const now = Date.now();
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    current.count += 1;
  };

  const reset = (key) => hits.delete(key);

  return { check, hit, reset };
};

// Camadas de rate limit do login, cada uma cobrindo uma escala de tempo diferente.
// Não depender de um único limite: a camada mais restritiva no momento decide o bloqueio.
// Números pensados para um painel administrativo usado por poucas pessoas (não um SaaS público):
// - burst: barra scripts disparando dezenas de requisições por segundo.
// - medium: barra brute force sustentado por alguns minutos, mas ainda tolera alguns typos reais.
// - long: pega abuso lento/persistente que tenta escapar das janelas curtas.
const burstLimiter = createSlidingWindowLimiter({ windowMs: 10 * 1000, max: 5 });
const mediumLimiter = createSlidingWindowLimiter({ windowMs: 10 * 60 * 1000, max: 10 });
const longLimiter = createSlidingWindowLimiter({ windowMs: 60 * 60 * 1000, max: 30 });

// IP + usuário informado: pega brute force contra UMA conta específica vindo de UM IP,
// mesmo quando o limite geral por IP ainda não estourou (ex.: IP compartilhado por várias pessoas).
const ipUsernameLimiter = createSlidingWindowLimiter({ windowMs: 10 * 60 * 1000, max: 6 });

// Usuário informado, independente do IP: sinaliza brute force distribuído (muitos IPs, mesma conta).
// Propositalmente NUNCA bloqueia o login — só aciona atraso e telemetria (ver getAccountFrictionDelayMs).
// Um atacante não pode conseguir "desligar" o acesso do admin legítimo só errando a senha de propósito.
const accountLimiter = createSlidingWindowLimiter({ windowMs: 10 * 60 * 1000, max: 20 });
const accountFrictionLoggedAt = new Map();

// Telemetria global (todas as falhas de login, qualquer IP/usuário): só gera um log agregado,
// nunca bloqueia. Serve para observabilidade de um possível ataque coordenado, não como circuit breaker.
const globalFailureLimiter = createSlidingWindowLimiter({ windowMs: 60 * 1000, max: 50 });
let globalAlertLoggedAt = 0;

const normalizeUsernameKey = (user = "") => String(user).trim().toLowerCase().slice(0, 190) || "(vazio)";

// Checagem barata (só IP), feita ANTES de tocar no corpo da requisição.
export const checkIpRateLimit = (ipKey = "unknown") => {
  const checks = [burstLimiter.check(ipKey), mediumLimiter.check(ipKey), longLimiter.check(ipKey)];
  const blocked = checks.find((item) => !item.allowed);
  return blocked ? { allowed: false, retryAfterSeconds: blocked.retryAfterSeconds } : { allowed: true, retryAfterSeconds: 0 };
};

// Checagem por IP+usuário, feita depois de validar o corpo (já sabemos o usuário informado).
export const checkUsernameRateLimit = (ipKey = "unknown", username = "") => {
  const usernameKey = normalizeUsernameKey(username);
  return ipUsernameLimiter.check(`${ipKey}::${usernameKey}`);
};

// Chamar somente após uma tentativa que efetivamente rodou (nunca depois de já ter bloqueado antes).
export const registerFailedAdminAttempt = (ipKey = "unknown", username = "") => {
  const usernameKey = normalizeUsernameKey(username);
  burstLimiter.hit(ipKey);
  mediumLimiter.hit(ipKey);
  longLimiter.hit(ipKey);
  ipUsernameLimiter.hit(`${ipKey}::${usernameKey}`);
  accountLimiter.hit(usernameKey);
  globalFailureLimiter.hit("*");

  const globalState = globalFailureLimiter.check("*");
  if (!globalState.allowed && globalAlertLoggedAt < Date.now() - 60_000) {
    globalAlertLoggedAt = Date.now();
    // Log agregado apenas: nao bloqueia nada, serve so de sinal para observabilidade.
    console.warn("[security] login-admin: muitas falhas em pouco tempo (varios IPs) - possivel ataque coordenado");
  }
};

export const resetAdminRateLimit = (ipKey = "unknown", username = "") => {
  const usernameKey = normalizeUsernameKey(username);
  burstLimiter.reset(ipKey);
  mediumLimiter.reset(ipKey);
  longLimiter.reset(ipKey);
  ipUsernameLimiter.reset(`${ipKey}::${usernameKey}`);
  accountLimiter.reset(usernameKey);
};

// Atraso (ms) a aplicar quando a MESMA conta apanha muitas tentativas vindas de vários IPs.
// Não bloqueia a conta: só atrasa a resposta e loga uma vez por janela.
export const getAccountFrictionDelayMs = (username = "") => {
  const usernameKey = normalizeUsernameKey(username);
  const state = accountLimiter.check(usernameKey);
  if (state.allowed) return 0;

  const lastLoggedAt = accountFrictionLoggedAt.get(usernameKey) || 0;
  if (lastLoggedAt < Date.now() - 60_000) {
    accountFrictionLoggedAt.set(usernameKey, Date.now());
    console.warn("[security] login-admin: possivel brute force distribuido contra a mesma conta (varios IPs)");
  }

  return 1500;
};
