"use client";

// Central de links por unidade, inspirada na logica de selecao de um "avatar picker" (avatar
// grande no centro, opcoes menores abaixo, conteudo trocando com animacao leve) mas escrita do
// zero para a IMESUL: sem shadcn, sem /components/ui, sem TypeScript. O "avatar" e o simbolo oficial
// da IMESUL (nao uma foto/pessoa). Todos os dados (endereco, telefone, maps, instagram, facebook,
// whatsapp) vem de data/products.js — nada aqui e inventado; se um canal nao existir para a
// unidade, o botao correspondente simplesmente nao aparece.
import { useState } from "react";
import Image from "next/image";
import { m as motion, useReducedMotion } from "framer-motion";
import { officialUnits, officialSocialLinks, whatsapp } from "../data/products";

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

function IconLink({ href, label, icon, accent }) {
  const isExternal = href.startsWith("http");
  return (
    <a
      href={href}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      aria-label={label}
      title={label}
      className={`flex h-12 w-12 flex-none items-center justify-center rounded-full border transition-all duration-300 hover:-translate-y-0.5 sm:h-14 sm:w-14 ${
        accent === "whatsapp"
          ? "border-[#25D366]/40 bg-[#25D366]/10 text-[#25D366] hover:border-[#25D366]/70 hover:bg-[#25D366]/15"
          : "border-white/15 bg-white/[0.04] text-imesul-steel-light/85 hover:border-imesul-red/50 hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      {icon}
    </a>
  );
}

export default function OfficialLinksPicker() {
  const shouldReduceMotion = useReducedMotion();
  const noMotion = shouldReduceMotion === true;
  const [activeIndex, setActiveIndex] = useState(0);
  const unit = UNITS[activeIndex];

  const channels = [
    { key: "maps", href: unit.mapsHref, label: "Ver no Google Maps", icon: <MapsIcon /> },
    { key: "phone", href: unit.phoneHref, label: `Ligar para ${unit.phone}`, icon: <PhoneIcon /> },
    unit.whatsappHref && { key: "whatsapp", href: unit.whatsappHref, label: "Falar no WhatsApp", icon: <WhatsAppIcon />, accent: "whatsapp" },
    unit.instagram && { key: "instagram", href: unit.instagram, label: "Instagram", icon: <InstagramIcon /> },
    unit.facebook && { key: "facebook", href: unit.facebook, label: "Facebook", icon: <FacebookIcon /> },
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl rounded-[28px] border border-white/10 bg-[#0b1524]/85 px-6 py-10 shadow-[0_30px_90px_rgba(0,0,0,0.35)] sm:px-12 sm:py-14">
      <div className="flex flex-col items-center text-center">
        {/* Avatar principal: simbolo oficial da IMESUL, nunca uma foto/pessoa. Remonta (via key) a
            cada troca de unidade, o que ja dispara initial->animate sem precisar de AnimatePresence. */}
        <motion.div
          key={unit.id}
          initial={noMotion ? false : { scale: 0.86, rotate: -6, opacity: 0.55 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ duration: noMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-imesul-red/45 bg-white p-4 shadow-[0_18px_46px_rgba(212,43,43,0.16)] sm:h-32 sm:w-32 sm:p-5"
        >
          <Image
            src="/logo/imesul-symbol.png"
            alt="Símbolo IMESUL"
            width={200}
            height={160}
            className="h-full w-full object-contain"
            priority
          />
        </motion.div>

        {/* Seletor de unidades. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {UNITS.map((u, index) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setActiveIndex(index)}
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

        {/* Conteudo da unidade selecionada — mesmo padrao de remontar por key, sem AnimatePresence. */}
        <motion.div
          key={unit.id}
          initial={noMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: noMotion ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 w-full max-w-xl"
        >
          <h2 className="font-display text-3xl uppercase leading-tight text-white sm:text-4xl">
            {unit.name}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-imesul-steel-light/80 sm:text-base">
            {unit.address}
          </p>
          <p className="mt-1 font-mono text-sm text-imesul-steel-light/70">Telefone: {unit.phone}</p>

          <motion.div
            variants={noMotion ? undefined : { visible: { transition: { staggerChildren: 0.08 } } }}
            initial={noMotion ? undefined : "hidden"}
            animate={noMotion ? undefined : "visible"}
            className="mt-7 flex flex-wrap items-center justify-center gap-3"
          >
            {channels.map((channel) => (
              <motion.div
                key={channel.key}
                variants={noMotion ? undefined : { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
              >
                <IconLink href={channel.href} label={channel.label} icon={channel.icon} accent={channel.accent} />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
