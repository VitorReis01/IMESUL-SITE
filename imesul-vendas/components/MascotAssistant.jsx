"use client";

// Assistente visual flutuante do orçamento guiado (páginas internas de produto -
// components/QuoteBuilder.jsx#MaterialQuoteFlow). Balão + boneco + botão de WhatsApp, sempre
// direcionado ao vendedor ativo de Campo Grande (Fabrício) - reaproveita o mesmo fluxo de lead
// já usado pelos outros CTAs de "falar com vendedor" (nunca duplicar popup/lead/fallback aqui).
//
// position: fixed real, ancorado na viewport (canto inferior direito) - mesmo canto do botão
// flutuante global do WhatsApp (components/CartWidget.jsx), mas sem conflito: esse botão já se
// esconde sozinho (hideWhatsAppFloat, lib/guidedQuoteFlow.js) enquanto o formulário de orçamento
// guiado está na tela, que é exatamente onde este mascote aparece. Renderizado via createPortal direto em
// document.body: um position:fixed só fica "preso" a qualquer ancestral que tenha transform,
// filter, perspective, will-change ou container-type (cria um novo containing block) - o portal
// elimina esse risco por completo, sem precisar auditar toda a árvore de componentes entre este
// widget e a raiz. Renderizado condicionalmente pelo próprio MaterialQuoteFlow (só existe
// enquanto essa página estiver montada) - nunca em nenhuma outra página do site.
//
// Tamanhos via style inline (não classes arbitrárias w-[...]) de propósito: o DEV SERVER deste
// projeto usa Turbopack, que não estava compilando as classes width arbitrárias adicionadas aqui
// (confirmado inspecionando o stylesheet carregado no navegador - a regra simplesmente não
// existia, mesmo após limpar cache/.next e testar em aba nova). O build de produção real
// (`next build --webpack`) compila essas mesmas classes corretamente - é um bug/limite só do
// Turbopack em dev, não do Tailwind/config. style inline evita depender de qualquer scanner de
// conteúdo e funciona igual nos dois ambientes.
import Image from "next/image";
import { useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { openWhatsAppWithLead } from "../lib/leadWhatsApp";
import { COMMERCIAL_UNITS, LEAD_FLOW_TYPES } from "../lib/leadFlow";
import { trackLocalEvent } from "../lib/localAnalytics";

const MASCOT_MESSAGE = "Olá! Gostaria de fazer um orçamento.";

// Dimensões reais dos PNGs (public/mascote/) - passadas ao next/image para evitar layout shift.
const BALLOON_SIZE = { width: 577, height: 433 };
const MASCOT_SIZE = { width: 433, height: 577 };
const BUTTON_SIZE = { width: 866, height: 288 };

// Conjunto maior que a versão anterior, por pedido explícito - desktop ~150-180px de largura
// (o botão, elemento mais largo, define esse footprint), mobile ~110-130px.
const SIZES = {
  desktop: { balloon: 140, mascot: 115, button: 165, balloonOverlap: -40, balloonShiftX: -14 },
  mobile: { balloon: 100, mascot: 82, button: 118, balloonOverlap: -26, balloonShiftX: -10 },
};

// Mesmo padrão já usado em lib/consent.js/lib/analyticsUnit.js (useSyncExternalStore) em vez de
// useState+useEffect - evita "setState direto dentro de effect" e resolve hidratação SSR-safe
// de graça (getServerSnapshot fixo, sem risco de mismatch nem de render em cascata).
const subscribeToDesktopMedia = (callback) => {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(min-width: 1024px)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
};
const getIsDesktopSnapshot = () =>
  typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
const getServerIsDesktopSnapshot = () => false;

function useIsDesktop() {
  return useSyncExternalStore(subscribeToDesktopMedia, getIsDesktopSnapshot, getServerIsDesktopSnapshot);
}

// "Montado" so para saber quando e' seguro chamar document.body (portal) - servidor nunca tem
// document, cliente sempre tem depois da hidratacao. Nada para assinar de verdade (so muda uma
// vez, no primeiro paint do cliente), mas useSyncExternalStore ja cuida de re-renderizar apos a
// hidratacao mesmo com um subscribe vazio.
const noopSubscribe = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

function useMounted() {
  return useSyncExternalStore(noopSubscribe, getMountedSnapshot, getServerMountedSnapshot);
}

function MascotWhatsAppButton({ pagePath, buttonWidth }) {
  const submittingRef = useRef(false);

  const handleClick = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    trackLocalEvent({
      type: "whatsapp",
      label: "Fale conosco",
      section: "Assistente do orçamento guiado",
      isLoggedIn: false,
    });

    openWhatsAppWithLead({
      message: MASCOT_MESSAGE,
      flowType: LEAD_FLOW_TYPES.DIRECT_CONTACT,
      unit: COMMERCIAL_UNITS.CAMPO_GRANDE,
      origin: "Assistente mascote",
      pagePath,
    }).finally(() => {
      submittingRef.current = false;
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Fale conosco no WhatsApp"
      style={{ width: buttonWidth }}
      // Nudge no botao inteiro (imagem + texto juntos, como uma unica peca) - nunca so a imagem
      // de fundo, senao o texto fica parado enquanto o botao "escorrega" por baixo dele.
      className="mascot-cta-nudge group relative block shrink-0 rounded-full pointer-events-auto transition-transform duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-400/40"
    >
      {/* <img> normal, não next/image: o otimizador embutido serviu uma versão obsoleta/sem-texto
          deste asset depois de trocar o arquivo no mesmo caminho (cache em .next/cache/images),
          reproduzido 2x mesmo limpando cache e reiniciando o servidor - <img> sempre busca os
          bytes reais do arquivo, sem cache de transformação. */}
      <img
        src="/mascote/botao-do-faleconosco-boneco-mirim-flutuante.png"
        alt=""
        width={BUTTON_SIZE.width}
        height={BUTTON_SIZE.height}
        className="h-auto w-full drop-shadow-lg"
      />
    </button>
  );
}

function MascotWidget({ pagePath, sizes }) {
  return (
    <div
      // z-index acima do botao global do WhatsApp (CartWidget.jsx, z-[140]) de proposito: os
      // dois ficam a poucos pixels de distancia no mesmo canto, e hideWhatsAppFloat (lib/
      // guidedQuoteFlow.js) so liga depois do primeiro efeito client-side (SSR sempre renderiza
      // esse botao visivel) - nessa janela breve, o mascote precisa ficar por cima, nunca atras.
      style={{ position: "fixed", right: 16, left: "auto", bottom: 16, zIndex: 150 }}
      className="pointer-events-none flex flex-col items-center"
    >
      <Image
        src="/mascote/fala-comigo.png"
        alt=""
        width={BALLOON_SIZE.width}
        height={BALLOON_SIZE.height}
        style={{ width: sizes.balloon, transform: `translateX(${sizes.balloonShiftX}px)` }}
        className="pointer-events-none h-auto"
      />
      <Image
        src="/mascote/mirim-flutuante.png"
        alt="Atendente IMESUL"
        width={MASCOT_SIZE.width}
        height={MASCOT_SIZE.height}
        style={{ width: sizes.mascot, marginTop: sizes.balloonOverlap }}
        className="pointer-events-none h-auto"
      />
      <div style={{ marginTop: -10 }}>
        <MascotWhatsAppButton pagePath={pagePath} buttonWidth={sizes.button} />
      </div>
    </div>
  );
}

export default function MascotAssistant({ pagePath = "material-quote-flow" }) {
  const mounted = useMounted();
  const isDesktop = useIsDesktop();

  // So monta o portal depois do mount no client - document.body nao existe durante SSR, e
  // montar antes da hidratacao completa arriscaria mismatch.
  if (!mounted) return null;

  return createPortal(
    <MascotWidget pagePath={pagePath} sizes={isDesktop ? SIZES.desktop : SIZES.mobile} />,
    document.body
  );
}


