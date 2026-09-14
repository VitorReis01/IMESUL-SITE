"use strict";

// Startup file para o Phusion Passenger (cPanel Node.js Selector / "Application Startup File").
// Passenger e' quem controla o processo (start/stop/restart), a porta (via process.env.PORT,
// injetada por ele antes deste arquivo rodar) e o ciclo de vida do worker - este arquivo nao
// implementa um servidor custom, nao define porta nem host, e nao roda como daemon proprio
// (sem pm2/forever/nodemon/systemd). Ele so localiza e inicia o server.js gerado pelo build
// "standalone" do Next.js (next.config.js -> output: "standalone"), que ja escuta em
// process.env.PORT internamente.
//
// server.js so existe depois de "npm run build:cpanel" (next build + scripts/prepare-standalone.mjs)
// ter rodado no proprio servidor Linux do cPanel - nunca copiar um .next/standalone gerado no
// Windows para producao (binarios/paths ficam incompativeis).

const fs = require("node:fs");
const path = require("node:path");

const standaloneServerPath = path.join(__dirname, ".next", "standalone", "server.js");

if (!fs.existsSync(standaloneServerPath)) {
  throw new Error(
    `Build standalone nao encontrado em "${standaloneServerPath}". ` +
      'Rode "npm run build:cpanel" (next build + scripts/prepare-standalone.mjs) antes de iniciar a aplicacao.'
  );
}

require(standaloneServerPath);
