"use client";

// Central de links por unidade, inspirada na logica de selecao de um "avatar picker" (avatar
// grande no centro, opcoes menores abaixo, conteudo trocando de forma simples) mas escrita do
// zero para a IMESUL: sem shadcn, sem /components/ui, sem TypeScript. O "avatar" e o simbolo oficial
// da IMESUL (nao uma foto/pessoa). Todos os dados (endereco, telefone, maps, instagram, facebook,
// whatsapp) vem de data/products.js — nada aqui e inventado; se um canal nao existir para a
// unidade, o botao correspondente simplesmente nao aparece.
//
// Importante sobre a troca de conteudo: existe APENAS UM bloco de conteudo no DOM (nao remonta via
// key, nao usa AnimatePresence, nao usa position:absolute). Trocar de unidade so troca o texto/links
// renderizados a partir de "unit"; a transicao visual e um fade/slide simples via classes CSS
// (opacity/translate-y), nunca dois blocos sobrepostos.
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { officialUnits, officialSocialLinks, whatsapp } from "../data/products";
import PremiumGlowButton from "./PremiumGlowButton";

// Rotulo curto so para o botao seletor; o nome completo continua vindo de officialUnits.
const SHORT_LABELS = {
  "dourados-matriz": "Matriz",
  "dourados-fabrica": "Loja de Fábrica",
  "campo-grande": "Campo Grande",
};

// O numero de WhatsApp cadastrado hoje no projeto e o mesmo telefone da unidade Campo Grande.
// Nao existe WhatsApp proprio para as unidades de Dourados no codigo atual, entao elas nao
// recebem esse botao — evita inventar um canal que a empresa nao confirmou.
const WHATSAPP_DIGITS = whatsapp.number.replace(/\D/g, "");
const WHATSAPP_HREF = `https://wa.me/${whatsapp.number}?text=${encodeURIComponent(whatsapp.message)}`;

const UNITS = officialUnits.map((unit) => {
  const social = unit.id.startsWith("dourados") ? officialSocialLinks.dourados : officialSocialLinks.campoGrande;
  const unitDigits = unit.phoneHref.replace(/\D/g, "");

  return {
    ...unit,
    shortLabel: SHORT_LABELS[unit.id] || unit.name,
    facebook: social?.facebook || null,
    instagram: social?.instagram || null,
    whatsappHref: unitDigits === WHATSAPP_DIGITS ? WHATSAPP_HREF : null,
  };
});

function MapsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 21s7-7.58 7-12a7 7 0 10-14 0c0 4.42 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.4" />
    </svg>
  );
}

function PhoneIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.6 21 3 12.4 3 2.9c0-.6.4-1 1-1H7.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8z" />
    </svg>
  );
}

function WhatsAppIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" {...props}>
      <path d="M20.5 11.6a8.5 8.5 0 0 1-12.55 7.47L3.5 20.5l1.45-4.28A8.5 8.5 0 1 1 20.5 11.6Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.25 7.75c.3-.3.78-.31 1.05-.03l1.06 1.1c.24.25.28.63.1.93l-.62 1.03c.7 1.45 1.84 2.57 3.3 3.24l.98-.62c.3-.19.7-.16.95.09l1.1 1.06c.3.28.28.77-.02 1.07l-.56.55c-.58.58-1.45.78-2.22.5-3.1-1.1-5.45-3.42-6.57-6.5-.28-.77-.1-1.63.49-2.22l.51-.5Z" fill="currentColor" />
    </svg>
  );
}

function InstagramIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17" cy="7" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M14.6 8.5h1.9V5.6h-1.9a3.7 3.7 0 00-3.7 3.7v1.7H9.1v3h1.8V20h3v-6h2l.4-3h-2.4V9.3c0-.44.36-.8.8-.8z" />
    </svg>
  );
}

// Fundo de cada botao de canal usando a cor real/reconhecivel da plataforma (nao tudo branco/
// vermelho). O glow do PremiumGlowButton usa uma variante proxima da mesma cor.
const CHANNEL_STYLE = {
  maps: { bg: "bg-[#EA4335]", glowVariant: "maps" },
  phone: { bg: "bg-imesul-red", glowVariant: "secondary" },
  whatsapp: { bg: "bg-[#25D366]", glowVariant: "whatsapp" },
  instagram: { bg: "bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#4F5BD5]", glowVariant: "instagram" },
  facebook: { bg: "bg-[#1877F2]", glowVariant: "facebook" },
};

