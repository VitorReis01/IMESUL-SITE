import { randomBytes } from "node:crypto";

// Centraliza a sessão admin em memória e protege as APIs internas do painel.
// As rotas de login e analytics usam este módulo para validar acesso administrativo.
const adminSessions = new Map();
const adminLoginAttempts = new Map();
const sessionTtlMs = 8 * 60 * 60 * 1000;
const rateWindowMs = 15 * 60 * 1000;
const maxAttemptsPerWindow = 8;

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

export const checkAdminRateLimit = (ipKey = "unknown") => {
  const now = Date.now();
  const current = adminLoginAttempts.get(ipKey);

  if (!current || current.resetAt <= now) {
    adminLoginAttempts.set(ipKey, { count: 0, resetAt: now + rateWindowMs });
    return { allowed: true, remaining: maxAttemptsPerWindow };
  }

  return {
    allowed: current.count < maxAttemptsPerWindow,
    remaining: Math.max(maxAttemptsPerWindow - current.count, 0),
  };
};

// Reduz tentativa de força bruta sem expor IP completo em resposta ao navegador.
export const registerFailedAdminAttempt = (ipKey = "unknown") => {
  const now = Date.now();
  const current = adminLoginAttempts.get(ipKey);

  if (!current || current.resetAt <= now) {
    adminLoginAttempts.set(ipKey, { count: 1, resetAt: now + rateWindowMs });
    return;
  }

  adminLoginAttempts.set(ipKey, {
    ...current,
    count: current.count + 1,
  });
};

export const resetAdminRateLimit = (ipKey = "unknown") => {
  adminLoginAttempts.delete(ipKey);
};
