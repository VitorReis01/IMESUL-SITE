import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Mantem os componentes alinhados as regras do Next.js e de acessibilidade.
  ...nextVitals,
  // Arquivos gerados nao fazem parte da revisao do codigo-fonte.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
