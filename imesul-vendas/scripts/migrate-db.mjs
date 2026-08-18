// Executa as migrations SQL em db/migrations/ em ordem, contra DATABASE_URL.
// Uso: npm run db:migrate
// Reexecutavel com seguranca - toda migration usa CREATE TABLE/INDEX IF NOT EXISTS.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(projectRoot, "..", "db", "migrations");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("DATABASE_URL nao configurada. Configure a variavel de ambiente antes de rodar a migration.");
    console.error("Veja docs/analytics-storage.md para instrucoes.");
    process.exitCode = 1;
    return;
  }

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

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
