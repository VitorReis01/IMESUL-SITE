import { isImebotEnabled } from "../../../../Backend.js/imebotFeatureGate";
import { noStoreJson } from "../../../../Backend.js/requestGuards";

export function GET() {
  if (!isImebotEnabled()) {
    return noStoreJson({ status: "disabled", imebot: "disabled" });
  }

  return noStoreJson({ status: "ok", imebot: "enabled" });
}
