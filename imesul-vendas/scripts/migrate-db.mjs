// Executa as migrations SQL em db/migrations/ em ordem, contra DATABASE_MIGRATION_URL - a
// variavel OFICIAL para migrations (role com CREATE/ALTER/DROP, dona do schema).
// Uso: npm run db:migrate
// Reexecutavel com seguranca - toda migration usa CREATE TABLE/INDEX IF NOT EXISTS.
//
// FAIL-CLOSED em Production/CI (NODE_ENV=production ou CI definido - ver
// resolveMigrationDatabaseUrl): sem DATABASE_MIGRATION_URL configurada, aborta imediatamente,
// SEM cair silenciosamente para DATABASE_URL. Cair para a role de runtime (menor privilegio, sem
// CREATE/ALTER/DROP) faria a migration falhar de um jeito confuso na melhor hipotese, ou - pior -
// rodar contra uma role errada sem ninguem perceber, se a separacao de roles ainda nao tiver sido
// aplicada ao banco (ver POSTGRES_ROLE_PROPOSAL.md).
//
// Fallback para DATABASE_URL existe SOMENTE fora de Production/CI (dev local), e sempre com um
// warning explicito - nunca silencioso, nunca em Production/CI.
//
// DATABASE_MIGRATION_URL NUNCA deve ser a mesma role de runtime que Backend.js/db.js usa (essa so
// le DATABASE_URL, nunca DATABASE_MIGRATION_URL - ver Backend.js/db.js e
// test/databaseMigrationUrlIsolation.test.js, que trava essa separacao contra regressao).
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(projectRoot, "..", "db", "migrations");

// Variaveis de ambiente sao sempre string (ou undefined) - "false"/"0" sao strings NAO-VAZIAS,
// entao `Boolean("false")` e `true` em JS. Normaliza explicitamente para nao interpretar CI=false/
// CI=0/CI="" como CI ativo (alguns provedores/ferramentas so lidam com strings e podem setar CI
// como a string literal "false" para dizer "CI desligado" - tratar isso como "CI ligado" faria
// migrate-db.mjs abortar em Production/CI por engano quando na verdade nao estamos em CI).
const isTruthyEnvFlag = (value) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "false" && normalized !== "0";
};

// Decide qual connection string usar para migrations - pura funcao de variaveis de ambiente, sem
// I/O, para poder ser testada sem banco real (ver test/migrateDbUrlResolution.test.js). NUNCA
// devolve nem loga o valor da URL em si, so o NOME da variavel escolhida (quem chama loga so
// `source`/`warning`/`error`, nunca `databaseUrl`).
export const resolveMigrationDatabaseUrl = (env = process.env) => {
  const isProductionOrCi = env.NODE_ENV === "production" || isTruthyEnvFlag(env.CI);
  const migrationUrl = env.DATABASE_MIGRATION_URL;

  if (migrationUrl) {
    return { ok: true, databaseUrl: migrationUrl, source: "DATABASE_MIGRATION_URL", warning: null };
  }

  if (isProductionOrCi) {
    return {
      ok: false,
      error:
        "DATABASE_MIGRATION_URL nao configurada. Abortando: em Production/CI, migrations exigem a " +
        "role de migration configurada explicitamente - nunca usam DATABASE_URL (role de runtime) " +
        "como fallback.",
    };
  }

  if (env.DATABASE_URL) {
    return {
      ok: true,
      databaseUrl: env.DATABASE_URL,
      source: "DATABASE_URL",
      warning: "Usando DATABASE_URL apenas por compatibilidade local. Configure DATABASE_MIGRATION_URL.",
    };
  }

  return {
    ok: false,
    error: "Nem DATABASE_MIGRATION_URL nem DATABASE_URL estao configuradas. Configure DATABASE_MIGRATION_URL antes de rodar a migration.",
  };
};

async function main() {
  const resolved = resolveMigrationDatabaseUrl(process.env);

  if (!resolved.ok) {
    console.error(resolved.error);
    console.error("Veja POSTGRES_ROLE_PROPOSAL.md para o motivo de DATABASE_MIGRATION_URL existir.");
    process.exitCode = 1;
    return;
  }

  if (resolved.warning) console.warn(resolved.warning);

  // So o NOME da variavel em uso, nunca o valor - nunca logar connection string/credencial.
  console.log(`Usando ${resolved.source}.`);

  const databaseUrl = resolved.databaseUrl;
  const isLocal = /(^|@)(localhost|127\.0\.0\.1)/i.test(databaseUrl) || /sslmode=disable/i.test(databaseUrl);
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  try {
    const files = (await readdir(migrationsDir))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    if (!files.length) {
      console.log("Nenhum arquivo de migration encontrado em db/migrations/.");
      return;
    }

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = await readFile(filePath, "utf8");

      console.log(`Aplicando ${file}...`);
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("COMMIT");
        console.log(`OK - ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Falha ao aplicar ${file}: ${err.message}`);
      } finally {
        client.release();
      }
    }

    console.log("Migrations concluidas.");
  } finally {
    await pool.end();
  }
}

// So roda de verdade quando o arquivo e executado diretamente (`node scripts/migrate-db.mjs` /
// `npm run db:migrate`) - nao quando importado por um teste (ver
// test/migrateDbUrlResolution.test.js), que so precisa de resolveMigrationDatabaseUrl, sem
// disparar readdir/conexao real de banco como efeito colateral do import.
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
