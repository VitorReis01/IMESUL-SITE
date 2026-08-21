import { noStoreJson } from "./requestGuards";

export const isImebotEnabled = () => process.env.IMEBOT_ENABLED === "true";

export const imebotUnavailable = () =>
  noStoreJson({ ok: false, error: "IMEbot desativado nesta homologação." }, { status: 404 });
