// Helpers server-side minimos para as rotas utilitarias deste projeto (hoje: /api/consent-sync/*
// - /api/health nao precisa de nada disto). O site institucional NAO tem banco (ver CLAUDE.md,
// "Backend: so 2 rotas utilitarias... sem persistencia"), entao o rate limit aqui e em memoria,
// por instancia da funcao serverless (best-effort, nao distribuido entre lambdas da Vercel como
// o rate limiter Postgres de imesul-vendas) - o mesmo padrao ja documentado no projeto irmao para
// camadas de "friction" nao-criticas (nunca a unica defesa de algo que precisa bloquear de
// verdade). E apropriado aqui: consent-sync so emite/le 2 booleans com HMAC, nunca muda dado
// sensivel nem grava nada.
//
// Implementacao propria (nao importada de imesul-vendas): os dois projetos sao deploys
// independentes, sem pacote compartilhado (ver CLAUDE.md, secao 1) - o contrato de
// readJsonBodyWithLimit espelha de proposito imesul-vendas/Backend.js/requestGuards.js para os
// dois ficarem faceis de comparar lado a lado.

export const getRequestIp = (request) => {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const first = forwardedFor.split(",")[0]?.trim();
  if (first) return first;

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp;

  const vercelForwardedFor = (request.headers.get("x-vercel-forwarded-for") || "").split(",")[0]?.trim();
  return vercelForwardedFor || "não identificado";
};

const buckets = new Map();

// Janela fixa simples (nao sliding window) - suficiente para o proposito de friction aqui, sem
// exigir nenhuma infraestrutura nova (Postgres, KV, etc.) neste projeto.
export const checkSimpleRateLimit = ({ key, windowMs, max }) => {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= max) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
};

// Le o corpo cru de uma requisicao aplicando um limite REAL de bytes, contado a partir do
// ReadableStream - nunca confia so no header Content-Length (contornavel com
// Transfer-Encoding: chunked - ver relatorio FULL-SCOPE/remediacao). Content-Length, quando
// presente e ja maior que maxBytes, ainda serve como rejeicao ANTECIPADA - quem garante o limite
// de verdade e a contagem abaixo, com corte (reader.cancel()) assim que ultrapassa maxBytes.
//
// Retorna sempre um objeto com "status" distinguivel - nunca lanca:
// - { status: "too_large" }
// - { status: "invalid_json" } (inclui corpo vazio/ausente, que nunca e um JSON valido)
// - { status: "ok", body }
export const readJsonBodyWithLimit = async (request, maxBytes) => {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBytes) return { status: "too_large" };

  const reader = request.body?.getReader?.();
  if (!reader) return { status: "invalid_json" };

  const chunks = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    receivedBytes += value.byteLength;
    if (receivedBytes > maxBytes) {
      await reader.cancel().catch(() => {});
      return { status: "too_large" };
    }

    chunks.push(value);
  }

  const raw = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  if (!raw) return { status: "invalid_json" };

  try {
    return { status: "ok", body: JSON.parse(raw) };
  } catch {
    return { status: "invalid_json" };
  }
};
