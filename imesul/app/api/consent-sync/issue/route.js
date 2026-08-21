import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

const maxAgeMs = 2 * 60 * 1000;

const secret = () => process.env.CONSENT_SYNC_SECRET || "";

const base64url = (value) => Buffer.from(value).toString("base64url");

const sign = (payload) => createHmac("sha256", secret()).update(payload).digest("base64url");

const isValidBoolean = (value) => typeof value === "boolean";

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
