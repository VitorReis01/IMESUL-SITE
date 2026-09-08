import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runBestEffortTask } from "../app/api/leads/route";
import { logger } from "../Backend.js/logger";

// Cobre a correção do achado P1 do CAPACITY_PLANNING.md: linkCartToLead/notifyImebotOfNewLead
// eram chamados sem await em app/api/leads/route.js, sem garantia de terminar antes da function
// serverless ser congelada (agora agendados via next/server#after - ver route.js). O contrato
// testável aqui, sem precisar invocar a rota HTTP inteira (nenhuma rota de API deste projeto tem
// teste direto - ver CLAUDE.md), é a função extraída que envolve cada tarefa: nunca deve rejeitar
// (isso viraria unhandled rejection dentro de after()) e deve logar com segurança em caso de
// falha, nunca a resposta do lead em si (que já foi enviada ao cliente antes de after() rodar).
describe("runBestEffortTask (app/api/leads/route.js)", () => {
  beforeEach(() => {
    vi.spyOn(logger, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tarefa que resolve com sucesso: não loga nada, resolve normalmente", async () => {
    await expect(runBestEffortTask("linkCartToLead", Promise.resolve("ok"))).resolves.toBe("ok");
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("tarefa que rejeita: NUNCA propaga a rejeição (nunca vira unhandled rejection)", async () => {
    const failing = Promise.reject(new Error("falha ao notificar IMEbot"));

    await expect(runBestEffortTask("notifyImebotOfNewLead", failing)).resolves.toBeUndefined();
  });

  it("tarefa que rejeita: loga com segurança (evento + nome da tarefa + só a mensagem do erro, nunca o objeto de erro cru)", async () => {
    const err = new Error("timeout ao conectar no banco");
    await runBestEffortTask("linkCartToLead", Promise.reject(err));

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith("post_lead_task_failed", {
      task: "linkCartToLead",
      reason: "timeout ao conectar no banco",
    });
  });

  it("rejeição sem Error (ex.: string lançada) ainda é tratada, sem lançar", async () => {
    await expect(runBestEffortTask("notifyImebotOfNewLead", Promise.reject("motivo cru"))).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith("post_lead_task_failed", {
      task: "notifyImebotOfNewLead",
      reason: "motivo cru",
    });
  });
});
