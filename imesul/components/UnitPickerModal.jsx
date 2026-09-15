"use client";

// Modal "De onde você deseja atendimento?" - abre SOMENTE quando um CTA comercial precisa da
// unidade e não há preferência salva ainda (ver lib/unitPickerBridge.js e
// lib/commercialContact.js). Nunca abre sozinho/automaticamente. "Usar minha localização" só
// pede geolocalização depois do clique explícito neste botão - nunca antes.
import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeToUnitRequests, resolveUnitRequests } from "../lib/unitPickerBridge";
import { requestDeviceLocationOnce } from "../lib/consent";
import { estimateUnitFromCoordinates } from "../lib/regionResolver";
import { COMMERCIAL_UNITS } from "../lib/unitPreference";
import { trackEvent } from "../lib/trackEvent";

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function UnitPickerModal() {
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => subscribeToUnitRequests(() => setOpen(true)), []);

  const choose = useCallback((unit) => {
    setOpen(false);
    setLocating(false);
    if (unit) trackEvent("select_unit", { unit });
    resolveUnitRequests(unit || undefined);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") choose(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, choose]);

  // Foco inicial no dialog, focus trap (Tab/Shift+Tab preso dentro do modal) e restauracao do
  // foco no elemento que abriu o modal ao fechar.
  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedRef.current = document.activeElement;
    const dialog = dialogRef.current;
    const focusTimer = window.setTimeout(() => dialog?.focus(), 0);

    const handleTabTrap = (event) => {
      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll(focusableSelector)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleTabTrap);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleTabTrap);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  const useMyLocation = async () => {
    setLocating(true);
    const result = await requestDeviceLocationOnce();
    setLocating(false);

    if (result.status !== "granted") {
      // Negado/indisponível: nunca bloqueia o cliente - segue com a escolha manual no modal.
      return;
    }

    choose(estimateUnitFromCoordinates(result));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => choose(null)}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Escolha de unidade de atendimento"
        className="relative w-full max-w-md rounded-[14px] border border-slate-200 bg-white p-7 text-center shadow-[0_30px_80px_rgba(15,23,42,0.25)] sm:p-8"
      >
        <h2 className="font-display text-2xl uppercase leading-tight text-slate-900 sm:text-3xl">
          De onde você deseja atendimento?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Assim conseguimos direcionar você para a unidade e o vendedor certos.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => choose(COMMERCIAL_UNITS.DOURADOS)}
            className="min-h-12 rounded-[8px] border border-imesul-red bg-imesul-red font-condensed text-sm font-bold uppercase tracking-[0.12em] text-white transition-all hover:-translate-y-0.5 hover:bg-[#ef3434]"
          >
            Dourados
          </button>
          <button
            type="button"
            onClick={() => choose(COMMERCIAL_UNITS.CAMPO_GRANDE)}
            className="min-h-12 rounded-[8px] border border-imesul-red bg-imesul-red font-condensed text-sm font-bold uppercase tracking-[0.12em] text-white transition-all hover:-translate-y-0.5 hover:bg-[#ef3434]"
          >
            Campo Grande e demais regiões
          </button>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="min-h-12 rounded-[8px] border border-slate-300 font-condensed text-sm font-bold uppercase tracking-[0.12em] text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-wait disabled:opacity-60"
          >
            {locating ? "Localizando..." : "Usar minha localização"}
          </button>
        </div>
      </div>
    </div>
  );
}
