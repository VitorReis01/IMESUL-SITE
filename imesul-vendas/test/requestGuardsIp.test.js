import { describe, expect, it } from "vitest";
import { getRequestIp } from "../Backend.js/requestGuards";

// getRequestIp() decide qual IP alimenta TODO rate limit distribuído do projeto (ver
// Backend.js/rateLimiter.js) - se a ordem de prioridade confiar num header que o cliente pode
// forjar livremente, um atacante multiplica sua cota real só variando esse header a cada
// requisição. Ordem revisada nesta rodada de hardening (deploy real: VPS HostGator + Nginx, ver
// Backend.js/requestGuards.js e HOSTGATOR-MIGRACAO/03-nginx-vendas.conf): x-real-ip (sempre
// sobrescrito pelo Nginx com $remote_addr - o cliente nunca consegue definir esse valor) > último
// valor de x-forwarded-for (o Nginx só ANEXA $remote_addr ao final, nunca sobrescreve - por isso
// o PRIMEIRO valor é sempre forjável pelo cliente e nunca deve ser confiado) > request.ip >
// fallback fixo. Headers específicos da Vercel (x-vercel-forwarded-for) foram removidos - não é
// mais o ambiente de deploy deste projeto.
const makeRequest = (headers = {}, ip) => ({
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  ip,
});

describe("getRequestIp", () => {
  it("usa x-real-ip quando presente, mesmo com x-forwarded-for também presente", () => {
    const request = makeRequest({
      "x-real-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.22",
    });
    expect(getRequestIp(request)).toBe("203.0.113.10");
  });

  it("cai para x-forwarded-for quando x-real-ip está ausente", () => {
    const request = makeRequest({ "x-forwarded-for": "198.51.100.22" });
    expect(getRequestIp(request)).toBe("198.51.100.22");
  });

  it("usa o ÚLTIMO IP de uma lista em x-forwarded-for, nunca o primeiro (o Nginx só anexa, nunca sobrescreve)", () => {
    const request = makeRequest({ "x-forwarded-for": "198.51.100.22, 10.0.0.1, 203.0.113.55" });
    expect(getRequestIp(request)).toBe("203.0.113.55");
  });

  it("cai para request.ip quando nenhum header está presente", () => {
    const request = makeRequest({}, "192.0.2.200");
    expect(getRequestIp(request)).toBe("192.0.2.200");
  });

  it("cai para o fallback fixo quando nada está disponível", () => {
    const request = makeRequest({});
    expect(getRequestIp(request)).toBe("não identificado");
  });

  // Caso central desta rodada: um atacante forjando o PRIMEIRO valor de x-forwarded-for (o único
  // valor que ele realmente controla nesta topologia de proxy único) não consegue vencer o
  // x-real-ip real definido pelo Nginx.
  it("um atacante forjando x-forwarded-for não consegue vencer um x-real-ip legítimo (anti-spoofing)", () => {
    const request = makeRequest({
      "x-forwarded-for": "1.2.3.4",
      "x-real-ip": "203.0.113.10",
    });
    expect(getRequestIp(request)).toBe("203.0.113.10");
  });

  // Mesmo sem x-real-ip presente, o valor que o atacante manda (primeira posição da lista) nunca
  // deve vencer o valor real que o Nginx anexou (última posição).
  it("um atacante forjando o primeiro valor de x-forwarded-for não consegue esconder o IP real anexado pelo Nginx (anti-spoofing)", () => {
    const request = makeRequest({ "x-forwarded-for": "1.2.3.4, 203.0.113.10" });
    expect(getRequestIp(request)).toBe("203.0.113.10");
  });

  it("nunca usa cf-connecting-ip nem x-vercel-forwarded-for, mesmo sozinhos na requisição (não são mais o ambiente de deploy)", () => {
    const request = makeRequest({
      "cf-connecting-ip": "1.2.3.4",
      "x-vercel-forwarded-for": "5.6.7.8",
    });
    expect(getRequestIp(request)).toBe("não identificado");
  });
});
