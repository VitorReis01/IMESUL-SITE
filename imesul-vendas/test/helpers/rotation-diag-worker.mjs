// Worker de diagnostico (nao faz parte da suite comitada de verificacao) - cada request mede seu
// proprio tempo total de createLead(). Roda em processo separado (fork).
import { createLead } from "../../Backend.js/salesLeadsStore.js";

process.send({ ready: true });
process.once("message", async ({ count, prefix }) => {
  try {
    const results = await Promise.all(
      Array.from({ length: count }, (_, index) => {
        const start = Date.now();
        return createLead({
          unit: "campo-grande",
          visitorId: `${prefix}-${index}`,
          clientRequestId: `${prefix}-${index}`,
          quoteSummary: "Diagnostico de gargalo do rodizio - funcao SQL",
        }).then((result) => ({ ...result, __ms: Date.now() - start }));
      })
    );
    process.send({ results }, () => process.exit(0));
  } catch (error) {
    process.send({ error: error.message }, () => process.exit(1));
  }
});
