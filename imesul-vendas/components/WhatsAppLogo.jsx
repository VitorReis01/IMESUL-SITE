"use client";

import Image from "next/image";

// Marca do WhatsApp usada nos CTAs de contato (botao flutuante + "Falar com vendedor").
// variant="fade": vermelha por padrao, cross-fade para a verde no hover do ancestral com
// className "group" - variant="green": so a verde, estatica (usado onde nao ha estado de hover
// real, ex.: menu mobile ja permanentemente verde). className controla o tamanho (h-*/w-*),
// inclusive responsivo, ja que o componente so posiciona/dimensiona via Tailwind.
export default function WhatsAppLogo({ variant = "fade", className = "h-6 w-6" }) {
  if (variant === "green") {
    return (
      <span className={`relative inline-block shrink-0 ${className}`}>
        <Image src="/logo/whatsapp-verde.webp" alt="" fill sizes="48px" className="object-contain" />
      </span>
    );
  }

  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      <Image
        src="/logo/whatsapp-vermelho.webp"
        alt=""
        fill
        sizes="48px"
        className="object-contain opacity-100 transition-opacity duration-300 ease-out group-hover:opacity-0"
      />
      <Image
        src="/logo/whatsapp-verde.webp"
        alt=""
        fill
        sizes="48px"
        className="absolute inset-0 object-contain opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
      />
    </span>
  );
}
