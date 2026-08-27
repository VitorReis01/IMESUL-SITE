"use client";

// Regiao comercial CONFIRMADA (Dourados / Campo Grande). So deve ser escrita quando o cliente
// realmente informou/confirmou uma cidade - formulario de orcamento (ver
// components/QuoteBuilder.jsx#resolveCityRegion) ou o seletor manual do modal
// (lib/commercialContact.js#requestCommercialContact, apos lib/unitPickerBridge.js resolver).
//
// sessionStorage de proposito (instrucao explicita do usuario): a confirmacao vale so durante a
// sessao de navegacao atual - fechar a aba/navegador e voltar depois deve resolver a regiao de
// novo, nunca encaminhar um cliente com base numa cidade informada dias atras. Isso e diferente
// do restante do projeto (carrinho, consentimento, unitPreference antigo), que usa localStorage
// de proposito para persistir entre visitas - aqui e o oposto, por decisao de negocio.
//
// NUNCA escrita so por causa de ?unidade= na URL - isso e so um HINT (ver getUnitHint/
// captureUnitHintFromUrl mais abaixo, storage SEPARADO) - instrucao explicita do usuario: hint
// nunca e autoridade suficiente para pular a resolucao de regiao de um contato direto.
import { isValidCommercialUnit } from "./leadFlow";

const unitStorageKey = "imesul_commercial_unit";
const unitEventName = "imesul-commercial-unit-updated";

const canUseSessionStorage = () =>
  typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

export const getStoredUnit = () => {
  if (!canUseSessionStorage()) return "";
  const stored = window.sessionStorage.getItem(unitStorageKey) || "";
  return isValidCommercialUnit(stored) ? stored : "";
};

export const setStoredUnit = (unit) => {
  if (!canUseSessionStorage() || !isValidCommercialUnit(unit)) return;
  window.sessionStorage.setItem(unitStorageKey, unit);
  window.dispatchEvent(new CustomEvent(unitEventName));
};

// So o evento same-tab importa aqui (sessionStorage nunca dispara o evento nativo "storage" -
// esse evento so existe para localStorage compartilhado entre abas da mesma origem, e cada aba
// tem sua PRÓPRIA sessionStorage; nao ha nada para sincronizar entre abas de proposito).
export const subscribeToUnitPreference = (callback) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(unitEventName, callback);
  return () => window.removeEventListener(unitEventName, callback);
};

// --- HINT (?unidade=): so contexto/compatibilidade com links antigos do institucional. NUNCA
// autoridade para decidir o fluxo comercial de um contato direto - ver
// lib/commercialContact.js#requestCommercialContact, que so olha para getStoredUnit() acima
// (a regiao CONFIRMADA), nunca para o hint. Guardado num storage separado de proposito, para
// nunca ser confundido com uma regiao confirmada. localStorage aqui (nao sessionStorage) - o
// hint e so um dado de contexto/compatibilidade, sem o mesmo requisito de negocio de "valer so
// durante a sessao" que a regiao confirmada tem. ---------------------------------------------

const unitHintStorageKey = "imesul_commercial_unit_hint";
const unitHintEventName = "imesul-commercial-unit-hint-updated";

const canUseLocalStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const getUnitHint = () => {
  if (!canUseLocalStorage()) return "";
  const stored = window.localStorage.getItem(unitHintStorageKey) || "";
  return isValidCommercialUnit(stored) ? stored : "";
};

const setUnitHint = (unit) => {
  if (!canUseLocalStorage() || !isValidCommercialUnit(unit)) return;
  window.localStorage.setItem(unitHintStorageKey, unit);
  window.dispatchEvent(new CustomEvent(unitHintEventName));
};

export const subscribeToUnitHint = (callback) => {
  if (!canUseLocalStorage()) return () => {};
  window.addEventListener(unitHintEventName, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(unitHintEventName, callback);
    window.removeEventListener("storage", callback);
  };
};

// Le ?unidade= da URL atual e guarda SO como hint (nunca como regiao confirmada - ver comentario
// no topo do arquivo). Chamar uma vez na entrada do site (ver components/ProjectSelector.jsx). Um
// acesso sem ?unidade= (ou com valor invalido) nao apaga um hint ja guardado - so devolve o que ja
// estava guardado.
export const captureUnitHintFromUrl = () => {
  if (typeof window === "undefined") return getUnitHint();

  const param = new URLSearchParams(window.location.search).get("unidade");
  if (isValidCommercialUnit(param)) {
    setUnitHint(param);
    return param;
  }

  return getUnitHint();
};
