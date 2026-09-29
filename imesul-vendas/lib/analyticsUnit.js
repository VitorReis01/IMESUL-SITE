"use client";

// Unidade usada SO para escolher a propriedade GA4 (analytics). Regra de negocio (arquitetura de
// Google Tags aprovada, sem tag geral/mediadora):
//   /                      -> Campo Grande
//   /campogrande           -> Campo Grande   (tambem /campo-grande)
//   /dourados              -> Dourados       (tambem /douradosmatriz)
// Qualquer outra rota mantem a unidade ja decidida NA SESSAO (sessionStorage) e, sem decisao, usa
// Campo Grande. A rota SEMPRE vence a unidade guardada: uma preferencia antiga nunca faz Campo
// Grande disparar em /dourados. A unidade da sessao existe porque /dourados redireciona para "/"
// na hora - sem ela o visitante voltaria a ser medido por Campo Grande logo em seguida.
//
// Totalmente separada da regiao comercial (lib/unitPreference.js, imesul_commercial_unit): nada aqui
// le nem grava a chave comercial, e nada comercial (WhatsApp, vendedor, rodizio, lead) le esta chave.
// Tambem independente do consentimento: quem decide se o GA4 carrega e components/TrackingScripts.jsx.
import { COMMERCIAL_UNITS, isValidCommercialUnit } from "./leadFlow";

const analyticsUnitStorageKey = "imesul_analytics_unit";
const analyticsUnitEventName = "imesul-analytics-unit-updated";

// Unidade definida PELA ROTA, ou "" quando a rota nao decide (fica a da sessao / Campo Grande).
export const getAnalyticsUnitForPath = (pathname) => {
  const path = String(pathname || "").toLowerCase().replace(/\/+$/, "") || "/";
  if (path === "/dourados" || path === "/douradosmatriz") return COMMERCIAL_UNITS.DOURADOS;
  if (path === "/campogrande" || path === "/campo-grande") return COMMERCIAL_UNITS.CAMPO_GRANDE;
  return "";
};

// Decisao unica da propriedade: rota > unidade da sessao > Campo Grande.
export const resolveAnalyticsUnit = (pathname, sessionUnit) =>
  getAnalyticsUnitForPath(pathname) ||
  (isValidCommercialUnit(sessionUnit) ? sessionUnit : "") ||
  COMMERCIAL_UNITS.CAMPO_GRANDE;

// Acessar window.sessionStorage/localStorage pode LANCAR (SecurityError) com storage bloqueado -
// leitura e escrita sempre protegidas, nunca derrubam o fluxo.
const safe = (action) => {
  try {
    return action();
  } catch {
    return "";
  }
};

export const getSessionAnalyticsUnit = () => {
  if (typeof window === "undefined") return "";
  const stored = safe(() => window.sessionStorage.getItem(analyticsUnitStorageKey)) || "";
  return isValidCommercialUnit(stored) ? stored : "";
};

export const setSessionAnalyticsUnit = (unit) => {
  if (typeof window === "undefined" || !isValidCommercialUnit(unit)) return;
  if (getSessionAnalyticsUnit() === unit) return;
  safe(() => window.sessionStorage.setItem(analyticsUnitStorageKey, unit));
  window.dispatchEvent(new CustomEvent(analyticsUnitEventName));
};

export const subscribeToAnalyticsUnit = (callback) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(analyticsUnitEventName, callback);
  return () => window.removeEventListener(analyticsUnitEventName, callback);
};

// Versoes anteriores guardavam a unidade em localStorage (persistia entre visitas). Nunca mais lida:
// removida para nao ficar lixo e para garantir que nada antigo influencie a tag.
export const purgeLegacyAnalyticsUnit = () => {
  if (typeof window === "undefined") return;
  safe(() => window.localStorage.removeItem(analyticsUnitStorageKey));
};