function IconLink({ channelKey, href, label, icon }) {
  const isExternal = href.startsWith("http");
  const style = CHANNEL_STYLE[channelKey];

  return (
    <PremiumGlowButton
      href={href}
      variant={style.glowVariant}
      glowRadius={70}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      aria-label={label}
      title={label}
      className={`flex h-12 w-12 flex-none items-center justify-center rounded-full text-white shadow-[0_10px_26px_rgba(0,0,0,0.3)] transition-transform duration-300 hover:scale-105 sm:h-14 sm:w-14 ${style.bg}`}
    >
      {icon}
    </PremiumGlowButton>
  );
}

export default function OfficialLinksPicker() {
  const shouldReduceMotion = useReducedMotion();
  const noMotion = shouldReduceMotion === true;
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const targetIndexRef = useRef(0);
  const pendingTimeoutRef = useRef(null);

  // Limpa o timer pendente se o componente desmontar no meio de uma troca.
  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) window.clearTimeout(pendingTimeoutRef.current);
    };
  }, []);

  const unit = UNITS[activeIndex];

  // Troca a unidade sem nunca ter dois blocos de conteudo montados ao mesmo tempo: o texto so muda
  // depois que o bloco atual termina de ficar invisivel (ou instantaneamente, em reduced-motion).
  function selectUnit(index) {
    if (index === targetIndexRef.current) return;
    targetIndexRef.current = index;

    if (pendingTimeoutRef.current) {
      window.clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }

    if (noMotion) {
      setActiveIndex(index);
      return;
    }

    setVisible(false);
    pendingTimeoutRef.current = window.setTimeout(() => {
      setActiveIndex(index);
      setVisible(true);
      pendingTimeoutRef.current = null;
    }, 160);
  }

  const channels = [
    { key: "maps", href: unit.mapsHref, label: "Ver no Google Maps", icon: <MapsIcon /> },
    { key: "phone", href: unit.phoneHref, label: `Ligar para ${unit.phone}`, icon: <PhoneIcon /> },
    unit.whatsappHref && { key: "whatsapp", href: unit.whatsappHref, label: "Falar no WhatsApp", icon: <WhatsAppIcon /> },
    unit.instagram && { key: "instagram", href: unit.instagram, label: "Instagram", icon: <InstagramIcon /> },
    unit.facebook && { key: "facebook", href: unit.facebook, label: "Facebook", icon: <FacebookIcon /> },
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl rounded-[28px] border border-white/10 bg-[#0b1524]/85 px-6 py-10 shadow-[0_30px_90px_rgba(0,0,0,0.35)] sm:px-12 sm:py-14">
      <div className="flex flex-col items-center text-center">
        {/* Avatar principal: simbolo oficial da IMESUL, nunca uma foto/pessoa. Um unico elemento
            persistente — so um leve scale acompanha a troca de unidade, sem remontar. */}
        <div
          className={`flex h-28 w-28 items-center justify-center rounded-full border-2 border-imesul-red/45 bg-white p-4 shadow-[0_18px_46px_rgba(212,43,43,0.16)] transition-transform duration-300 ease-out sm:h-32 sm:w-32 sm:p-5 ${
            !noMotion && !visible ? "scale-90" : "scale-100"
          }`}
        >
          <Image
            src="/logo/imesul-symbol.png"
            alt="Símbolo IMESUL"
            width={200}
            height={160}
            className="h-full w-full object-contain"
            priority
          />
        </div>

        {/* Seletor de unidades. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {UNITS.map((u, index) => (
            <button
              key={u.id}
              type="button"
              onClick={() => selectUnit(index)}
              aria-pressed={index === activeIndex}
              className={`rounded-full border px-5 py-3 font-condensed text-xs font-bold uppercase tracking-[0.12em] transition-all duration-300 ${
                index === activeIndex
                  ? "border-imesul-red bg-imesul-red text-white shadow-[0_12px_30px_rgba(212,43,43,0.28)]"
                  : "border-white/15 bg-white/[0.03] text-imesul-steel-light/75 hover:border-white/30 hover:text-white"
              }`}
            >
              {u.shortLabel}
            </button>
          ))}
        </div>

        {/* Conteudo da unidade selecionada — UM UNICO bloco no DOM; a troca de texto acontece
            enquanto ele esta invisivel (opacity-0), entao nunca ha duas unidades visiveis juntas. */}
        <div
          className={`mt-8 w-full max-w-xl transition-all duration-300 ease-out ${
            !noMotion && !visible ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          <h2 className="font-display text-3xl uppercase leading-tight text-white sm:text-4xl">
            {unit.name}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-imesul-steel-light/80 sm:text-base">
            {unit.address}
          </p>
          <p className="mt-1 font-mono text-sm text-imesul-steel-light/70">Telefone: {unit.phone}</p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {channels.map((channel) => (
              <IconLink
                key={channel.key}
                channelKey={channel.key}
                href={channel.href}
                label={channel.label}
                icon={channel.icon}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
