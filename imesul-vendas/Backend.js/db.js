import "server-only";
import { Pool } from "pg";

// Camada minima de acesso ao Postgres. So cria conexao se DATABASE_URL existir; sem ela, o
// resto do backend (analyticsStore.js, adminSecurity.js) usa o fallback local documentado
// em cada modulo. Nunca logar DATABASE_URL nem qualquer erro que possa conter fragmentos dela.
let pool = null;

export const isDatabaseConfigured = () => Boolean(process.env.DATABASE_URL);

// A maioria dos provedores gerenciados (Neon, Supabase, RDS, etc.) exige TLS e usa
// certificados que nao estao na CA padrao do Node; rejectUnauthorized:false e o ajuste
// padrao aceito nesse cenario a partir de ambiente serverless. Postgres local sem TLS
// (desenvolvimento) desliga SSL explicitamente.
const getSslConfig = () => {
  const url = process.env.DATABASE_URL || "";
  if (/sslmode=disable/i.test(url) || /(^|@)(localhost|127\.0\.0\.1)/i.test(url)) return false;
  return { rejectUnauthorized: false };
};

const getPool = () => {
  if (!isDatabaseConfigured()) return null;
  if (pool) return pool;

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: getSslConfig(),
    // Poucas conexoes por instancia: cada instancia serverless da Vercel roda seu proprio
    // processo Node, entao o total de conexoes escala com o numero de instancias concorrentes,
    // nao com o numero de requisicoes. O Pool fica em memoria do modulo e e reaproveitado
    // entre invocacoes "quentes" da mesma instancia.
    max: Number(process.env.DATABASE_POOL_MAX || 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on("error", (err) => {
    // Erro assincrono em conexao ociosa do pool (ex.: rede caiu). Nunca logar a connection string.
    console.error("[db] erro inesperado no pool do Postgres:", err.message);
  });

  return pool;
};

// Executa uma query parametrizada (sempre placeholders $1, $2... - nunca concatenar valor de
// usuario na string SQL). Lanca o erro original para quem chamou decidir o fallback; as rotas
// nunca devolvem essa mensagem crua ao cliente (ver noStoreJson/catch em cada route.js).
export const query = async (text, params = []) => {
  const activePool = getPool();
  if (!activePool) throw new Error("DATABASE_URL nao configurada.");

  return activePool.query(text, params);
};

// Executa uma serie de queries na MESMA conexao, dentro de uma transacao (BEGIN/COMMIT/ROLLBACK).
// Necessario sempre que a operacao precisa de SELECT ... FOR UPDATE seguido de UPDATE/INSERT
// coerentes entre si (ex.: rodizio de vendedores em salesLeadsStore.js) - pool.query() sozinho
// nao garante que duas chamadas usem a mesma conexao, entao o lock do FOR UPDATE nao "gruda"
// entre chamadas separadas. callback recebe um client com sua propria query(text, params).
export const withTransaction = async (callback) => {
  const activePool = getPool();
  if (!activePool) throw new Error("DATABASE_URL nao configurada.");

  const client = await activePool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

// Helper de diagnostico para uso em script/CLI (ex.: scripts/migrate-db.mjs). Nao expor como
// endpoint publico - se algum dia precisar de um endpoint de health check, exigir sessao admin.
export const checkDatabaseConnection = async () => {
  if (!isDatabaseConfigured()) return { ok: false, reason: "DATABASE_URL nao configurada." };

  try {
    await query("SELECT 1");
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};
