import "server-only";
import { safeCompare } from "./adminSecurity";

// Bypass EXTREMAMENTE restrito do rate limiter de /api/leads, so para o load test controlado da
// Vercel Preview (autorizado explicitamente pelo usuario - ver relatorio desta fase). NUNCA afeta
// autenticacao, CORS, validacao de payload, idempotencia ou qualquer regra de negocio - so decide
// se as duas camadas de rate limit da rota (global + especifica de leads) sao puladas para ESTA
// requisicao.
//
// TODAS as condicoes abaixo precisam ser verdadeiras ao mesmo tempo; qualquer uma ausente ou
// errada aplica o rate limiter normalmente (fail closed, mesmo principio do resto do rate
// limiter - ver Backend.js/rateLimiter.js):
//   1) VERCEL_ENV === "preview" - nunca "production" nem "development". A Vercel define essa env
//      var automaticamente por deployment; o app nunca escreve nela, entao Production nunca tem
//      como valer "preview" aqui.
//   2) ALLOW_LOAD_TEST_BYPASS === "true" - flag dedicada, precisa ser configurada manualmente no
//      ambiente Preview (nunca herdada de Production, que nao tem essa var configurada).
//   3) LOAD_TEST_BYPASS_SECRET configurado (nao vazio) - segredo dedicado, DIFERENTE do secret de
//      Protection Bypass da propria Vercel (proposito diferente: aquele libera a pagina de SSO da
//      Vercel; este libera so o rate limiter desta aplicacao).
//   4) Header x-imesul-load-test presente e igual ao secret configurado (comparacao em tempo
//      constante via safeCompare - mesmo padrao ja usado em Backend.js/pdfBridgeStore.js).
export const isLoadTestBypassAllowed = (request) => {
  if (process.env.VERCEL_ENV !== "preview") return false;
  if (process.env.ALLOW_LOAD_TEST_BYPASS !== "true") return false;

  const configuredSecret = process.env.LOAD_TEST_BYPASS_SECRET || "";
  if (!configuredSecret) return false;

  const providedSecret = request.headers.get("x-imesul-load-test") || "";
  if (!providedSecret) return false;

  return safeCompare(providedSecret, configuredSecret);
};
