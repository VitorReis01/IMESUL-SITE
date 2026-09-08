import { describe, expect, it } from "vitest";
import { resolveMigrationDatabaseUrl } from "../scripts/migrate-db.mjs";

// Cobre o comportamento fail-closed de scripts/migrate-db.mjs: em Production/CI,
// DATABASE_MIGRATION_URL é obrigatória - nunca cai silenciosamente para DATABASE_URL (a role de
// runtime, sem CREATE/ALTER/DROP). Fora de Production/CI, o fallback para DATABASE_URL existe só
// para conveniência local, sempre com warning explícito. Importar este módulo não dispara
// nenhuma conexão real de banco (main() só roda quando o arquivo é executado diretamente - ver
// o guard no fim de scripts/migrate-db.mjs).
describe("resolveMigrationDatabaseUrl", () => {
  it("DATABASE_MIGRATION_URL presente: sempre usada, sem warning, independente do ambiente", () => {
    const result = resolveMigrationDatabaseUrl({ DATABASE_MIGRATION_URL: "postgres://migration", NODE_ENV: "production", CI: "true" });

    expect(result).toEqual({ ok: true, databaseUrl: "postgres://migration", source: "DATABASE_MIGRATION_URL", warning: null });
  });

  it("Production, sem DATABASE_MIGRATION_URL: aborta (fail-closed), NUNCA cai para DATABASE_URL", () => {
    const result = resolveMigrationDatabaseUrl({ NODE_ENV: "production", DATABASE_URL: "postgres://runtime" });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/DATABASE_MIGRATION_URL/);
    // Nunca deve devolver a URL de runtime como se fosse válida para migration.
    expect(result.databaseUrl).toBeUndefined();
  });

  it("CI definido (mesmo sem NODE_ENV=production), sem DATABASE_MIGRATION_URL: também aborta", () => {
    const result = resolveMigrationDatabaseUrl({ CI: "true", DATABASE_URL: "postgres://runtime" });

    expect(result.ok).toBe(false);
    expect(result.databaseUrl).toBeUndefined();
  });

  it("dev local (sem NODE_ENV=production, sem CI), sem DATABASE_MIGRATION_URL: cai para DATABASE_URL COM warning explícito", () => {
    const result = resolveMigrationDatabaseUrl({ DATABASE_URL: "postgres://runtime" });

    expect(result).toEqual({
      ok: true,
      databaseUrl: "postgres://runtime",
      source: "DATABASE_URL",
      warning: "Usando DATABASE_URL apenas por compatibilidade local. Configure DATABASE_MIGRATION_URL.",
    });
  });

  it("dev local, NODE_ENV=development explícito, sem nenhuma das duas: erro claro, nunca undefined silencioso", () => {
    const result = resolveMigrationDatabaseUrl({ NODE_ENV: "development" });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/DATABASE_MIGRATION_URL/);
  });

  it("Production, sem nenhuma das duas variáveis: erro específico de fail-closed (não o erro genérico de dev)", () => {
    const result = resolveMigrationDatabaseUrl({ NODE_ENV: "production" });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Production\/CI/);
  });

  it("nunca inclui a própria connection string na mensagem de warning/erro", () => {
    const secretUrl = "postgres://user:s3cr3t@host/db";
    const local = resolveMigrationDatabaseUrl({ DATABASE_URL: secretUrl });
    const prod = resolveMigrationDatabaseUrl({ NODE_ENV: "production" });

    expect(local.warning).not.toContain(secretUrl);
    expect(local.warning).not.toContain("s3cr3t");
    expect(prod.error).not.toContain(secretUrl);
  });

  // Revisão desta rodada: variável de ambiente é sempre string (ou undefined) - Boolean("false")
  // é `true` em JS, então CI="false" (string literal, comportamento real de algumas ferramentas)
  // não pode ser interpretado como CI ativo só por ser uma string não-vazia.
  describe("interpretação de CI (normalização contra falso-positivo)", () => {
    const withoutMigrationOrDatabaseUrl = (ci) => resolveMigrationDatabaseUrl({ CI: ci });

    it("CI=true -> tratado como CI ativo (fail-closed sem DATABASE_MIGRATION_URL)", () => {
      expect(withoutMigrationOrDatabaseUrl("true").ok).toBe(false);
      expect(withoutMigrationOrDatabaseUrl("true").error).toMatch(/Production\/CI/);
    });

    it("CI=1 -> tratado como CI ativo", () => {
      expect(withoutMigrationOrDatabaseUrl("1").ok).toBe(false);
      expect(withoutMigrationOrDatabaseUrl("1").error).toMatch(/Production\/CI/);
    });

    it("CI=false (string literal) -> NUNCA tratado como CI ativo - não é o bug do Boolean(\"false\")", () => {
      const result = resolveMigrationDatabaseUrl({ CI: "false", DATABASE_URL: "postgres://runtime" });

      expect(result.ok).toBe(true);
      expect(result.source).toBe("DATABASE_URL");
      expect(result.warning).toMatch(/compatibilidade local/);
    });

    it("CI=0 -> NUNCA tratado como CI ativo", () => {
      const result = resolveMigrationDatabaseUrl({ CI: "0", DATABASE_URL: "postgres://runtime" });

      expect(result.ok).toBe(true);
      expect(result.source).toBe("DATABASE_URL");
    });

    it("CI ausente -> não é CI (comportamento de dev local)", () => {
      const result = resolveMigrationDatabaseUrl({ DATABASE_URL: "postgres://runtime" });

      expect(result.ok).toBe(true);
      expect(result.source).toBe("DATABASE_URL");
    });

    it("CI=\"\" (string vazia) -> NUNCA tratado como CI ativo", () => {
      const result = resolveMigrationDatabaseUrl({ CI: "", DATABASE_URL: "postgres://runtime" });

      expect(result.ok).toBe(true);
      expect(result.source).toBe("DATABASE_URL");
    });
  });
});
