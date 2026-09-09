import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { checkGlobalApiRateLimit, checkRateLimitLayers } from "../../../../Backend.js/rateLimiter";
import { getRequestIp, readJsonBodyWithLimit } from "../../../../Backend.js/requestGuards";

// Token real e sempre curto (payload base64url + "." + assinatura sha256, algumas dezenas de
// caracteres) - a folga e generosa o bastante para nunca quebrar o fluxo institucional<->vendas,
// mas fecha o corpo ilimitado que a auditoria FULL-SCOPE encontrou (rota nunca teve limite de
// tamanho nem rate limit - ver relatorio).
const maxBodyBytes = 2_000;

const secret = () => process.env.CONSENT_SYNC_SECRET || "";

const sign = (payload) => createHmac("sha256", secret()).update(payload).digest("base64url");

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const parseToken = (token) => {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed?.v !== 1) return null;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.location !== "boolean") return null;
    if (!Number.isFinite(parsed.exp) || parsed.exp < Date.now()) return null;
    return { analytics: parsed.analytics, location: parsed.location };
  } catch {
    return null;
  }
};

export async function POST(request) {
  if (!secret()) {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const globalLimit = await checkGlobalApiRateLimit(request);
    if (!globalLimit.allowed) {
      return NextResponse.json(
        { ok: false },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.max(globalLimit.retryAfterSeconds, 1)) } }
      );
    }

    const rateLimit = await checkRateLimitLayers([
      { key: `consent-sync-import:${getRequestIp(request)}`, windowMs: 60_000, max: 30 },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { ok: false },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.max(rateLimit.retryAfterSeconds, 1)) } }
      );
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const bodyResult = await readJsonBodyWithLimit(request, maxBodyBytes);
  if (bodyResult.status === "too_large") {
    return NextResponse.json({ ok: false }, { status: 413, headers: { "Cache-Control": "no-store" } });
  }
  if (bodyResult.status === "invalid_json") {
    return NextResponse.json({ ok: false }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const body = bodyResult.body;
  const consent = parseToken(body?.token);
  if (!consent) {
    return NextResponse.json({ ok: false }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ ok: true, consent }, { headers: { "Cache-Control": "no-store" } });
}
