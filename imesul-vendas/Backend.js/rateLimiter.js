import "server-only";
import { query } from "./db";
import { getRequestIp } from "./requestGuards";
import { logger } from "./logger";

// Rate limit DISTRIBUIDO via Postgres - substitui limitadores baseados so em Map() para as
// checagens que realmente bloqueiam uma requisicao (ver auditoria de seguranca). Cada instancia
// serverless da Vercel roda isolada; memoria local NAO e compartilhada entre elas, entao um
// atacante distribuido conseguiria multiplicar a vazao permitida contra um limitador so local.
// Uma unica query UPSERT atomica (ON CONFLICT) resolve isso sem precisar de um servico novo
// (Redis/Upstash/Vercel KV): reaproveita o Postgres que ja esta em producao. O lock de linha do
// Postgres durante o UPSERT serializa corretamente incrementos concorrentes para a MESMA chave,
// nao importa de qual instancia da Vercel vieram.
//
// FAIL CLOSED por padrao: se a query falhar (banco fora do ar, etc.), checkRateLimit RELANÇA o
// erro - nunca "permitir silenciosamente" so porque o rate limiter caiu (ver requisito explicito
// da auditoria: "nunca permitir que uma falha no rate limiter vire autorizacao ilimitada
// silenciosa"). Quem chama decide o que fazer com a falha: rotas sensiveis (login, leads, admin)
// devem tratar como bloqueado; nenhuma rota deve tratar como liberado.

const opportunisticCleanupChance = 0.02;
const cleanupOldCounters = async () => {
  if (Math.random() > opportunisticCleanupChance) return;

  try {
    await query("DELETE FROM rate_limit_counters WHERE window_start < NOW() - INTERVAL '1 day'");
  } catch (err) {
    console.error("[rate-limiter] falha na limpeza oportunistica:", err.message);
  }
};

// key deve identificar unicamente a combinacao (endpoint + IP [+ usuario]) - ver chamadas em
// cada route.js. windowMs/max definem UMA janela; para politicas em camadas (burst curto +
// janela longa), chame checkRateLimit mais de uma vez com chaves diferentes (mesmo padrao que
// os limitadores em memoria ja usavam em adminSecurity.js).
export const checkRateLimit = async ({ key, windowMs, max }) => {
  const { rows } = await query(
    `INSERT INTO rate_limit_counters (limiter_key, count, window_start)
     VALUES ($1, 1, NOW())
     ON CONFLICT (limiter_key) DO UPDATE
     SET count = CASE
                    WHEN rate_limit_counters.window_start <= NOW() - make_interval(secs => $2::float / 1000)
                    THEN 1
                    ELSE rate_limit_counters.count + 1
                  END,
         window_start = CASE
                    WHEN rate_limit_counters.window_start <= NOW() - make_interval(secs => $2::float / 1000)
                    THEN NOW()
                    ELSE rate_limit_counters.window_start
                  END
     RETURNING count, window_start`,
    [key, windowMs]
  );

  // Fogo-e-esquece: nao atrasa a resposta do request atual por causa da limpeza.
  cleanupOldCounters();

  const { count, window_start: windowStart } = rows[0];
  const allowed = count <= max;
  const resetAt = new Date(windowStart).getTime() + windowMs;
  const retryAfterSeconds = allowed ? 0 : Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1);

  return { allowed, retryAfterSeconds, key };
};

// Leitura SOMENTE LEITURA do estado atual de uma chave - NUNCA incrementa, NUNCA conta como
// tentativa. Existe so para paineis/health checks que precisam saber se uma chave esta no
// limite AGORA sem consumir quota de ninguem (ver monitoring/status/route.js, estado global do
// IMEbot). Nunca use isto para autorizar uma acao - checkRateLimit continua sendo a UNICA fonte
// de verdade para autorizacao (mesma tabela, mesmas chaves, so nao escreve nada).
export const peekRateLimit = async ({ key, windowMs, max }) => {
  const { rows } = await query("SELECT count, window_start FROM rate_limit_counters WHERE limiter_key = $1", [key]);
  if (!rows.length) return { atLimit: false, count: 0 };

  const { count, window_start: windowStart } = rows[0];
  const windowExpired = new Date(windowStart).getTime() <= Date.now() - windowMs;
  if (windowExpired) return { atLimit: false, count: 0 };

  return { atLimit: count >= max, count };
};

// Roda varias camadas em paralelo e devolve a mais restritiva. Se QUALQUER camada falhar
// (excecao), propaga a falha - quem chama decide o fallback (ver comentario no topo do arquivo).
// Cada checkRateLimit ja incrementa E confere no mesmo UPSERT - chamar isto conta como UMA
// tentativa em cada camada, nao so uma leitura.
export const checkRateLimitLayers = async (layers) => {
  const results = await Promise.all(layers.map((layer) => checkRateLimit(layer)));
  const blocked = results.find((result) => !result.allowed);
  return blocked || { allowed: true, retryAfterSeconds: 0 };
};

// Camada GLOBAL, compartilhada por TODAS as rotas /api - a mesma chave por IP, independente do
// endpoint. Sem isso, um atacante poderia alternar entre /api/leads, /api/analytics/track,
// /api/admin/login etc. para contornar o limite especifico de cada rota (cada endpoint tem sua
// propria chave/janela, entao um IP bloqueado em um continuaria livre nos outros). Esta camada
// roda ALEM dos limites especificos de cada endpoint, nunca no lugar deles - ver chamadas em
// cada route.js. Politica inicial: 10 requisicoes em 10 segundos por IP (garante que 20
// requisicoes/segundo do mesmo IP nunca sejam todas aceitas, em nenhuma rota).
const globalApiRateLimitWindowMs = 10_000;
const globalApiRateLimitMax = 10;

export const checkGlobalApiRateLimit = async (request) => {
  const result = await checkRateLimit({
    key: `api:global:${getRequestIp(request)}`,
    windowMs: globalApiRateLimitWindowMs,
    max: globalApiRateLimitMax,
  });

  // So loga aqui (camada global, compartilhada por toda rota /api) - nao dentro de
  // checkRateLimit em si, para nao duplicar o log proprio que o IMEbot abuse guard ja faz
  // quando bloqueia por telefone/quota (ver Backend.js/imebotAbuseGuard.js).
  if (!result.allowed) {
    logger.security("rate_limit_triggered", { scope: "global-api", retryAfterSeconds: result.retryAfterSeconds });
  }

  return result;
};

// Remove os contadores das chaves informadas - usado quando uma tentativa teve sucesso (ex.:
// login admin correto) e nao deve continuar contando contra o limite de tentativas com erro.
export const resetRateLimitKeys = async (keys) => {
  if (!keys.length) return;
  try {
    await query("DELETE FROM rate_limit_counters WHERE limiter_key = ANY($1::text[])", [keys]);
  } catch (err) {
    console.error("[rate-limiter] falha ao resetar chaves:", err.message);
  }
};
