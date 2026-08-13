"use client";

import { createContext, useContext } from "react";
import {
  COMPATIBILITY_MODES,
  getUnknownCapabilities,
} from "../lib/browserCapabilities";

export const CompatibilityContext = createContext({
  mode: COMPATIBILITY_MODES.FULL,
  capabilities: getUnknownCapabilities(),
  ready: false,
});

// Ponto unico de leitura das capacidades do navegador.
// Nesta etapa ele apenas expõe dados; os componentes visuais ainda não mudam comportamento.
export default function useCompatibility() {
  return useContext(CompatibilityContext);
}

