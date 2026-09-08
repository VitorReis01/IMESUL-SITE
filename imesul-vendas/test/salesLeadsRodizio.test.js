import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMMERCIAL_UNITS } from "../lib/leadFlow";

describe("seller assignment boundaries", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.doUnmock("../Backend.js/db"));

  it("Campo Grande cannot consume a turn outside lead creation", async () => {
    const query = vi.fn();
    vi.doMock("../Backend.js/db", () => ({ query, isDatabaseConfigured: () => true, withTransaction: vi.fn() }));
    const { assignNextSeller } = await import("../Backend.js/salesLeadsStore");
    await expect(assignNextSeller(COMMERCIAL_UNITS.CAMPO_GRANDE)).rejects.toThrow("Use createLead");
    expect(query).not.toHaveBeenCalled();
  });

  it("Dourados never queries sellers or the cursor", async () => {
    const query = vi.fn();
    vi.doMock("../Backend.js/db", () => ({ query, isDatabaseConfigured: () => true, withTransaction: vi.fn() }));
    const { assignNextSeller } = await import("../Backend.js/salesLeadsStore");
    expect(await assignNextSeller(COMMERCIAL_UNITS.DOURADOS)).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("legacy unscoped assignment remains unchanged", async () => {
    const seller = { id: 7, name: "Seller", whatsapp: "5567900000000" };
    const query = vi.fn().mockResolvedValue({ rows: [seller] });
    vi.doMock("../Backend.js/db", () => ({ query, isDatabaseConfigured: () => true, withTransaction: vi.fn() }));
    const { assignNextSeller } = await import("../Backend.js/salesLeadsStore");
    expect(await assignNextSeller()).toEqual(seller);
    expect(query.mock.calls[0][0]).toContain("FOR UPDATE SKIP LOCKED");
    expect(query.mock.calls[0][1]).toEqual([]);
  });

  // A partir desta rodada, TODA a regiao critica de Campo Grande (dedup + lock do cursor +
  // escolha do vendedor + INSERT + avanco do cursor) roda numa UNICA chamada a funcao PL/pgSQL
  // campo_grande_create_lead - 1 round-trip via query() (pool, sem client/withTransaction). Ver
  // db/migrations/008_campo_grande_create_lead_function.sql para a funcao em si.

  it("duplicate found: campo_grande_create_lead devolve deduped=true, sem tentar criar de novo", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] }) // dedup rapido antes de chamar a funcao (findLeadByIdempotencyKey)
      .mockResolvedValueOnce({
        rows: [{
          lead_id: "42", lead_code: "IMESUL-EXISTING", seller_id: "7",
          seller_name: "Seller", seller_whatsapp: "5567900000000",
          deduped: true, no_active_seller: false,
        }],
      })
      .mockResolvedValueOnce({ rowCount: 0 }); // flushRotationCreationAudit (best-effort, pos-resultado)
    vi.doMock('../Backend.js/db', () => ({ query, isDatabaseConfigured: () => true, withTransaction: vi.fn() }));
    const { createLead } = await import('../Backend.js/salesLeadsStore');
    const result = await createLead({ unit: 'campo-grande', clientRequestId: 'same-request' });
    expect(result).toMatchObject({ ok: true, deduped: true, leadCode: "IMESUL-EXISTING" });
    expect(query).toHaveBeenCalledTimes(3); // dedup rapido + campo_grande_create_lead + flush audit
    expect(query.mock.calls[1][0]).toContain("campo_grande_create_lead");
  });

  it("no active seller: campo_grande_create_lead devolve no_active_seller=true, sem inserir nem avancar", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ lead_id: null, lead_code: null, seller_id: null, seller_name: null, seller_whatsapp: null, deduped: false, no_active_seller: true }],
      });
    vi.doMock('../Backend.js/db', () => ({ query, isDatabaseConfigured: () => true, withTransaction: vi.fn() }));
    const { createLead } = await import('../Backend.js/salesLeadsStore');
    expect(await createLead({ unit: 'campo-grande', clientRequestId: 'new-request' })).toMatchObject({ ok: false, code: 'NO_ACTIVE_SELLER' });
    // NO_ACTIVE_SELLER lanca antes de chegar no flushAudit (ver createLead) - so as 2 chamadas.
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("candidate found: 1 unica chamada a campo_grande_create_lead cria o lead - nunca usa client/withTransaction", async () => {
    const withTransaction = vi.fn();
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          lead_id: "99", lead_code: "IMESUL-NOVO", seller_id: "7",
          seller_name: "Seller", seller_whatsapp: "5567900000000",
          deduped: false, no_active_seller: false,
        }],
      })
      .mockResolvedValueOnce({ rowCount: 0 });
    vi.doMock('../Backend.js/db', () => ({ query, isDatabaseConfigured: () => true, withTransaction }));
    const { createLead } = await import('../Backend.js/salesLeadsStore');
    const result = await createLead({ unit: 'campo-grande', clientRequestId: 'brand-new-request', quoteSummary: "teste" });
    expect(result).toMatchObject({ ok: true, leadCode: "IMESUL-NOVO", seller: { id: "7" } });
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[1][0]).toContain("SELECT * FROM campo_grande_create_lead");
    // Nunca abre transacao/client dedicado para Campo Grande - a chamada de funcao ja e atomica.
    expect(withTransaction).not.toHaveBeenCalled();
  });
});
