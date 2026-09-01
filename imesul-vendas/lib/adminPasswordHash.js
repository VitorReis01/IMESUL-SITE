// Hash de senha admin com scrypt nativo do Node (sem dependencia nova). Modulo puro, sem
// "server-only" de proposito: precisa ser importavel tanto pela rota de login quanto pelo script
// standalone que gera o hash (scripts/generate-admin-password-hash.mjs), que roda fora do runtime
// do Next.js - "server-only" lanca erro em qualquer import feito por `node` puro (so vira no-op
// quando o bundler do Next.js substitui o modulo durante o build do servidor).
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scryptCallback);

// Parametros de custo do Node (N=16384 e o default do scrypt nativo) gravados dentro do proprio
// hash - se um dia precisarem mudar, hashes antigos continuam verificaveis com os parametros com
// que foram gerados, sem precisar de migração de dados.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

export const hashAdminPassword = async (password) => {
  const salt = randomBytes(16);
  const derived = await scryptAsync(String(password), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("hex")}:${derived.toString("hex")}`;
};

const parseScryptHash = (stored) => {
  const parts = String(stored || "").split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (![N, r, p].every((value) => Number.isInteger(value) && value > 0)) return null;

  let salt;
  let expected;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return null;
  }
  if (!salt.length || !expected.length) return null;

  return { N, r, p, salt, expected };
};

// Hash fixo (nao corresponde a nenhuma senha real) usado so para dar ao scrypt o MESMO custo de
// CPU quando ADMIN_PASSWORD_HASH nao esta configurada - sem isso, "hash ausente" responderia
// quase instantaneamente enquanto "hash presente" leva o tempo real do scrypt, o que por si so
// vazaria por timing se a variavel de ambiente esta configurada ou nao.
const DUMMY_HASH =
  "scrypt:16384:8:1:00000000000000000000000000000000:" +
  "0".repeat(SCRYPT_KEYLEN * 2);

// Sempre roda um scrypt de custo real, autorizando so quando o hash configurado E VALIDO e a
// senha bate (comparacao final em tempo constante via timingSafeEqual).
export const verifyAdminPassword = async (password, storedHash) => {
  const parsedReal = parseScryptHash(storedHash);
  const parsed = parsedReal || parseScryptHash(DUMMY_HASH);

  try {
    const derived = await scryptAsync(String(password), parsed.salt, parsed.expected.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
    });
    const matches = derived.length === parsed.expected.length && timingSafeEqual(derived, parsed.expected);
    return Boolean(parsedReal) && matches;
  } catch {
    return false;
  }
};
