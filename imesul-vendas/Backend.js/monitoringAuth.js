import "server-only";
import { createHash, timingSafeEqual } from "crypto";

export const isMonitoringEnabled = () => process.env.MONITORING_ENABLED === "true";

const hashValue = (value) => createHash("sha256").update(String(value || ""), "utf8").digest();

export const isMonitoringRequestAuthorized = (request) => {
  const expected = process.env.MONITORING_HEALTH_SECRET || "";
  if (!expected) return false;

  const received = request.headers.get("x-monitoring-key") || "";
  return timingSafeEqual(hashValue(received), hashValue(expected));
};
