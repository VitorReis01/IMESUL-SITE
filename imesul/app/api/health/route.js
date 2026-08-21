import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    { status: "ok", service: "imesul-institucional" },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
