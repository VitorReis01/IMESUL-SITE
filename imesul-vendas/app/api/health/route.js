import { noStoreJson } from "../../../Backend.js/requestGuards";

export function GET() {
  return noStoreJson({ status: "ok", service: "imesul-vendas" });
}
