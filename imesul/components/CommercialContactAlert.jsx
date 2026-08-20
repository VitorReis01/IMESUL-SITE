"use client";

// Aviso discreto quando o backend não consegue direcionar o cliente automaticamente para um
// vendedor de Campo Grande - ver lib/commercialContactAlert.js. NUNCA abre o WhatsApp com o
// número padrão nesse caso (esse número vai virar o IMEbot - ver relatório desta fase).
import { useEffect, useState } from "react";
import { subscribeToCommercialContactBlocked } from "../lib/commercialContactAlert";

export default function CommercialContactAlert() {
  const [retry, setRetry] = useState(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(
    () =>
      subscribeToCommercialContactBlocked(({ retry: retryFn }) => {
        setRetrying(false);
        setRetry(() => retryFn || null);
      }),
    []
  );

  if (!retry) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-24 z-[195] px-4 sm:bottom-28 sm:px-6">
      <div className="mx-auto flex max-w-[520px] flex-col gap-3 rounded-[10px] border border-amber-300 bg-white p-4 text-center shadow-[0_16px_40px_rgba(15,23,42,0.2)] sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p className="text-[13px] leading-relaxed text-slate-600">
          Não conseguimos direcionar seu atendimento automaticamente agora. Nada foi perdido —
          você pode tentar novamente.
        </p>
        <div className="flex shrink-0 items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="min-h-10 rounded-[7px] border border-amber-500 px-4 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-amber-700 transition-colors hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60"
          >
            {retrying ? "Tentando..." : "Tentar novamente"}
          </button>
          <button
            type="button"
            onClick={() => setRetry(null)}
            aria-label="Fechar aviso"
            className="min-h-10 rounded-[7px] px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500 transition-colors hover:text-slate-900"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
