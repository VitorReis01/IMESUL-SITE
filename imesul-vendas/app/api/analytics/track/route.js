import { NextResponse } from "next/server";
import { addAnalyticsEvent } from "../../../../Backend.js/analyticsStore";

export async function POST(request) {
  try {
    const payload = await request.json();
    const event = await addAnalyticsEvent(payload);

    return NextResponse.json({ ok: true, event });
  } catch {
    return NextResponse.json({ ok: false, error: "Evento inválido." }, { status: 400 });
  }
}
