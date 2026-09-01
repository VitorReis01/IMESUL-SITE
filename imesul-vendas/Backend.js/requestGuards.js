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

// Ordem de confianca: headers especificos de infra (Vercel/Cloudflare/Fastly) antes do generico
// x-forwarded-for, que pode ter varios IPs concatenados por proxies intermediarios - sempre usa
// so o primeiro. request.ip e o ultimo fallback (nem sempre populado pelo runtime).
export const getRequestIp = (request) =>
  getFirstForwardedIp(request.headers.get("x-forwarded-for") || "") ||
  request.headers.get("x-real-ip") ||
  request.headers.get("cf-connecting-ip") ||
  request.headers.get("fastly-client-ip") ||
  getFirstForwardedIp(request.headers.get("x-vercel-forwarded-for") || "") ||
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
