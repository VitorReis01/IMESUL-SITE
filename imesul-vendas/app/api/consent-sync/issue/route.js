import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { checkGlobalApiRateLimit, checkRateLimitLayers } from "../../../../Backend.js/rateLimiter";
import { getRequestIp, readJsonBodyWithLimit } from "../../../../Backend.js/requestGuards";

const maxAgeMs = 2 * 60 * 1000;
// Payload real e so {analytics, location} (~40 bytes) - a folga e generosa o bastante para
// nunca quebrar o fluxo institucional<->vendas, mas fecha o corpo ilimitado que a auditoria
// FULL-SCOPE encontrou (rota nunca teve limite de tamanho nem rate limit - ver relatorio).
const maxBodyBytes = 2_000;

const secret = () => process.env.CONSENT_SYNC_SECRET || "";

const base64url = (value) => Buffer.from(value).toString("base64url");

const sign = (payload) => createHmac("sha256", secret()).update(payload).digest("base64url");

const isValidBoolean = (value) => typeof value === "boolean";

const serviceUnavailable = () =>
  NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });

export async function POST(request) {
  if (!secret()) return serviceUnavailable();

  // Camada GLOBAL (compartilhada por TODAS as rotas /api) + limite especifico desta rota -
  // rota so emite um token de curta duracao (2min), nunca muda dado nenhum, entao o limite pode
  // ser generoso sem abrir espaco real de abuso.
  try {
    const globalLimit = await checkGlobalApiRateLimit(request);
    if (!globalLimit.allowed) {
      return NextResponse.json(
        { ok: false },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.max(globalLimit.retryAfterSeconds, 1)) } }
      );
    }

    const rateLimit = await checkRateLimitLayers([
      { key: `consent-sync-issue:${getRequestIp(request)}`, windowMs: 60_000, max: 30 },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { ok: false },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.max(rateLimit.retryAfterSeconds, 1)) } }
      );
    }
  } catch {
    return serviceUnavailable();
  }

  const bodyResult = await readJsonBodyWithLimit(request, maxBodyBytes);
  if (bodyResult.status === "too_large") {
    return NextResponse.json({ ok: false }, { status: 413, headers: { "Cache-Control": "no-store" } });
  }
  if (bodyResult.status === "invalid_json") {
    return NextResponse.json({ ok: false }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const body = bodyResult.body;
  if (!isValidBoolean(body?.analytics) || !isValidBoolean(body?.location)) {
    return NextResponse.json({ ok: false }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const payload = base64url(JSON.stringify({
    v: 1,
    analytics: body.analytics,
    location: body.location,
    exp: Date.now() + maxAgeMs,
  }));

  return NextResponse.json({ ok: true, token: `${payload}.${sign(payload)}` }, { headers: { "Cache-Control": "no-store" } });
}
