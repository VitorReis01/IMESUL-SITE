import { NextResponse } from "next/server";

// Login admin temporário. Em produção, usar autenticação segura com sessão/cookies e senha com hash.
export async function POST(request) {
  try {
    const { user = "", password = "" } = await request.json();
    const expectedUser = process.env.ADMIN_DEMO_USER || "";
    const expectedPassword = process.env.ADMIN_DEMO_PASSWORD || "";
    const validCredentials =
      expectedUser &&
      expectedPassword &&
      String(user).trim() === expectedUser &&
      String(password) === expectedPassword;

    if (!validCredentials) {
      return NextResponse.json(
        { ok: false, message: "Usuário ou senha inválidos." },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Usuário ou senha inválidos." },
      { status: 400 }
    );
  }
}
