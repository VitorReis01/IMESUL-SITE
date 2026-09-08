import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMMERCIAL_UNITS, LEAD_FLOW_TYPES } from "../lib/leadFlow";

// sessionStorage real (por aba, some so quando a aba fecha - reload preserva). O mock guarda os
// dados fora do modulo sendo testado, do mesmo jeito: um vi.resetModules() + reimport simula um
// reload (estado JS do modulo zerado), mas este objeto (equivalente ao "browser") continua o
// mesmo entre as duas metades do teste, exatamente como sessionStorage sobreviveria de verdade.
const createSessionStorageMock = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
};

// Cobre a decisão central de lib/leadWhatsApp.js: unit === "dourados" desvia inteiramente para o
// alternador (nunca cria lead); qualquer outra unidade segue o fluxo de lead/rodízio já existente.
// window.open é mockado (ambiente de teste é "node" puro, sem jsdom - ver vitest.config.mjs);
// createLead/openDouradosWhatsApp são mockados para isolar só a decisão de roteamento.
describe("openWhatsAppWithLead - roteamento territorial", () => {
  const openDouradosWhatsApp = vi.fn(async () => undefined);
  const createLead = vi.fn(async () => ({ ok: true, leadCode: "IMESUL-TESTE", seller: { name: "Vendedor Teste", whatsapp: "5567900000000" } }));

  beforeEach(() => {
    vi.resetModules();
    openDouradosWhatsApp.mockClear();
    createLead.mockClear();

    vi.doMock("../lib/douradosDispatch", () => ({ openDouradosWhatsApp }));
    vi.doMock("../lib/leads", () => ({ createLead }));
    vi.doMock("../lib/localAnalytics", () => ({ getAnonymousVisitorId: () => "visitor-teste" }));
    vi.doMock("../lib/trackEvent", () => ({ trackEvent: () => {} }));
    vi.doMock("../lib/commercialContactAlert", () => ({ notifyCommercialContactBlocked: () => {} }));

    globalThis.window = {
      open: vi.fn(() => ({ closed: false, location: {}, close: vi.fn() })),
      location: { search: "" },
      sessionStorage: createSessionStorageMock(),
    };
  });

  afterEach(() => {
    vi.doUnmock("../lib/douradosDispatch");
    vi.doUnmock("../lib/leads");
    vi.doUnmock("../lib/localAnalytics");
    vi.doUnmock("../lib/trackEvent");
    vi.doUnmock("../lib/commercialContactAlert");
    delete globalThis.window;
  });

  it("unit dourados -> delega inteiramente ao alternador, NUNCA cria lead", async () => {
    const { openWhatsAppWithLead } = await import("../lib/leadWhatsApp");

    await openWhatsAppWithLead({
      message: "Olá, quero orçamento",
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
      unit: COMMERCIAL_UNITS.DOURADOS,
      pagePath: "teste",
    });

    expect(openDouradosWhatsApp).toHaveBeenCalledTimes(1);
    expect(createLead).not.toHaveBeenCalled();
  });

  it("unit campo-grande -> cria lead pelo fluxo normal, NUNCA chama o alternador de Dourados", async () => {
    const { openWhatsAppWithLead } = await import("../lib/leadWhatsApp");

    await openWhatsAppWithLead({
      message: "Olá, quero orçamento",
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      pagePath: "teste",
    });

    expect(createLead).toHaveBeenCalledTimes(1);
    expect(createLead).toHaveBeenCalledWith(expect.objectContaining({ unit: COMMERCIAL_UNITS.CAMPO_GRANDE }));
    expect(openDouradosWhatsApp).not.toHaveBeenCalled();
  });

  it("envia um clientRequestId (para dedup no servidor - ver buildIdempotencyKey) em cada chamada", async () => {
    const { openWhatsAppWithLead } = await import("../lib/leadWhatsApp");

    await openWhatsAppWithLead({
      message: "Olá, quero orçamento",
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      pagePath: "teste",
    });

    expect(createLead).toHaveBeenCalledWith(
      expect.objectContaining({ clientRequestId: expect.any(String) })
    );
    const [{ clientRequestId }] = createLead.mock.calls[0];
    expect(clientRequestId.length).toBeGreaterThanOrEqual(8);
  });

  it("clique duplo (mesma mensagem, disparado antes da primeira tentativa terminar) NÃO chama createLead duas vezes", async () => {
    let resolveCreateLead;
    createLead.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreateLead = resolve;
        })
    );

    const { openWhatsAppWithLead } = await import("../lib/leadWhatsApp");
    const args = {
      message: "Olá, quero orçamento - clique duplo",
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      pagePath: "teste",
    };

    const first = openWhatsAppWithLead(args);
    const second = openWhatsAppWithLead(args); // "segundo clique" antes do primeiro resolver

    resolveCreateLead({ ok: true, leadCode: "IMESUL-TESTE", seller: { name: "Vendedor Teste", whatsapp: "5567900000000" } });
    await Promise.all([first, second]);

    expect(createLead).toHaveBeenCalledTimes(1);
    // Só 1 popup em branco deveria ter sido aberto (o segundo "clique" reaproveita a tentativa em
    // andamento em vez de abrir um segundo popup) - o preenchimento da URL final usa
    // popup.location.href, não uma nova chamada a window.open.
    expect(window.open).toHaveBeenCalledTimes(1);
  });

  it("depois da tentativa terminar, uma nova chamada com a MESMA mensagem chama createLead de novo (retry manual continua funcionando)", async () => {
    const { openWhatsAppWithLead } = await import("../lib/leadWhatsApp");
    const args = {
      message: "Olá, quero orçamento - retry",
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      pagePath: "teste",
    };

    await openWhatsAppWithLead(args);
    await openWhatsAppWithLead(args);

    expect(createLead).toHaveBeenCalledTimes(2);
  });

  // Casos C+D do relatório desta rodada: resposta ao navegador sofre timeout DEPOIS do lead já
  // ter sido criado no servidor (ambiguous:true - lib/leads.js não sabe o resultado), seguido de
  // um novo clique. Sem reaproveitar o clientRequestId, o segundo clique geraria uma chave nova e
  // duplicaria o lead no servidor (a dedup por idempotency_key não ajudaria, porque as chaves
  // seriam diferentes).
  it("C+D: timeout ambíguo seguido de novo clique reaproveita o MESMO clientRequestId (evita duplicar o lead)", async () => {
    createLead.mockResolvedValueOnce({ ok: false, ambiguous: true });
    createLead.mockResolvedValueOnce({ ok: true, ambiguous: false, leadCode: "IMESUL-TESTE", seller: { name: "Vendedor Teste", whatsapp: "5567900000000" } });

    const { openWhatsAppWithLead } = await import("../lib/leadWhatsApp");
    const args = {
      message: "Olá, quero orçamento - timeout ambíguo",
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      pagePath: "teste",
    };

    await openWhatsAppWithLead(args); // C: resposta sofreu timeout, servidor pode ter criado o lead
    await openWhatsAppWithLead(args); // D: usuário clica de novo

    expect(createLead).toHaveBeenCalledTimes(2);
    const [firstCall] = createLead.mock.calls[0];
    const [secondCall] = createLead.mock.calls[1];
    expect(secondCall.clientRequestId).toBe(firstCall.clientRequestId);
  });

  it("resultado DEFINITIVO (sucesso) seguido de nova chamada gera um clientRequestId DIFERENTE - a próxima tentativa começa do zero", async () => {
    createLead.mockResolvedValueOnce({ ok: true, ambiguous: false, leadCode: "IMESUL-A", seller: { name: "Vendedor Teste", whatsapp: "5567900000000" } });
    createLead.mockResolvedValueOnce({ ok: true, ambiguous: false, leadCode: "IMESUL-B", seller: { name: "Vendedor Teste", whatsapp: "5567900000000" } });

    const { openWhatsAppWithLead } = await import("../lib/leadWhatsApp");
    const args = {
      message: "Olá, quero orçamento - definitivo",
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      pagePath: "teste",
    };

    await openWhatsAppWithLead(args);
    await openWhatsAppWithLead(args);

    const [firstCall] = createLead.mock.calls[0];
    const [secondCall] = createLead.mock.calls[1];
    expect(secondCall.clientRequestId).not.toBe(firstCall.clientRequestId);
  });

  it("definitivo sem vendedor (Campo Grande) + clique em \"tentar novamente\" gera clientRequestId novo (permite tentar atribuir vendedor de novo)", async () => {
    // Usa o modulo REAL de commercialContactAlert (nunca mockado aqui) - eliminar essa mock
    // resolveu uma corrida real observada nesta suite: vi.doMock+import dinamico para este
    // especifico specifier as vezes nao "grudava" a tempo quando varios arquivos de teste rodam
    // no mesmo worker (falha em ~1 a cada 3 rodadas da suite completa, sempre so neste teste,
    // nunca reproduzivel rodando o arquivo sozinho - sintoma classico de race condition entre
    // workers). notifyCommercialContactBlocked so precisa de window.dispatchEvent/CustomEvent,
    // que o "window" global deste describe nao tem por padrao - adiciona so para este teste.
    const listeners = {};
    globalThis.window.addEventListener = (type, handler) => {
      (listeners[type] ||= []).push(handler);
    };
    globalThis.window.dispatchEvent = (event) => {
      (listeners[event.type] || []).forEach((handler) => handler(event));
    };
    globalThis.CustomEvent = class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    };

    vi.doUnmock("../lib/commercialContactAlert");
    vi.resetModules();
    vi.doMock("../lib/douradosDispatch", () => ({ openDouradosWhatsApp }));
    vi.doMock("../lib/leads", () => ({ createLead }));
    vi.doMock("../lib/localAnalytics", () => ({ getAnonymousVisitorId: () => "visitor-teste" }));
    vi.doMock("../lib/trackEvent", () => ({ trackEvent: () => {} }));

    let retryFn;
    const { subscribeToCommercialContactBlocked } = await import("../lib/commercialContactAlert");
    subscribeToCommercialContactBlocked(({ retry }) => {
      retryFn = retry;
    });

    createLead.mockResolvedValueOnce({ ok: true, ambiguous: false, leadCode: "IMESUL-SEM-VENDEDOR", seller: null });
    createLead.mockResolvedValueOnce({ ok: true, ambiguous: false, leadCode: "IMESUL-COM-VENDEDOR", seller: { name: "Vendedor Teste", whatsapp: "5567900000000" } });

    const { openWhatsAppWithLead } = await import("../lib/leadWhatsApp");
    const args = {
      message: "Olá, quero orçamento - sem vendedor",
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      pagePath: "teste",
    };

    await openWhatsAppWithLead(args);
    expect(retryFn).toBeTypeOf("function");
    await retryFn();

    expect(createLead).toHaveBeenCalledTimes(2);
    const [firstCall] = createLead.mock.calls[0];
    const [secondCall] = createLead.mock.calls[1];
    expect(secondCall.clientRequestId).not.toBe(firstCall.clientRequestId);

    delete globalThis.CustomEvent;
  });

  // Persistencia do clientRequestId em sessionStorage (substitui o Map em memoria antigo, que nao
  // sobrevivia a um reload da aba). Os 6 cenarios abaixo cobrem o ciclo de vida completo descrito
  // no comentario de getClientRequestIdForAttempt em lib/leadWhatsApp.js.
  describe("persistencia do clientRequestId em sessionStorage", () => {
    it("1. timeout sem reload -> 1 lead (mesmo clientRequestId reaproveitado)", async () => {
      createLead.mockResolvedValueOnce({ ok: false, ambiguous: true });
      createLead.mockResolvedValueOnce({ ok: true, ambiguous: false, leadCode: "IMESUL-1", seller: { name: "Vendedor Teste", whatsapp: "5567900000000" } });

      const { openWhatsAppWithLead } = await import("../lib/leadWhatsApp");
      const args = { message: "Cenario 1 - timeout sem reload", flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT, unit: COMMERCIAL_UNITS.CAMPO_GRANDE, pagePath: "teste" };

      await openWhatsAppWithLead(args); // timeout - resultado ambiguo
      await openWhatsAppWithLead(args); // nova tentativa, mesma aba, sem reload

      expect(createLead).toHaveBeenCalledTimes(2);
      const [{ clientRequestId: idAntes }] = createLead.mock.calls[0];
      const [{ clientRequestId: idDepois }] = createLead.mock.calls[1];
      expect(idDepois).toBe(idAntes);
    });

    it("2. timeout + retry (multiplas tentativas ambiguas) -> 1 lead (clientRequestId mantido ate um resultado definitivo)", async () => {
      createLead.mockResolvedValueOnce({ ok: false, ambiguous: true });
      createLead.mockResolvedValueOnce({ ok: false, ambiguous: true });
      createLead.mockResolvedValueOnce({ ok: true, ambiguous: false, leadCode: "IMESUL-2", seller: { name: "Vendedor Teste", whatsapp: "5567900000000" } });

      const { openWhatsAppWithLead } = await import("../lib/leadWhatsApp");
      const args = { message: "Cenario 2 - timeout + retry", flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT, unit: COMMERCIAL_UNITS.CAMPO_GRANDE, pagePath: "teste" };

      await openWhatsAppWithLead(args); // timeout 1
      await openWhatsAppWithLead(args); // retry -> timeout 2
      await openWhatsAppWithLead(args); // retry -> sucesso

      expect(createLead).toHaveBeenCalledTimes(3);
      const ids = createLead.mock.calls.map(([{ clientRequestId }]) => clientRequestId);
      expect(ids[1]).toBe(ids[0]);
      expect(ids[2]).toBe(ids[0]);
    });

    it("3. timeout + reload da mesma aba -> 1 lead (sessionStorage sobrevive ao reload, diferente do Map antigo)", async () => {
      createLead.mockResolvedValueOnce({ ok: false, ambiguous: true });

      let leadWhatsApp = await import("../lib/leadWhatsApp");
      const args = { message: "Cenario 3 - timeout + reload", flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT, unit: COMMERCIAL_UNITS.CAMPO_GRANDE, pagePath: "teste" };

      await leadWhatsApp.openWhatsAppWithLead(args); // timeout - resultado ambiguo, antes do reload

      // Simula reload da pagina: zera o registro de modulos do Vitest (equivalente a reexecutar
      // todo o JS da pagina do zero) SEM tocar em globalThis.window.sessionStorage - exatamente
      // como um reload real preserva sessionStorage mas zera qualquer Map em memoria do JS.
      vi.resetModules();
      vi.doMock("../lib/douradosDispatch", () => ({ openDouradosWhatsApp }));
      vi.doMock("../lib/leads", () => ({ createLead }));
      vi.doMock("../lib/localAnalytics", () => ({ getAnonymousVisitorId: () => "visitor-teste" }));
      vi.doMock("../lib/trackEvent", () => ({ trackEvent: () => {} }));
      vi.doMock("../lib/commercialContactAlert", () => ({ notifyCommercialContactBlocked: () => {} }));

      createLead.mockResolvedValueOnce({ ok: true, ambiguous: false, leadCode: "IMESUL-3", seller: { name: "Vendedor Teste", whatsapp: "5567900000000" } });
      leadWhatsApp = await import("../lib/leadWhatsApp");
      await leadWhatsApp.openWhatsAppWithLead(args); // nova tentativa, POS-reload

      expect(createLead).toHaveBeenCalledTimes(2);
      const [{ clientRequestId: idAntesDoReload }] = createLead.mock.calls[0];
      const [{ clientRequestId: idDepoisDoReload }] = createLead.mock.calls[1];
      expect(idDepoisDoReload).toBe(idAntesDoReload);
    });

    it("4. sucesso definitivo -> entrada removida do sessionStorage", async () => {
      createLead.mockResolvedValueOnce({ ok: true, ambiguous: false, leadCode: "IMESUL-4", seller: { name: "Vendedor Teste", whatsapp: "5567900000000" } });

      const { openWhatsAppWithLead, pendingAttemptsStorageKey } = await import("../lib/leadWhatsApp");
      const args = { message: "Cenario 4 - sucesso remove entrada", flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT, unit: COMMERCIAL_UNITS.CAMPO_GRANDE, pagePath: "teste" };

      await openWhatsAppWithLead(args);

      const attemptKey = "visitor-teste|Cenario 4 - sucesso remove entrada";
      const stored = JSON.parse(window.sessionStorage.getItem(pendingAttemptsStorageKey) || "{}");
      expect(stored[attemptKey]).toBeUndefined();
    });

    it("5. TTL expirado -> gera clientRequestId novo", async () => {
      vi.useFakeTimers();
      try {
        createLead.mockResolvedValueOnce({ ok: false, ambiguous: true });
        createLead.mockResolvedValueOnce({ ok: true, ambiguous: false, leadCode: "IMESUL-5", seller: { name: "Vendedor Teste", whatsapp: "5567900000000" } });

        const { openWhatsAppWithLead } = await import("../lib/leadWhatsApp");
        const args = { message: "Cenario 5 - TTL expirado", flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT, unit: COMMERCIAL_UNITS.CAMPO_GRANDE, pagePath: "teste" };

        await openWhatsAppWithLead(args); // timeout - fica pendente
        vi.advanceTimersByTime(3 * 60 * 1000 + 1); // passa dos 3 minutos de TTL
        await openWhatsAppWithLead(args); // tentativa pendente ja expirou - conta como nova

        expect(createLead).toHaveBeenCalledTimes(2);
        const [{ clientRequestId: idAntes }] = createLead.mock.calls[0];
        const [{ clientRequestId: idDepois }] = createLead.mock.calls[1];
        expect(idDepois).not.toBe(idAntes);
      } finally {
        vi.useRealTimers();
      }
    });

    it("6. nova cotacao legitima (mensagem diferente) -> clientRequestId novo, sem afetar a tentativa pendente anterior", async () => {
      createLead.mockResolvedValueOnce({ ok: false, ambiguous: true });
      createLead.mockResolvedValueOnce({ ok: true, ambiguous: false, leadCode: "IMESUL-6", seller: { name: "Vendedor Teste", whatsapp: "5567900000000" } });

      const { openWhatsAppWithLead } = await import("../lib/leadWhatsApp");
      const primeiraTentativa = { message: "Cenario 6 - orcamento A", flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT, unit: COMMERCIAL_UNITS.CAMPO_GRANDE, pagePath: "teste" };
      const novaCotacao = { message: "Cenario 6 - orcamento B (diferente)", flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT, unit: COMMERCIAL_UNITS.CAMPO_GRANDE, pagePath: "teste" };

      await openWhatsAppWithLead(primeiraTentativa); // fica ambigua/pendente
      await openWhatsAppWithLead(novaCotacao); // mensagem diferente = tentativa independente

      expect(createLead).toHaveBeenCalledTimes(2);
      const [{ clientRequestId: idPrimeira }] = createLead.mock.calls[0];
      const [{ clientRequestId: idNova }] = createLead.mock.calls[1];
      expect(idNova).not.toBe(idPrimeira);
    });
  });
});
