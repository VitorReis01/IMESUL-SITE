import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

// Helpers server-side reutilizaveis para as rotas /api - evita duplicar a mesma logica de
// IP/Origin/Content-Type/resposta em cada route.js. Nao e um framework: so funcoes puras.
//
// IMPORTANTE sobre Origin/Referer (ver auditoria de seguranca): NAO sao autenticacao. Um cliente
// nao-navegador (curl, script, Postman) pode simplesmente omitir ou forjar esses headers. Essa
// checagem e so MAIS UMA camada, nunca a unica: rotas que exigem sessao continuam exigindo
// sessao; rotas publicas continuam com rate limit e validacao de payload independente disso.

export const getFirstForwardedIp = (value = "") => value.split(",")[0]?.trim() || "";

// Ordem de confianca revisada (hardening desta fase) - confirmada contra a documentacao oficial
// da Vercel (vercel.com/docs/headers/request-headers, seções x-forwarded-for/x-vercel-forwarded-for/
// x-real-ip), não só por comentário antigo:
//
// - x-forwarded-for: a Vercel SOBRESCREVE esse header na própria borda e "não repassa IPs
//   externos" (texto oficial) - em um deploy padrão (sem Trusted Proxy, recurso só de Enterprise),
//   não é possível um cliente forjar o valor que a função recebe.
// - x-vercel-forwarded-for: documentado pela própria Vercel como "idêntico a x-forwarded-for",
//   porém MAIS resistente quando existe um proxy própio na FRENTE da Vercel (ex.: CDN/WAF externo)
//   que poderia reescrever x-forwarded-for de novo depois da borda da Vercel já ter definido o
//   valor correto - por isso vem primeiro aqui, mesmo sem essa topologia confirmada hoje.
// - x-real-ip: também documentado como "idêntico a x-forwarded-for" (mesma confiança).
// - cf-connecting-ip / fastly-client-ip FORAM REMOVIDOS da cadeia: não são headers que a Vercel
//   define ou sobrescreve (não aparecem na documentação oficial de headers da Vercel), e este
//   projeto não está confirmado atrás de Cloudflare nem Fastly (nenhuma configuração de CDN/WAF
//   externo encontrada no repositório) - em um deploy direto na Vercel, um cliente pode simplesmente
//   enviar esses dois headers com qualquer valor e a função os recebe sem alteração. Mantê-los
//   como fallback, à frente de um header realmente controlado pela Vercel, permitiria spoofing de
//   IP em qualquer rota que use getRequestIp() para rate limit (ex.: multiplicar a cota
//   fingindo vir de outro IP a cada requisição). Se este projeto algum dia ficar atrás de
//   Cloudflare/Fastly de verdade, o cabeçalho correto a confiar nesse cenário precisa ser
//   revalidado explicitamente, não reintroduzido "por via das dúvidas".
// - request.ip e a string fixa de fallback fecham a cadeia, como antes.
export const getRequestIp = (request) =>
  getFirstForwardedIp(request.headers.get("x-vercel-forwarded-for") || "") ||
  getFirstForwardedIp(request.headers.get("x-forwarded-for") || "") ||
  request.headers.get("x-real-ip") ||
  request.ip ||
  "não identificado";

const getEnvAllowedOrigins = () =>
  String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

// Nunca adivinha o dominio de producao: usa somente o que esta explicitamente configurado
// (ALLOWED_ORIGINS, NEXT_PUBLIC_SALES_SITE_URL) e o que a propria Vercel expoe automaticamente
// para o deployment atual (VERCEL_URL - sempre correto para producao OU preview, sem
// configuracao manual). Um valor errado aqui bloquearia trafego legitimo, entao a lista so
// cresce com fontes confiaveis, nunca com suposicoes.
const getAllowedOrigins = () => {
  const origins = new Set(getEnvAllowedOrigins());

  if (process.env.VERCEL_URL) origins.add(`https://${process.env.VERCEL_URL}`);

  // VERCEL_URL e o deployment UNICO (muda a cada push); VERCEL_BRANCH_URL e a URL ESTAVEL da
  // branch de Preview (a mesma entre deployments sucessivos daquela branch) - com os dois, um
  // preview novo funciona sem precisar cadastrar cada deployment manualmente em ALLOWED_ORIGINS.
  if (process.env.VERCEL_BRANCH_URL) origins.add(`https://${process.env.VERCEL_BRANCH_URL}`);

  if (process.env.NEXT_PUBLIC_SALES_SITE_URL) {
    try {
      origins.add(new URL(process.env.NEXT_PUBLIC_SALES_SITE_URL).origin);
    } catch {
      // valor invalido na env - ignora silenciosamente, nao adiciona origem quebrada.
    }
  }

  // Site institucional (app separado, dominio proprio) chama /api/leads cross-origin para os
  // CTAs "Falar no WhatsApp" (DIRECT_CONTACT) - ver lib/leadFlow.js LEAD_SITE_ORIGIN. Confere as
  // DUAS variaveis publicas que ja existem no projeto para esse dominio (NEXT_PUBLIC_INSTITUTIONAL_URL
  // e NEXT_PUBLIC_INSTITUTIONAL_SITE_URL - esta ultima e a documentada em README.md/.env.example e
  // ja usada por SalesFooter.jsx) - evita que a allowlist de CORS fique vazia so por causa da
  // divergencia de nome ja existente no codigo (ver relatorio desta fase). Nunca adivinha o
  // dominio real (grupoimesul.com.br vs imesul-site.vercel.app sao candidatos vistos no codigo)
  // - so confia no que estiver configurado explicitamente em uma das duas.
  [process.env.NEXT_PUBLIC_INSTITUTIONAL_URL, process.env.NEXT_PUBLIC_INSTITUTIONAL_SITE_URL].forEach((value) => {
    if (!value) return;
    try {
      origins.add(new URL(value).origin);
    } catch {
      // valor invalido na env - ignora silenciosamente, nao adiciona origem quebrada.
    }
  });

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
  }

  return origins;
};

