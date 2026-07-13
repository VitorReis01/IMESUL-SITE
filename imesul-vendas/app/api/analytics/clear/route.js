import { NextResponse } from "next/server";
import { clearAnalyticsEvents } from "../../../../Backend.js/analyticsStore";

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const visitorId = searchParams.get("visitorId") || "";
  const events = await clearAnalyticsEvents({ visitorId });

  return NextResponse.json({
    ok: true,
    source: "backend-local-json",
    events,
  });
}
