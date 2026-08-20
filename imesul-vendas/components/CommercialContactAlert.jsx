"use client";

// Aviso discreto quando o backend não consegue direcionar o cliente automaticamente para um
// vendedor de Campo Grande (rodízio sem vendedor ativo, etc.) - ver
// lib/commercialContactAlert.js. NUNCA abre o WhatsApp com o número padrão nesse caso (esse
// número vai virar o IMEbot - ver relatório desta fase). O pedido/carrinho do cliente nunca é
// perdido: este componente só oferece tentar de novo, sem limpar nada em outro lugar da página.
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
      <div className="mx-auto flex max-w-[520px] flex-col gap-3 rounded-[10px] border border-[#f0c776]/40 bg-[#241a0c] p-4 text-center shadow-[0_16px_40px_rgba(0,0,0,0.4)] sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p className="text-[13px] leading-relaxed text-imesul-steel-light/85">
          Não conseguimos direcionar seu atendimento automaticamente agora. Seus dados não foram
          perdidos — você pode tentar novamente.
        </p>
        <div className="flex shrink-0 items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="min-h-10 rounded-[7px] border border-[#f0c776] px-4 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-[#f0c776] transition-colors hover:bg-[#f0c776]/10 disabled:cursor-wait disabled:opacity-60"
          >
            {retrying ? "Tentando..." : "Tentar novamente"}
          </button>
          <button
            type="button"
            onClick={() => setRetry(null)}
            aria-label="Fechar aviso"
            className="min-h-10 rounded-[7px] px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-imesul-steel-light/60 transition-colors hover:text-white"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
