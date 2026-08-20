"use client";

// Preferência de unidade comercial (Dourados/Campo Grande) do site INSTITUCIONAL. Storage
// próprio e independente do site de vendas (domínios separados - nunca compartilhar
// localStorage entre eles, ver relatório desta fase). É uma preferência NECESSÁRIA (define para
// qual unidade os CTAs comerciais apontam) e funciona mesmo sem consentimento de analytics.
export const COMMERCIAL_UNITS = {
  DOURADOS: "dourados",
  CAMPO_GRANDE: "campo-grande",
};

const unitStorageKey = "imesul_institucional_unit";

const canUseBrowserStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const isValidUnit = (value) => value === COMMERCIAL_UNITS.DOURADOS || value === COMMERCIAL_UNITS.CAMPO_GRANDE;

// Fonte única de configuração comercial por unidade NESTE site (instrução explícita do usuário -
// "não espalhar número hardcoded em vários componentes"). Espelha
// imesul-vendas/lib/leadFlow.js COMMERCIAL_UNIT_CONFIG - os dois apps são deploys separados sem
// pacote compartilhado, então os valores precisam ficar sincronizados manualmente entre os dois
// (mesmo padrão já usado para COMMERCIAL_UNITS/unitPreference). Campo Grande não tem "phone" de
// propósito: o rodízio (no backend de vendas) sempre decide o número, nunca um fallback fixo
// aqui. Dourados tem o número humano oficial confirmado pelo usuário em 2026-08-20 - nunca
// 556733125600 (número do futuro IMEbot).
export const COMMERCIAL_UNIT_CONFIG = {
  [COMMERCIAL_UNITS.CAMPO_GRANDE]: {
    name: "IMESUL Campo Grande",
    rotationEnabled: true,
    imebotEnabled: true,
  },
  [COMMERCIAL_UNITS.DOURADOS]: {
    name: "IMESUL Dourados — Centro",
    phone: "556734275700",
    address: "Rua Pedro Rigotti, 248 - Jd. São Pedro, Dourados/MS",
    rotationEnabled: false,
    imebotEnabled: false,
  },
};

export const getCommercialUnitConfig = (unit) => COMMERCIAL_UNIT_CONFIG[unit] || null;

const unitEventName = "imesul-institucional-unit-updated";

export const getStoredUnit = () => {
  if (!canUseBrowserStorage()) return null;
  const value = window.localStorage.getItem(unitStorageKey);
  return isValidUnit(value) ? value : null;
};

export const setStoredUnit = (unit) => {
  if (!canUseBrowserStorage() || !isValidUnit(unit)) return;
  window.localStorage.setItem(unitStorageKey, unit);
  window.dispatchEvent(new CustomEvent(unitEventName));
};

// Snapshot bruto (string ou "") para uso com useSyncExternalStore - evita ler localStorage
// direto no corpo do render (mismatch de hidratação) ou via setState dentro de um efeito (ver
// components/FinalCTA.jsx e ProductScrollExperience.jsx, mesmo padrão já usado em
// imesul-vendas/lib/consent.js).
export const getStoredUnitRaw = () => getStoredUnit() || "";
export const getServerUnitRaw = () => "";

export const subscribeToUnit = (callback) => {
  if (!canUseBrowserStorage()) return () => {};
  window.addEventListener(unitEventName, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(unitEventName, callback);
    window.removeEventListener("storage", callback);
  };
};

// Lê ?unidade= da URL atual (ex.: vindo de um link "VER SITE DE VENDAS" já filtrado por unidade,
// ou de campanha) e persiste como preferência - nunca sobrescreve com um valor inválido.
export const captureUnitFromUrl = () => {
  if (typeof window === "undefined") return getStoredUnit();

  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("unidade");
  if (isValidUnit(fromUrl)) {
    setStoredUnit(fromUrl);
    return fromUrl;
  }

  return getStoredUnit();
};