// requireOriginInProduction: true para rotas chamadas EXCLUSIVAMENTE pelo fetch() do proprio
// frontend (nunca por integracao externa/webhook) - nesse caso, em producao, a ausencia do
// header Origin já é um sinal forte de cliente nao-navegador (browsers modernos sempre enviam
// Origin em POST/PUT/PATCH/DELETE, mesmo same-origin). Em desenvolvimento, ausencia de Origin e
// tolerada (curl local, ferramentas de teste).
export const checkOrigin = (request, { requireOriginInProduction = false } = {}) => {
  const origin = request.headers.get("origin");
  const isProduction = process.env.NODE_ENV === "production";

  if (!origin) {
    if (requireOriginInProduction && isProduction) {
      return { allowed: false, reason: "origin ausente" };
    }
    return { allowed: true, reason: "origin ausente (tolerado)" };
  }

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.has(origin)) return { allowed: true, reason: "origin permitida" };

  return { allowed: false, reason: "origin fora da allowlist" };
};

// CORS de verdade (headers de RESPOSTA), so para rotas explicitamente chamadas cross-origin pelo
// site institucional (hoje: /api/leads, para o CTA "Falar no WhatsApp" -> DIRECT_CONTACT). O
// checkOrigin acima valida a REQUISICAO; sem estes headers na RESPOSTA, o navegador do
// institucional bloquearia a leitura da resposta mesmo com o servidor permitindo - CORS e
// decidido pelos dois lados. Nunca "*": so ecoa de volta a origem exata se ela estiver na mesma
// allowlist de checkOrigin, e sempre com Vary: Origin (a resposta muda dependendo de quem pediu).
export const getCorsHeaders = (request) => {
  const origin = request.headers.get("origin");
  if (!origin || !getAllowedOrigins().has(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
};

export const hasValidJsonContentType = (request) => {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  return contentType.startsWith("application/json");
};

// Le o corpo cru de uma requisicao aplicando um limite REAL de bytes, contado a partir do
// ReadableStream - nunca confia so no header Content-Length. Um cliente pode omitir esse header
// (ou enviar com Transfer-Encoding: chunked) e o corpo real ainda assim ultrapassar o limite
// pretendido (achado da auditoria FULL-SCOPE: /api/analytics/track aceitava corpos maiores que
// o anunciado dessa forma). Content-Length, quando presente e ja maior que maxBytes, ainda serve
// como rejeicao ANTECIPADA (evita abrir o stream a toa) - mas quem garante o limite de verdade e
// a contagem abaixo, byte a byte, com corte (reader.cancel()) assim que ultrapassa maxBytes, sem
// nunca acumular mais que isso em memoria.
//
// Retorna sempre um objeto com "status" distinguivel - nunca lanca:
// - { status: "too_large" } - Content-Length adiantou OU o stream ultrapassou maxBytes
// - { status: "ok", raw } - dentro do limite (raw pode ser string vazia, corpo ausente/vazio)
export const readRawBodyWithLimit = async (request, maxBytes) => {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBytes) return { status: "too_large" };

  const reader = request.body?.getReader?.();
  if (!reader) return { status: "ok", raw: "" };

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

  return { status: "ok", raw: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8") };
};

// Mesma garantia de readRawBodyWithLimit, com o corpo ja parseado como JSON - para rotas que
// nunca precisam dos bytes crus (ao contrario do webhook do Meta, que precisa do texto exato
// para validar a assinatura HMAC - ver readRawBodyWithLimit direto em app/api/imebot/webhook).
//
// - { status: "too_large" } - mesmo criterio de readRawBodyWithLimit
// - { status: "invalid_json" } - dentro do limite, mas o conteudo nao e JSON valido (inclui
//   corpo vazio, que nunca e um JSON valido)
// - { status: "ok", body } - JSON valido dentro do limite
export const readJsonBodyWithLimit = async (request, maxBytes) => {
  const result = await readRawBodyWithLimit(request, maxBytes);
  if (result.status === "too_large") return { status: "too_large" };

  if (!result.raw) return { status: "invalid_json" };

  try {
    return { status: "ok", body: JSON.parse(result.raw) };
  } catch {
    return { status: "invalid_json" };
  }
};

// Correlaciona uma requisicao com seus logs/erros/monitoramento. Usa x-vercel-id (a Vercel ja
// injeta esse header em toda invocacao de function, identifica o request na infraestrutura
// dela) quando disponivel; gera um UUID so como fallback (dev local, onde esse header nao
// existe). Nunca deriva de dado pessoal (IP, telefone, etc.) - so identifica a REQUISICAO.
// Uso opcional, adotado incrementalmente rota por rota - ver noStoreJson(body, { headers: {
// "X-Request-ID": getRequestId(request) } }).
export const getRequestId = (request) => request.headers.get("x-vercel-id") || randomUUID();

export const noStoreJson = (body, init = {}) =>
  NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init.headers || {}),
    },
  });

export const forbidden = (message = "Acesso não autorizado.") =>
  noStoreJson({ ok: false, error: message }, { status: 403 });

export const tooManyRequests = (retryAfterSeconds, message = "Muitas solicitações. Tente novamente em instantes.") =>
  noStoreJson(
    { ok: false, error: message },
    { status: 429, headers: { "Retry-After": String(Math.max(retryAfterSeconds, 1)) } }
  );

export const methodNotAllowed = (allow = "GET") =>
  noStoreJson({ ok: false, error: "Método não permitido." }, { status: 405, headers: { Allow: allow } });
