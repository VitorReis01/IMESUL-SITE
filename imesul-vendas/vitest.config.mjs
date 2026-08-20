import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Testes unitários das partes PURAS do funil comercial (sem banco, sem credenciais Meta reais -
// ver relatório desta fase, seção testes automatizados). "server-only" é trocado por um stub
// aqui porque esse pacote lança incondicionalmente fora do bundler do Next.js (ver
// test/stubs/server-only.js) - os módulos de Backend.js/ que só fazem crypto pura (ex.:
// metaSignature.js) continuam testáveis sem precisar remover o guard arquitetural do código real.
export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(dirname, "test/stubs/server-only.js"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
  },
});
