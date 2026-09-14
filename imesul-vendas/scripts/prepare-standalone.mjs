// Copia public/ e .next/static/ para dentro de .next/standalone/ - o build "standalone" do
// Next.js (next.config.js -> output: "standalone") nao inclui esses dois diretorios
// automaticamente (comportamento documentado pelo proprio Next.js), mas o server.js gerado
// espera encontra-los ao lado dele para servir assets estaticos/public em producao.
//
// Cross-platform (Windows para desenvolvimento/teste local, Linux no cPanel) usando somente
// fs/promises nativo do Node - sem depender de cp/rm do shell, sem dependencia nova.

import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const standaloneDir = path.join(projectRoot, ".next", "standalone");

const targets = [
  { label: "public/", src: path.join(projectRoot, "public"), dest: path.join(standaloneDir, "public") },
  {
    label: ".next/static/",
    src: path.join(projectRoot, ".next", "static"),
    dest: path.join(standaloneDir, ".next", "static"),
  },
];

async function main() {
  if (!existsSync(standaloneDir)) {
    throw new Error(
      `"${standaloneDir}" nao existe. Rode "next build" (com output: "standalone" em next.config.js) antes deste script.`
    );
  }

  for (const { label, src, dest } of targets) {
    if (!existsSync(src)) {
      throw new Error(`Origem "${src}" (${label}) nao existe - build incompleto?`);
    }

    // Limpa o destino antigo para nao deixar arquivo obsoleto de um build anterior.
    await rm(dest, { recursive: true, force: true });
    await cp(src, dest, { recursive: true });
    console.log(`[prepare-standalone] ${label} -> ${path.relative(projectRoot, dest)}`);
  }

  console.log("[prepare-standalone] Concluido.");
}

main().catch((err) => {
  console.error(`[prepare-standalone] Falhou: ${err.message}`);
  process.exitCode = 1;
});
