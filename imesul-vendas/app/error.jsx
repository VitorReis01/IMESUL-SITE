"use client";

import { useEffect } from "react";

// Assinatura de erro do runtime do bundler quando o navegador tenta buscar um chunk que nao existe
// mais (build anterior ja foi substituido em .next/standalone - ver scripts/prepare-standalone.mjs).
// "l[e] is not a function" e variantes minificadas caem aqui.
const STALE_BUILD_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk [\d]+ failed|is not a function|Failed to fetch dynamically imported module/i;
const RELOAD_STORAGE_KEY = "imesul-stale-build-reload-at";
const RELOAD_COOLDOWN_MS = 10000;

// Permite repetir o fluxo depois de uma falha sem expor detalhes internos.
export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const looksLikeStaleBuild =
      error?.name === "ChunkLoadError" || STALE_BUILD_ERROR_PATTERN.test(error?.message || "");
    if (!looksLikeStaleBuild) return;

    // So recarrega uma vez por janela de tempo - evita loop infinito se o erro nao for de build
    // desatualizado (ex.: bug real de app cujo TypeError bate por acaso no mesmo padrao).
    let lastReloadAt = 0;
    try {
      lastReloadAt = Number(window.sessionStorage.getItem(RELOAD_STORAGE_KEY) || 0);
    } catch {
      // sessionStorage indisponivel (modo privado etc.) - segue sem o guard de cooldown.
    }
    if (Date.now() - lastReloadAt < RELOAD_COOLDOWN_MS) return;

    try {
      window.sessionStorage.setItem(RELOAD_STORAGE_KEY, String(Date.now()));
    } catch {
      // Sem storage disponivel: ainda assim vale tentar o reload uma vez.
    }
    window.location.reload();
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#06101d] px-6 text-center text-white">
      <div className="max-w-lg">
        <p className="font-mono text-xs tracking-[0.3em] text-imesul-red">IMESUL</p>
        <h1 className="mt-4 font-display text-6xl leading-none">Não foi possível carregar essa área agora</h1>
        <p className="mt-5 text-imesul-steel-light/80">Tente novamente em instantes.</p>
        <button className="mt-8 bg-imesul-red px-6 py-3 font-condensed font-bold uppercase tracking-[0.14em]" type="button" onClick={() => reset()}>
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
