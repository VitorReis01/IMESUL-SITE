import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isDatabaseConfigured, query } from "./db";

// Centraliza a sessão admin e a proteção contra brute force/abuso do login.
// As rotas de login e analytics usam este módulo para validar acesso administrativo.
//
// Sessao: Postgres (admin_sessions) quando DATABASE_URL esta configurada - qualquer instancia
// serverless da Vercel reconhece a mesma sessao e o logout revoga de verdade em todas elas.
// Sem DATABASE_URL, cai no Map() em memoria (so para desenvolvimento - nao sobrevive a
// redeploy/reinicio e nao e compartilhado entre instancias).
const adminSessions = new Map();
const sessionTtlMs = 8 * 60 * 60 * 1000;

const getBearerToken = (request) => {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
};

// NUNCA salvar o token cru: so o hash localiza a sessao no banco. O token continua sendo
// gerado com randomBytes (256 bits) - o hash e so uma chave de busca, nao reduz a entropia
// nem e reversivel para o token original.
const hashToken = (token) => createHash("sha256").update(token).digest("hex");

const cleanupExpiredSessions = () => {
  const now = Date.now();
  adminSessions.forEach((session, token) => {
    if (session.expiresAt <= now) adminSessions.delete(token);
  });
};

// Limpeza oportunistica (nao um DELETE pesado a cada request): so roda ocasionalmente, no
// momento de criar uma sessao nova (login e infrequente). Remove sessoes expiradas ha mais de
// 7 dias e sessoes revogadas ha mais de 7 dias - mantem um rastro curto para auditoria sem
// deixar a tabela crescer indefinidamente.
const opportunisticCleanupChance = 0.05;
const cleanupOldSessionsInDatabase = async () => {
  if (Math.random() > opportunisticCleanupChance) return;

  try {
    await query(
      `DELETE FROM admin_sessions WHERE expires_at < NOW() - INTERVAL '7 days' OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days')`
    );
  } catch (err) {
    console.error("[admin-security] falha na limpeza oportunistica de sessoes:", err.message);
  }
};

// Sessao admin: token aleatorio forte enviado ao cliente; so o SHA-256 dele fica no banco.
export const createAdminSession = async () => {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionTtlMs);

  if (isDatabaseConfigured()) {
    await query("INSERT INTO admin_sessions (token_hash, expires_at) VALUES ($1, $2)", [hashToken(token), expiresAt]);
    cleanupOldSessionsInDatabase();
    return token;
  }

  cleanupExpiredSessions();
  adminSessions.set(token, { createdAt: Date.now(), expiresAt: expiresAt.getTime() });
  return token;
};

export const isAdminRequest = async (request) => {
  const token = getBearerToken(request);
  if (!token) return false;

  if (isDatabaseConfigured()) {
    const result = await query(
      "SELECT 1 FROM admin_sessions WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1",
      [hashToken(token)]
    );
    return result.rowCount > 0;
  }

  cleanupExpiredSessions();
  return adminSessions.has(token);
};

// Revoga a sessao no servidor no logout: sem isso, um token capturado antes do logout
// (XSS, extensao maliciosa, rede comprometida) continuaria valido ate o TTL natural (8h).
// Idempotente: chamar sem token ou com token ja expirado/revogado nao tem efeito nem gera erro.
export const invalidateAdminSession = async (request) => {
  const token = getBearerToken(request);
  if (!token) return;

  if (isDatabaseConfigured()) {
    await query("UPDATE admin_sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL", [hashToken(token)]);
    return;
  }

  adminSessions.delete(token);
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
