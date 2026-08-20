import { consumeHandoffToken } from "../../../Backend.js/handoffStore";

export async function GET(_request, { params }) {
  const token = params?.token;
  if (!token) return new Response("Link inválido.", { status: 400 });

  try {
    const result = await consumeHandoffToken(token);
    if (!result.ok) return new Response(result.reason || "Link indisponível.", { status: result.status || 400 });

    return Response.redirect(result.redirectUrl, 302);
  } catch {
    return new Response("Não foi possível abrir o atendimento agora.", { status: 503 });
  }
}
