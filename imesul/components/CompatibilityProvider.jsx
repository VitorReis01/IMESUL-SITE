"use client";

import { useEffect, useMemo, useState } from "react";
import { CompatibilityContext } from "../hooks/useCompatibility";
import {
  COMPATIBILITY_MODES,
  classifyCompatibilityMode,
  detectBrowserCapabilities,
  getUnknownCapabilities,
} from "../lib/browserCapabilities";

const DEFAULT_STATE = {
  mode: COMPATIBILITY_MODES.FULL,
  capabilities: getUnknownCapabilities(),
  ready: false,
};

// Calcula capacidades reais do navegador no client sem afetar a experiência atual.
// Os fallbacks visuais serão conectados em etapas futuras.
export default function CompatibilityProvider({ children }) {
  const [state, setState] = useState(DEFAULT_STATE);

  useEffect(() => {
    let cancelled = false;

    const updateCapabilities = () => {
      try {
        const capabilities = detectBrowserCapabilities();
        const mode = classifyCompatibilityMode(capabilities);

        if (!cancelled) {
          setState({ mode, capabilities, ready: true });
        }
      } catch {
        if (!cancelled) {
          setState({
            mode: COMPATIBILITY_MODES.FALLBACK,
            capabilities: getUnknownCapabilities(),
            ready: true,
          });
        }
      }
    };

    updateCapabilities();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      mode: state.mode,
      capabilities: state.capabilities,
      ready: state.ready,
      isFull: state.mode === COMPATIBILITY_MODES.FULL,
      isReduced: state.mode === COMPATIBILITY_MODES.REDUCED,
      isFallback: state.mode === COMPATIBILITY_MODES.FALLBACK,
    }),
    [state]
  );

  return (
    <CompatibilityContext.Provider value={value}>
      {children}
    </CompatibilityContext.Provider>
  );
}
