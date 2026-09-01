#!/usr/bin/env node
// Gera o valor de ADMIN_PASSWORD_HASH localmente, sem gravar arquivo e sem imprimir a senha em
// nenhum momento (entrada mascarada em modo raw do terminal). Uso:
//
//   node scripts/generate-admin-password-hash.mjs
//
// Copie a linha impressa para a variavel de ambiente do provedor (Vercel) ou para .env.local -
// nunca para um arquivo versionado.
import { hashAdminPassword } from "../lib/adminPasswordHash.js";

const minPasswordLength = 12;

const CTRL_C = "";
const BACKSPACE_DEL = "";
const BACKSPACE_CTRL_H = "";

const readHiddenLine = (promptText) =>
  new Promise((resolve, reject) => {
    const { stdin, stdout } = process;

    if (!stdin.isTTY) {
      reject(new Error("Este script precisa rodar num terminal interativo (TTY) para mascarar a senha."));
      return;
    }

    stdout.write(promptText);

    let value = "";
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const cleanup = () => {
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stdin.removeListener("data", onData);
    };

    const onData = (char) => {
      if (char === CTRL_C) {
        // Encerra sem imprimir nada do que foi digitado ate aqui.
        cleanup();
        stdout.write("\n");
        reject(new Error("Cancelado."));
        return;
      }

      if (char === "\r" || char === "\n") {
        cleanup();
        stdout.write("\n");
        resolve(value);
        return;
      }

      if (char === BACKSPACE_DEL || char === BACKSPACE_CTRL_H) {
        value = value.slice(0, -1);
        return;
      }

      // Ignora outras sequencias de controle (setas, etc.) - so aceita caracteres imprimiveis.
      if (char.length === 1 && char >= " ") {
        value += char;
      }
    };

    stdin.on("data", onData);
  });

async function main() {
  console.log("Gera ADMIN_PASSWORD_HASH a partir de uma senha digitada agora - nada e gravado em disco.\n");

  const password = await readHiddenLine("Nova senha admin: ");
  const confirmation = await readHiddenLine("Confirme a senha: ");

  if (password.length < minPasswordLength) {
    console.error(`\nSenha muito curta - use pelo menos ${minPasswordLength} caracteres.`);
    process.exitCode = 1;
    return;
  }

  if (password !== confirmation) {
    console.error("\nAs senhas digitadas não coincidem.");
    process.exitCode = 1;
    return;
  }

  const hash = await hashAdminPassword(password);

  console.log("\nAdicione esta linha à variável de ambiente ADMIN_PASSWORD_HASH (Vercel → Project →");
  console.log("Settings → Environment Variables, ou .env.local para dev) - nunca em arquivo versionado:\n");
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
}

main().catch((err) => {
  console.error(`\nFalha ao gerar hash: ${err.message}`);
  process.exitCode = 1;
});
