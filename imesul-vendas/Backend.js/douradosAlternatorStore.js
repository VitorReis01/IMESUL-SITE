import "server-only";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isDatabaseConfigured, query } from "./db";

// Alternador 1-por-1 entre Dourados Centro/Fabrica (ver relatorio desta fase). NAO e o rodizio de
// vendedor de Campo Grande (Backend.js/salesLeadsStore.js) - nao tem conceito de disponibilidade,
// fila, nem histórico comercial. A unica persistencia necessaria e "qual foi a ULTIMA loja que
// recebeu um redirecionamento", para a alternancia funcionar entre instancias serverless
// diferentes (cada instancia da Vercel roda isolada - uma variavel de modulo NAO seria
// compartilhada entre elas, mesmo motivo documentado em rateLimiter.js).
//
// UPDATE atomico de linha unica (sem SELECT previo): o lock de linha do Postgres serializa
// requests concorrentes na MESMA linha, entao dois clientes simultaneos nunca leem o mesmo
// "ultimo" e caem na mesma loja por engano (ver migration 005_dourados_alternator.sql).
//
// DEV sem DATABASE_URL: fallback em arquivo temp (mesmo padrao de Backend.js/analyticsStore.js -
// nunca so um Map() em memoria de modulo, que nao sobrevive a reloads do "next dev"). NUNCA e
// armazenamento valido de producao.
const statePath = path.join(os.tmpdir(), "imesul-vendas-dourados-alternator.json");

const flip = (value) => (value === "centro" ? "fabrica" : "centro");

const nextFromFile = async () => {
  let last = "fabrica";
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed?.lastDestination === "centro" || parsed?.lastDestination === "fabrica") {
      last = parsed.lastDestination;
    }
  } catch {
    // Primeiro acesso local (arquivo ainda nao existe) - mantem o padrao "fabrica", entao o
    // primeiro cliente real cai em "centro" (mesma ordem do exemplo do relatorio: cliente 1 ->
    // Centro, cliente 2 -> Fabrica...).
  }

  const next = flip(last);
  try {
    await fs.writeFile(statePath, JSON.stringify({ lastDestination: next }), "utf8");
  } catch {
    // Best-effort: uma falha ao escrever o fallback de dev nunca pode quebrar o clique do
    // cliente - so significa que a proxima chamada local recomeca do padrao.
  }
  return next;
};

// Devolve "centro" ou "fabrica" - a loja que este cliente deve receber agora. Nunca lanca: uma
// falha no Postgres cai no fallback de arquivo so para esta chamada, em vez de quebrar o clique.
export const getNextDouradosDestination = async () => {
  if (!isDatabaseConfigured()) return nextFromFile();

  try {
    const { rows } = await query(
      `UPDATE dourados_alternator_state
       SET last_destination = CASE WHEN last_destination = 'centro' THEN 'fabrica' ELSE 'centro' END,
           updated_at = NOW()
       WHERE id = 1
       RETURNING last_destination`
    );

    if (rows.length) return rows[0].last_destination;

    // Linha inicial ausente (migration ainda nao rodou neste banco) - nunca quebra o clique do
    // cliente; cai no fallback de arquivo so para esta requisicao.
    return nextFromFile();
  } catch (err) {
    console.error("[dourados-alternator] falha no Postgres, usando fallback local:", err.message);
    return nextFromFile();
  }
};
