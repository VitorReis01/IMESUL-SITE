"use client";

// Preferencia de unidade comercial (Dourados / Campo Grande). Armazenamento NECESSARIO para o
// funcionamento do site (rodizio, carrinho, lead) - nunca depende de consentimento de analytics
// (ver lib/consent.js, que so cobre analytics/localizacao, ambos opcionais). O site de vendas
// NAO faz deteccao propria de regiao: so recebe/herda a unidade do site institucional via
// ?unidade=, ou o cliente escolhe manualmente (quando essa UI existir).
import { isValidCommercialUnit } from "./leadFlow";

const unitStorageKey = "imesul_commercial_unit";

const canUseBrowserStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const getStoredUnit = () => {
  if (!canUseBrowserStorage()) return "";
  const stored = window.localStorage.getItem(unitStorageKey) || "";
  return isValidCommercialUnit(stored) ? stored : "";
};

export const setStoredUnit = (unit) => {
  if (!canUseBrowserStorage() || !isValidCommercialUnit(unit)) return;
  window.localStorage.setItem(unitStorageKey, unit);
};

// Le ?unidade= da URL atual, valida contra a allowlist e persiste quando valida. Chamar uma vez
// na entrada do site (ver components/ProjectSelector.jsx). Um acesso sem ?unidade= (ou com valor
// invalido) nao apaga uma preferencia ja salva - so devolve o que ja estava guardado.
export const captureUnitFromUrl = () => {
  if (typeof window === "undefined") return getStoredUnit();

  const param = new URLSearchParams(window.location.search).get("unidade");
  if (isValidCommercialUnit(param)) {
    setStoredUnit(param);
    return param;
  }

  return getStoredUnit();
};
