import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Trava estática contra regressão: DATABASE_MIGRATION_URL (role de MIGRATION - CREATE/ALTER/
// DROP, dona do schema) nunca pode ser lida pelo código de runtime. Só scripts/migrate-db.mjs (e
// este próprio teste/documentação) tem permissão de referenciar essa variável - ver
// Backend.js/db.js#getPool, que lê exclusivamente DATABASE_URL, e POSTGRES_ROLE_PROPOSAL.md.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scanDirs = ["Backend.js", "lib", "app", "components"];
const sourceFilePattern = /\.(js|jsx|mjs)$/;

const walk = (dir) => {
  let files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(full));
    else if (sourceFilePattern.test(entry.name)) files.push(full);
  }
  return files;
};

describe("isolamento de DATABASE_MIGRATION_URL (role de migration) fora do código de runtime", () => {
  it("nenhum arquivo em Backend.js/, lib/, app/ ou components/ referencia DATABASE_MIGRATION_URL", () => {
    const offenders = [];

    for (const dir of scanDirs) {
      const dirPath = path.join(projectRoot, dir);
      for (const file of walk(dirPath)) {
        const content = readFileSync(file, "utf8");
        if (content.includes("DATABASE_MIGRATION_URL")) {
          offenders.push(path.relative(projectRoot, file));
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("Backend.js/db.js lê exclusivamente DATABASE_URL para a conexão de runtime", () => {
    const content = readFileSync(path.join(projectRoot, "Backend.js", "db.js"), "utf8");

    expect(content).toContain("process.env.DATABASE_URL");
    expect(content).not.toContain("DATABASE_MIGRATION_URL");
  });

  it("scripts/migrate-db.mjs é o único lugar do repositório (fora de docs/config) que referencia DATABASE_MIGRATION_URL no código", () => {
    const content = readFileSync(path.join(projectRoot, "scripts", "migrate-db.mjs"), "utf8");

    expect(content).toContain("DATABASE_MIGRATION_URL");
  });
});
