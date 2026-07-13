import { NextResponse } from "next/server";
import { getAnalyticsEvents } from "../../../../Backend.js/analyticsStore";

export async function GET() {
  const events = await getAnalyticsEvents();

  return NextResponse.json({
    ok: true,
    source: "backend-local-json",
    events,
  });
}
