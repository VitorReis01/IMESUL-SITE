"use client";

// Banner de consentimento (LGPD), simplificado para uma decisao binaria: ACEITAR ou REJEITAR.
// Sem painel de configuracao granular por categoria (decisao explicita desta fase - ver
// relatorio). ACEITAR liga analytics + localizacao do dispositivo juntos; REJEITAR desliga os
// dois. A decisao salva vem via useSyncExternalStore (servidor sempre ve "" / sem decisao),
// entao nao ha acesso a localStorage durante a renderizacao nem mismatch de hidratacao.
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import {
  getServerConsentRaw,
  getStoredConsentRaw,
  hasPendingConsentSync,
  importConsentFromUrl,
  parseStoredConsent,
  requestDeviceLocationOnce,
  saveConsent,
  subscribeToConsent,
  subscribeToOpenPrivacyPreferences,
} from "../lib/consent";
import { trackLocalEvent } from "../lib/localAnalytics";
import { useEffect } from "react";

// No maximo um evento por decisao de localizacao. Roda depois de saveConsent ja ter gravado o
// toggle, entao trackLocalEvent (que confere o consentimento salvo) libera o envio corretamente.
const captureDeviceLocationOnce = async () => {
  const result = await requestDeviceLocationOnce();
  trackLocalEvent({
    type: "device_location",
    label: "Localização do dispositivo",
    section: "Consentimento de privacidade",
    detail: result.status,
    deviceLocationStatus: result.status,
    deviceLocation: result.deviceLocation,
  });
};

export default function CookieConsentBanner() {
  // Servidor e primeira renderizacao do client sempre veem "" (sem decisao) - useSyncExternalStore
  // corrige para o valor real do localStorage logo apos hidratar, sem mismatch e sem flash visivel
  // do banner para quem ja decidiu (ao contrario de reler em useEffect + setState).
  const storedRaw = useSyncExternalStore(subscribeToConsent, getStoredConsentRaw, getServerConsentRaw);
  const [forceOpen, setForceOpen] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [importedRaw, setImportedRaw] = useState("");

  const consent = parseStoredConsent(importedRaw || storedRaw);

  // "Preferências de privacidade" no rodape reabre o MESMO banner binario, para revogar/alterar
  // a decisao - nunca um painel granular separado (ver relatorio desta fase).
  useEffect(() => subscribeToOpenPrivacyPreferences(() => setForceOpen(true)), []);
  useEffect(() => {
    let active = true;

    const syncConsent = async () => {
      let raw = getStoredConsentRaw();

      if (hasPendingConsentSync()) {
        const imported = await importConsentFromUrl();

        if (imported) {
          raw = JSON.stringify(imported);
        }
      }

      if (active) {
        setImportedRaw(raw);
        setSyncing(false);
      }
    };

    syncConsent();

    return () => {
      active = false;
    };
  }, []);

  const isVisible = forceOpen || !consent;
  if (syncing || !isVisible) return null;

  const close = () => setForceOpen(false);

  const handleAccept = async () => {
  const saved = saveConsent({ analytics: true, location: true });

  if (saved) {
    setImportedRaw(JSON.stringify(saved));
  }

  close();
  await captureDeviceLocationOnce();
};

  const handleReject = () => {
    const saved = saveConsent({ analytics: false, location: false });

    if (saved) {
      setImportedRaw(JSON.stringify(saved));
    }

    close();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[150] px-4 pb-4 sm:px-6 sm:pb-6">
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Consentimento de cookies"
        className="relative mx-auto max-w-[860px] overflow-hidden rounded-[10px] border border-white/[0.12] bg-[#071321]/97 p-5 shadow-[0_-16px_60px_rgba(0,0,0,0.4)] backdrop-blur-md transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:p-6"
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-imesul-red/50 to-transparent" />

        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-imesul-red/45 bg-imesul-red/15 text-imesul-red">
            <ShieldCheck size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-condensed text-sm font-bold uppercase tracking-[0.08em] text-white sm:text-base">
              Usamos cookies para melhorar sua experiência
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-imesul-steel-light/72 sm:text-sm">
              A IMESUL utiliza recursos necessários para o funcionamento do site. Com sua
              autorização, também podemos usar analytics e localização do dispositivo para
              melhorar o atendimento.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2.5 sm:mt-5 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/politica-de-privacidade"
            className="font-condensed text-[12px] font-semibold uppercase tracking-[0.1em] text-imesul-steel-light/70 underline decoration-transparent underline-offset-4 transition-colors hover:text-white hover:decoration-white/40"
          >
            Política de Privacidade
          </Link>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={handleReject}
              className="min-h-11 rounded-[7px] border border-white/[0.16] px-5 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-imesul-steel-light/85 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-[#071321]"
            >
              Rejeitar
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="min-h-11 rounded-[7px] border border-imesul-red bg-imesul-red px-5 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-white transition-all hover:-translate-y-0.5 hover:bg-[#ef3434] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-[#071321]"
            >
              Aceitar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
