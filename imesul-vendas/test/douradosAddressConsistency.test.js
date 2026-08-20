import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guarda contra regressão: o endereço oficial de Dourados — Centro é "Rua Pedro Rigotti, 248"
// (confirmado pelo usuário em 2026-08-20; "258" estava desatualizado e foi corrigido em todas
// as fontes do projeto - institucional, vendas, rodapé, dados estruturados). Este teste lê os
// arquivos-fonte diretamente (não só o módulo já corrigido) para pegar qualquer "258" que volte
// a aparecer por engano em uma edição futura, nos dois projetos do monorepo.
const filesToCheck = [
  "../lib/leadFlow.js",
  "../components/SalesFooter.jsx",
  "../../imesul/lib/unitPreference.js",
  "../../imesul/data/products.js",
  "../../imesul/app/layout.jsx",
  "../../imesul/components/OfficialLinksPicker.jsx",
];

describe("endereço oficial de Dourados — Centro (248, nunca 258)", () => {
  it.each(filesToCheck)("%s não contém o endereço desatualizado 'Pedro Rigotti, 258'", (relativePath) => {
    const content = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    expect(content).not.toMatch(/Pedro Rigotti,\s*258/);
  });

  it("lib/leadFlow.js (vendas) contém o endereço oficial correto", () => {
    const content = readFileSync(new URL("../lib/leadFlow.js", import.meta.url), "utf8");
    expect(content).toMatch(/Pedro Rigotti,\s*248/);
  });

  it("imesul/data/products.js contém o endereço oficial correto", () => {
    const content = readFileSync(new URL("../../imesul/data/products.js", import.meta.url), "utf8");
    expect(content).toMatch(/Pedro Rigotti,\s*248/);
  });
});
