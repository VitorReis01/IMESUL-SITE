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
};
