import { isMonitoringRequestAuthorized } from "../../../../Backend.js/monitoringAuth";
import { noStoreJson } from "../../../../Backend.js/requestGuards";
import { query } from "../../../../Backend.js/db";

const timeoutMs = 1500;

const withTimeout = (promise) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), timeoutMs);
    }),
  ]);

export async function GET(request) {
  if (!isMonitoringRequestAuthorized(request)) {
    return noStoreJson({ status: "unauthorized" }, { status: 401 });
  }

  try {
    await withTimeout(query("SELECT 1"));
    return noStoreJson({ status: "ok", database: "ok" });
  } catch {
    return noStoreJson({ status: "degraded", database: "unavailable" }, { status: 503 });
  }
}
