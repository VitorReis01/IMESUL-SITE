"use client";

// Opt-in de localizacao do DISPOSITIVO (GPS/rede do navegador), sempre por acao explicita do
// visitante. Nunca confundir com a localizacao aproximada por IP (essa e automatica e vem do
// servidor). getCurrentPosition so roda dentro de handleRequestLocation, nunca em useEffect
// automatico, e uma unica vez por consentimento (sem watchPosition, sem polling).
import { useState, useSyncExternalStore } from "react";
import { LocateFixed, MapPinCheck, MapPinOff } from "lucide-react";
import { trackLocalEvent } from "../lib/localAnalytics";

const geolocationOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 };
const promptHandledKey = "imesul_demo_geo_prompt_handled";

const canUseBrowserStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

// Le a decisao salva sem setState em effect (evita cascata de render e mismatch de hidratacao):
// no servidor/primeira renderizacao o snapshot e sempre "", so muda depois que o client hidrata.
const subscribeToNothing = () => () => {};
const getStoredPromptStatus = () => {
  if (!canUseBrowserStorage()) return "";
  const stored = window.localStorage.getItem(promptHandledKey);
  return stored && stored in statusMessages ? stored : "";
};
const getServerPromptStatus = () => "";

const statusMessages = {
  requesting: "Obtendo localização...",
  granted: "Localização permitida. Obrigado por ajudar nas estatísticas da IMESUL.",
  denied: "Localização não autorizada. Você pode continuar seu orçamento normalmente.",
  unavailable: "Localização indisponível no momento.",
  timeout: "Tempo limite excedido ao obter localização.",
  unsupported: "Este navegador não suporta localização por GPS.",
};

const sendDeviceLocationEvent = ({ status, deviceLocation }) => {
  // Um unico evento por consentimento, correlacionado ao visitorId - evita duplicar
  // coordenadas precisas em centenas de eventos de navegacao.
  trackLocalEvent({
    type: "device_location",
    label: "Localização do dispositivo",
    section: "Consentimento de localização",
    detail: status,
    deviceLocationStatus: status,
    deviceLocation,
  });
};

export default function DeviceLocationOptIn() {
  const [interactiveStatus, setInteractiveStatus] = useState("");
  const storedStatus = useSyncExternalStore(subscribeToNothing, getStoredPromptStatus, getServerPromptStatus);
  // Uma decisao feita nesta sessao (clique) tem prioridade sobre o que ja estava salvo.
  const status = interactiveStatus || storedStatus || "idle";
  const setStatus = setInteractiveStatus;

  const handleRequestLocation = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      if (canUseBrowserStorage()) window.localStorage.setItem(promptHandledKey, "unsupported");
      sendDeviceLocationEvent({ status: "unsupported" });
      return;
    }

    setStatus("requesting");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const deviceLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        };
        setStatus("granted");
        if (canUseBrowserStorage()) window.localStorage.setItem(promptHandledKey, "granted");
        sendDeviceLocationEvent({ status: "granted", deviceLocation });
      },
      (error) => {
        const nextStatus = error.code === error.TIMEOUT ? "timeout" : error.code === error.PERMISSION_DENIED ? "denied" : "unavailable";
        setStatus(nextStatus);
        if (canUseBrowserStorage()) window.localStorage.setItem(promptHandledKey, nextStatus);
        sendDeviceLocationEvent({ status: nextStatus });
      },
      geolocationOptions
    );
  };

  if (status === "granted") {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-[7px] border border-[#25D366]/25 bg-[#25D366]/[0.07] px-3 py-2.5 text-xs leading-5 text-imesul-steel-light/78">
        <MapPinCheck size={15} className="shrink-0 text-[#25D366]" aria-hidden="true" />
        {statusMessages.granted}
      </p>
    );
  }

  if (status === "requesting") {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-[7px] border border-white/[0.1] bg-white/[0.03] px-3 py-2.5 text-xs leading-5 text-imesul-steel-light/68">
        <LocateFixed size={15} className="shrink-0 animate-pulse text-imesul-red" aria-hidden="true" />
        {statusMessages.requesting}
      </p>
    );
  }

  if (status !== "idle") {
    return (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-[7px] border border-white/[0.1] bg-white/[0.03] px-3 py-2.5 text-xs leading-5 text-imesul-steel-light/68">
        <span className="flex items-center gap-2">
          <MapPinOff size={15} className="shrink-0 text-imesul-steel-light/55" aria-hidden="true" />
          {statusMessages[status] || "Localização não solicitada."}
        </span>
        <button
          type="button"
          onClick={handleRequestLocation}
          className="shrink-0 font-condensed text-[11px] font-bold uppercase tracking-[0.08em] text-imesul-red underline decoration-imesul-red/40 underline-offset-4 hover:text-white"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[7px] border border-white/[0.1] bg-white/[0.03] px-3 py-3">
      <p className="text-xs leading-5 text-imesul-steel-light/68">
        Você pode permitir sua localização para melhorar o atendimento e as estatísticas internas da Imesul. Isso é opcional e não afeta seu orçamento.
      </p>
      <button
        type="button"
        onClick={handleRequestLocation}
        className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-white/[0.14] px-3.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-imesul-steel-light/82 transition-colors hover:border-imesul-red/55 hover:text-white"
      >
        <LocateFixed size={13} aria-hidden="true" /> Permitir localização
      </button>
    </div>
  );
}
