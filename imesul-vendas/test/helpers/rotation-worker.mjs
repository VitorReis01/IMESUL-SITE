import { createLead } from "../../Backend.js/salesLeadsStore.js";

process.send({ ready: true });
process.once("message", async ({ count, prefix, sameKey }) => {
  try {
    const results = await Promise.all(Array.from({ length: count }, (_, index) => createLead({
      unit: "campo-grande", visitorId: sameKey || `${prefix}-${index}`,
      clientRequestId: sameKey || `${prefix}-${index}`, quoteSummary: "Round robin isolated test",
    })));
    process.send({ results }, () => process.exit(0));
  } catch (error) {
    process.send({ error: error.message }, () => process.exit(1));
  }
});
