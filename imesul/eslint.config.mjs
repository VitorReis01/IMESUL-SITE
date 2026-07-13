import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Usa as regras recomendadas pelo Next.js e as verificacoes de Core Web Vitals.
  ...nextVitals,
  // Exclui somente artefatos produzidos pelo framework e pelo build.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
