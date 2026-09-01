import "server-only";
import { sanitizeMonitoringData } from "../lib/monitoring/sanitize";

const write = (level, event, data = {}) => {
  const payload = sanitizeMonitoringData({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...data,
  });
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
};

export const logger = {
  info: (event, data) => write("info", event, data),
  warn: (event, data) => write("warn", event, data),
  error: (event, data) => write("error", event, data),
  // Mesmos console.warn/console.error de sempre - so marcam category:"SECURITY"/"CIRCUIT_BREAKER"
  // no payload, para dar pra filtrar/alertar por esse tipo de evento no provedor de log (Better
  // Stack, etc.) sem precisar de um sistema de observabilidade novo. Ver RELIABILITY.md.
  security: (event, data) => write("warn", event, { ...data, category: "SECURITY" }),
  circuitBreaker: (event, data) => write("warn", event, { ...data, category: "CIRCUIT_BREAKER" }),
};
