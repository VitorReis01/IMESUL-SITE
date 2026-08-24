"use client";

// Banner de consentimento (LGPD): decisão binária, sincronizada entre os sites da IMESUL.
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  getServerConsentRaw,
  getStoredConsentRaw,
  hasPendingConsentSync,
  importConsentFromUrl,
  parseStoredConsent,
  saveConsent,
  setConsentBannerOpen,
  subscribeToConsent,
  subscribeToOpenPrivacyPreferences,
} from "../lib/consent";

export default function CookieConsentBanner() {
  const storedRaw = useSyncExternalStore(subscribeToConsent, getStoredConsentRaw, getServerConsentRaw);
  const [forceOpen, setForceOpen] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [importedRaw, setImportedRaw] = useState("");

  const consent = parseStoredConsent(importedRaw || storedRaw);

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

  // Publica a mesma decisao de visibilidade que este componente ja calcula, para o WhatsApp
  // flutuante saber se deve ceder espaco - ver lib/consent.js.
  useEffect(() => {
    setConsentBannerOpen(!syncing && isVisible);
  }, [syncing, isVisible]);

  if (syncing || !isVisible) return null;

  const close = () => setForceOpen(false);

  const handleAccept = () => {
    const saved = saveConsent({ analytics: true, location: true });

    if (saved) {
      setImportedRaw(JSON.stringify(saved));
    }

    close();
  };

  const handleReject = () => {
    const saved = saveConsent({ analytics: false, location: false });

    if (saved) {
      setImportedRaw(JSON.stringify(saved));
    }

    close();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[190] px-4 pb-4 sm:px-6 sm:pb-6">
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Consentimento de cookies"
        className="pointer-events-auto relative mx-auto max-w-[860px] overflow-hidden rounded-[10px] border border-slate-200 bg-white p-5 shadow-[0_-16px_60px_rgba(15,23,42,0.18)] backdrop-blur-md transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:p-6"
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-imesul-red/50 to-transparent" />

        <p className="font-condensed text-sm font-bold uppercase tracking-[0.08em] text-slate-900 sm:text-base">
          Usamos cookies para melhorar sua experiência
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600 sm:text-sm">
          A IMESUL utiliza recursos necessários para o funcionamento do site. Com sua autorização,
          também podemos usar analytics e, quando você solicitar, localização do dispositivo.
        </p>

        <div className="mt-4 flex flex-col-reverse gap-2.5 sm:mt-5 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/politica-de-privacidade"
            className="font-condensed text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500 underline decoration-transparent underline-offset-4 transition-colors hover:text-slate-900 hover:decoration-slate-400"
          >
            Política de Privacidade
          </Link>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={handleReject}
              className="min-h-11 rounded-[7px] border border-slate-300 px-5 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              Rejeitar
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="min-h-11 rounded-[7px] border border-imesul-red bg-imesul-red px-5 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-white transition-all hover:-translate-y-0.5 hover:bg-[#ef3434]"
            >
              Aceitar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
