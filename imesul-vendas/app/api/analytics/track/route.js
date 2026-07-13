import { NextResponse } from "next/server";
import { addAnalyticsEvent } from "../../../../Backend.js/analyticsStore";

const getFirstForwardedIp = (value = "") => value.split(",")[0]?.trim() || "";

const getRequestIp = (request) =>
  getFirstForwardedIp(request.headers.get("x-forwarded-for") || "") ||
  request.headers.get("x-real-ip") ||
  request.headers.get("cf-connecting-ip") ||
  request.headers.get("fastly-client-ip") ||
  getFirstForwardedIp(request.headers.get("x-vercel-forwarded-for") || "") ||
  request.ip ||
  "não identificado";

export async function POST(request) {
  try {
    const payload = await request.json();
    // O IP é capturado somente no backend e salvo mascarado para preservar privacidade.
    const event = await addAnalyticsEvent({
      ...payload,
      ipRaw: getRequestIp(request),
    });

    return NextResponse.json({ ok: true, event });
  } catch {
    return NextResponse.json({ ok: false, error: "Evento inválido." }, { status: 400 });
  }
}
