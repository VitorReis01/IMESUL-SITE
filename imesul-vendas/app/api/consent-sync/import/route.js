import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const consent = parseToken(body?.token);
  if (!consent) {
    return NextResponse.json({ ok: false }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ ok: true, consent }, { headers: { "Cache-Control": "no-store" } });
}
