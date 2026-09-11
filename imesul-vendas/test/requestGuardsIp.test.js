import { describe, expect, it } from "vitest";
import { getRequestIp } from "../Backend.js/requestGuards";

// getRequestIp() decide qual IP alimenta TODO rate limit distribuído do projeto (ver
// Backend.js/rateLimiter.js) - se a ordem de prioridade confiar num header que o cliente pode
// forjar livremente, um atacante multiplica sua cota real só variando esse header a cada
// requisição. Ordem revisada nesta rodada de hardening (ver comentário em requestGuards.js,
// confirmado contra vercel.com/docs/headers/request-headers): x-vercel-forwarded-for >
// x-forwarded-for > x-real-ip > request.ip > fallback fixo. cf-connecting-ip/fastly-client-ip
// foram removidos por não serem headers que a Vercel define/sobrescreve neste projeto (não está
// confirmado atrás de Cloudflare nem Fastly) - mantê-los na cadeia seria confiar em algo que
// qualquer cliente pode simplesmente enviar.
const makeRequest = (headers = {}, ip) => ({
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  ip,
});

describe("getRequestIp", () => {
  it("usa x-vercel-forwarded-for quando presente, mesmo com outros headers também presentes", () => {
    const request = makeRequest({
      "x-vercel-forwarded-for": "203.0.113.10",
      "x-forwarded-for": "203.0.113.99",
      "x-real-ip": "203.0.113.98",
    });
    expect(getRequestIp(request)).toBe("203.0.113.10");
  });

  it("usa só o primeiro IP de uma lista em x-vercel-forwarded-for", () => {
    const request = makeRequest({ "x-vercel-forwarded-for": "203.0.113.10, 70.41.3.18, 150.172.238.178" });
    expect(getRequestIp(request)).toBe("203.0.113.10");
  });

  it("cai para x-forwarded-for quando x-vercel-forwarded-for está ausente", () => {
    const request = makeRequest({ "x-forwarded-for": "198.51.100.22" });
    expect(getRequestIp(request)).toBe("198.51.100.22");
  });

  it("usa só o primeiro IP de uma lista em x-forwarded-for", () => {
    const request = makeRequest({ "x-forwarded-for": "198.51.100.22, 10.0.0.1" });
    expect(getRequestIp(request)).toBe("198.51.100.22");
  });

  it("cai para x-real-ip quando os dois headers de forwarded estão ausentes", () => {
    const request = makeRequest({ "x-real-ip": "192.0.2.55" });
    expect(getRequestIp(request)).toBe("192.0.2.55");
  });

  it("cai para request.ip quando nenhum header está presente", () => {
    const request = makeRequest({}, "192.0.2.200");
    expect(getRequestIp(request)).toBe("192.0.2.200");
  });

  it("cai para o fallback fixo quando nada está disponível", () => {
    const request = makeRequest({});
    expect(getRequestIp(request)).toBe("não identificado");
  });

  // Caso central desta rodada: cf-connecting-ip e fastly-client-ip NUNCA são usados para decidir
  // o IP, mesmo quando são os únicos headers "parecidos com IP" presentes na requisição - um
  // cliente forjando esses dois nomes de header (nenhum dos dois é definido/sobrescrito pela
  // Vercel neste projeto) não consegue influenciar o resultado.
  it("nunca usa cf-connecting-ip nem fastly-client-ip, mesmo sozinhos na requisição (anti-spoofing)", () => {
    const request = makeRequest({
      "cf-connecting-ip": "1.2.3.4",
      "fastly-client-ip": "5.6.7.8",
    });
    expect(getRequestIp(request)).toBe("não identificado");
  });

  it("um atacante forjando cf-connecting-ip não consegue vencer um x-vercel-forwarded-for legítimo (anti-spoofing)", () => {
    const request = makeRequest({
      "cf-connecting-ip": "1.2.3.4",
      "x-vercel-forwarded-for": "203.0.113.10",
    });
    expect(getRequestIp(request)).toBe("203.0.113.10");
  });

  it("um atacante forjando cf-connecting-ip não consegue vencer um x-forwarded-for legítimo (anti-spoofing)", () => {
    const request = makeRequest({
      "cf-connecting-ip": "1.2.3.4",
      "x-forwarded-for": "198.51.100.22",
    });
    expect(getRequestIp(request)).toBe("198.51.100.22");
  });
});
