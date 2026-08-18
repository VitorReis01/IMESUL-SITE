"use client";

// Banner de consentimento (LGPD): cookies necessarios, analytics e localizacao do dispositivo.
// A decisao salva vem via useSyncExternalStore (servidor sempre ve "" / sem decisao), entao nao
// ha acesso a localStorage durante a renderizacao nem mismatch de hidratacao.
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import {
  getServerConsentRaw,
  getStoredConsentRaw,
  parseStoredConsent,
  requestDeviceLocationOnce,
  saveConsent,
  subscribeToConsent,
  subscribeToOpenPrivacyPreferences,
} from "../lib/consent";
import { trackLocalEvent } from "../lib/localAnalytics";

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

function ToggleRow({ label, description, checked, locked = false, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="font-condensed text-sm font-bold uppercase tracking-[0.06em] text-white">
          {label}
          {locked && (
            <span className="ml-2 font-mono text-[10px] font-normal normal-case tracking-normal text-imesul-steel-light/55">
              sempre ativo
            </span>
          )}
        </p>
        <p className="mt-1 text-[13px] leading-5 text-imesul-steel-light/68">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={locked}
        onClick={() => !locked && onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-[#071321] ${
          locked
            ? "cursor-not-allowed border-white/[0.14] bg-white/[0.14]"
            : checked
              ? "cursor-pointer border-imesul-red bg-imesul-red"
              : "cursor-pointer border-white/[0.18] bg-white/[0.06]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-200 ${
            checked || locked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export default function CookieConsentBanner() {
  // Servidor e primeira renderizacao do client sempre veem "" (sem decisao) - useSyncExternalStore
  // corrige para o valor real do localStorage logo apos hidratar, sem mismatch e sem flash visivel
  // do banner para quem ja decidiu (ao contrario de reler em useEffect + setState).
  const storedRaw = useSyncExternalStore(subscribeToConsent, getStoredConsentRaw, getServerConsentRaw);
  const consent = parseStoredConsent(storedRaw);

  const [forceOpen, setForceOpen] = useState(false);
  const [view, setView] = useState("banner");
  const [analyticsChoice, setAnalyticsChoice] = useState(false);
  const [locationChoice, setLocationChoice] = useState(false);

  useEffect(
    () =>
      subscribeToOpenPrivacyPreferences(() => {
        setAnalyticsChoice(Boolean(consent?.analytics));
        setLocationChoice(Boolean(consent?.location));
        setView("preferences");
        setForceOpen(true);
      }),
    [consent]
  );

  const isVisible = forceOpen || !consent;
  if (!isVisible) return null;

  const close = () => {
    setForceOpen(false);
    setView("banner");
  };

  const handleAcceptAll = async () => {
    saveConsent({ analytics: true, location: true });
    close();
    await captureDeviceLocationOnce();
  };

  const handleNecessaryOnly = () => {
    saveConsent({ analytics: false, location: false });
    close();
  };

  const handleOpenConfigure = () => {
    setAnalyticsChoice(Boolean(consent?.analytics));
    setLocationChoice(Boolean(consent?.location));
    setView("preferences");
  };

  const handleSavePreferences = async () => {
    const wasLocationEnabled = Boolean(consent?.location);
    saveConsent({ analytics: analyticsChoice, location: locationChoice });
    close();
    if (locationChoice && !wasLocationEnabled) {
      await captureDeviceLocationOnce();
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[150] px-4 pb-4 sm:px-6 sm:pb-6">
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Preferências de privacidade"
        className="relative mx-auto max-w-[860px] overflow-hidden rounded-[10px] border border-white/[0.12] bg-[#071321]/97 p-5 shadow-[0_-16px_60px_rgba(0,0,0,0.4)] backdrop-blur-md transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:p-6"
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-imesul-red/50 to-transparent" />

        {view === "banner" ? (
          <>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-imesul-red/45 bg-imesul-red/15 text-imesul-red">
                <ShieldCheck size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-condensed text-sm font-bold uppercase tracking-[0.08em] text-white sm:text-base">
                  Usamos cookies e dados opcionais para melhorar sua experiência
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
                  onClick={handleNecessaryOnly}
                  className="min-h-11 rounded-[7px] border border-white/[0.16] px-4 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-imesul-steel-light/85 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-[#071321]"
                >
                  Somente necessários
                </button>
                <button
                  type="button"
                  onClick={handleOpenConfigure}
                  className="min-h-11 rounded-[7px] border border-white/[0.16] px-4 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-imesul-steel-light/85 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-[#071321]"
                >
                  Configurar
                </button>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="min-h-11 rounded-[7px] border border-imesul-red bg-imesul-red px-5 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-white transition-all hover:-translate-y-0.5 hover:bg-[#ef3434] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-[#071321]"
                >
                  Aceitar todos
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-imesul-red/45 bg-imesul-red/15 text-imesul-red">
                <ShieldCheck size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-condensed text-sm font-bold uppercase tracking-[0.08em] text-white sm:text-base">
                  Preferências de privacidade
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-imesul-steel-light/68">
                  Escolha o que a IMESUL pode usar além do essencial para o site funcionar.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <ToggleRow
                label="Cookies necessários"
                description="Necessários para o site funcionar (navegação, orçamento, login). Não podem ser desativados."
                checked
                locked
                onChange={() => {}}
              />
              <ToggleRow
                label="Analytics"
                description="Ajuda a IMESUL a entender como o site é usado, para melhorar o atendimento."
                checked={analyticsChoice}
                onChange={setAnalyticsChoice}
              />
              <ToggleRow
                label="Localização do dispositivo"
                description="Usada apenas se você autorizar, para estatísticas internas de atendimento."
                checked={locationChoice}
                onChange={setLocationChoice}
              />
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2.5 sm:mt-5 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/politica-de-privacidade"
                className="font-condensed text-[12px] font-semibold uppercase tracking-[0.1em] text-imesul-steel-light/70 underline decoration-transparent underline-offset-4 transition-colors hover:text-white hover:decoration-white/40"
              >
                Política de Privacidade
              </Link>

              <button
                type="button"
                onClick={handleSavePreferences}
                className="min-h-11 rounded-[7px] border border-imesul-red bg-imesul-red px-5 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-white transition-all hover:-translate-y-0.5 hover:bg-[#ef3434] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-[#071321]"
              >
                Salvar preferências
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
