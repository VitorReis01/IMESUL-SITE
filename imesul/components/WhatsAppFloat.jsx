"use client";

// CTA genérico "falar com um vendedor" (DIRECT_CONTACT) - resolve unidade, cria o lead e abre o
// WhatsApp do vendedor sorteado pelo rodízio (ver lib/commercialContact.js). Botão em vez de link
// direto: precisa rodar lógica antes de abrir o WhatsApp, sem quebrar o fallback já existente.
import Image from "next/image";
import { useSyncExternalStore } from "react";
import { openCommercialWhatsApp } from "../lib/commercialContact";
import {
  getConsentBannerOpen,
  getServerConsentBannerOpen,
  subscribeToConsentBannerOpen,
} from "../lib/consent";

// Mantem o contato comercial acessivel e aplica profundidade ao botao, nao ao icone. A logo
// vermelha (estado normal) faz cross-fade para a verde no hover - as duas artes ja sao o rosto
// inteiro do botao (nao precisam de um circulo de fundo por baixo).
export default function WhatsAppFloat() {
  const bannerOpen = useSyncExternalStore(subscribeToConsentBannerOpen, getConsentBannerOpen, getServerConsentBannerOpen);

  return (
    <button
      type="button"
      onClick={() => openCommercialWhatsApp({ pagePath: "whatsapp-flutuante" })}
      aria-label="Falar com a IMESUL no WhatsApp"
      className={`group fixed bottom-5 right-5 z-[140] ${bannerOpen ? "hidden xl:flex" : "flex"} h-14 w-14 items-center justify-center rounded-full shadow-[0_14px_34px_rgba(0,0,0,0.4)] transition-transform duration-300 ease-out hover:-translate-y-1 hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-imesul-red sm:bottom-7 sm:right-7 sm:h-16 sm:w-16`}
    >
      <span className="relative h-11 w-11 sm:h-[52px] sm:w-[52px]">
        <Image
          src="/logo/whatsapp-vermelho.webp"
          alt=""
          fill
          sizes="52px"
          className="object-contain opacity-100 transition-opacity duration-300 ease-out group-hover:opacity-0"
        />
        <Image
          src="/logo/whatsapp-verde.webp"
          alt=""
          fill
          sizes="52px"
          className="absolute inset-0 object-contain opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
        />
      </span>
    </button>
  );
}
