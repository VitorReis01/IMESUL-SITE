"use client";

// Modal "Vamos encontrar o atendimento certo para você" - abre SOMENTE quando um CTA comercial
// direto (navbar, WhatsApp flutuante, carrinho, card de contato) precisa da região e ainda não há
// região CONFIRMADA (ver lib/commercialContact.js e lib/unitPickerBridge.js). Nunca abre sozinho.
// Formulários de orçamento nunca abrem este modal - já coletam cidade e resolvem a região sozinhos
// (ver components/QuoteBuilder.jsx).
//
// A região comercial é uma divisão COMERCIAL (lib/commercialRegions.js), não geográfica - Corumbá
// pertence a Dourados mesmo estando fisicamente mais perto de Campo Grande. Por isso NUNCA decidir
// por distância/proximidade.
//
// "USAR MINHA LOCALIZAÇÃO" TEMPORARIAMENTE OCULTO (instrução explícita do usuário): sem um
// mecanismo confiável de coordenadas -> município (reverse geocoding real, não aprovado/adicionado
// nesta fase), não faz sentido oferecer esse botão prometendo uma ação que hoje não existe de
// verdade. O modal já vai direto para o seletor manual de cidade. A arquitetura por trás continua
// pronta e sem impacto (lib/unitPickerBridge.js#requestUnitChoice/resolveUnitRequests,
// lib/commercialRegions.js, lib/consent.js#requestDeviceLocationOnce já usado noutro fluxo) -
// quando existir um provedor aprovado de coordenadas -> município, reintroduzir aqui um passo
// inicial com o botão "Usar minha localização" chamando esse provedor e depois
// getCommercialRegionByCity(municipio) antes de resolve(...).
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { subscribeToUnitRequests, resolveUnitRequests } from "../lib/unitPickerBridge";
import { ALL_MS_COMMERCIAL_CITIES, getCommercialRegionByCity } from "../lib/commercialRegions";
import { trackEvent } from "../lib/trackEvent";

const selectClassName =
  "h-14 w-full rounded-[8px] border border-white/[0.12] bg-[#071828] px-4 text-[16px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] outline-none transition-all duration-200 hover:border-white/[0.2] focus:border-imesul-red/75 focus:bg-[#0a1d30] focus:ring-4 focus:ring-imesul-red/[0.08]";

export default function CommercialRegionModal() {
  const [open, setOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState("");

  useEffect(
    () =>
      subscribeToUnitRequests(() => {
        setSelectedCity("");
        setOpen(true);
      }),
    []
  );

  const resolve = useCallback((unit) => {
    setOpen(false);
    if (unit) trackEvent("select_unit", { unit });
    resolveUnitRequests(unit || undefined);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") resolve(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, resolve]);

  const confirmCity = () => {
    if (!selectedCity) return;
    resolve(getCommercialRegionByCity(selectedCity));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => resolve(null)}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Escolha da região de atendimento"
        className="relative w-full max-w-md overflow-hidden rounded-[14px] border border-white/[0.1] bg-[linear-gradient(145deg,rgba(12,30,51,0.98),rgba(6,16,29,0.99))] p-6 text-center shadow-[0_30px_80px_rgba(0,0,0,0.5)] sm:p-8"
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => resolve(null)}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-imesul-steel-light/60 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <h2 className="font-display text-[clamp(1.5rem,6vw,1.9rem)] uppercase leading-tight text-white">
          Vamos encontrar o atendimento certo para você
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-imesul-steel-light/75">
          Para direcionar sua solicitação à unidade que atende sua região, informe sua cidade.
        </p>

        <div className="mt-7 text-left">
          <label className="block">
            <span className="mb-2 block font-condensed text-[13px] font-semibold uppercase tracking-[0.13em] text-imesul-steel-light/85">
              Estado
            </span>
            <input
              type="text"
              value="Mato Grosso do Sul"
              disabled
              className={`${selectClassName} cursor-not-allowed opacity-70`}
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block font-condensed text-[13px] font-semibold uppercase tracking-[0.13em] text-imesul-steel-light/85">
              Cidade
            </span>
            <select
              value={selectedCity}
              onChange={(event) => setSelectedCity(event.target.value)}
              className={selectClassName}
            >
              <option value="">Selecione</option>
              {ALL_MS_COMMERCIAL_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={confirmCity}
            disabled={!selectedCity}
            className="mt-5 min-h-12 w-full rounded-[8px] border border-white/[0.12] bg-[#25D366] font-condensed text-sm font-bold uppercase tracking-[0.1em] text-white shadow-[0_16px_48px_rgba(37,211,102,0.24)] transition-all hover:-translate-y-0.5 hover:bg-[#1ebe5d] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
