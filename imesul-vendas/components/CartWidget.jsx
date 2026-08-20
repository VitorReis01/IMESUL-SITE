"use client";

// Carrinho GLOBAL do site de vendas: icone flutuante com badge (visivel em qualquer pagina,
// nao so no catalogo) + painel lateral. Nao existe uma Navbar compartilhada entre a home e as
// paginas de material (cada uma tem seu proprio cabecalho simples) - um componente flutuante
// montado uma vez em app/layout.jsx e a forma mais segura de atender "carrinho acessivel fora do
// catalogo" sem redesenhar o cabecalho de cada pagina (fora do escopo desta fase).
import { useEffect, useState, useSyncExternalStore } from "react";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import {
  clearCartItems,
  getCartItemCount,
  getCartRawSnapshot,
  getServerCartSnapshot,
  parseCartRaw,
  removeCartItem,
  subscribeToCart,
  updateCartItemQuantity,
} from "../lib/cart";
import { openWhatsAppWithLead } from "../lib/leadWhatsApp";
import { LEAD_FLOW_TYPES } from "../lib/leadFlow";
import { trackLocalEvent } from "../lib/localAnalytics";
import { getCurrentCartTrackCode, scheduleCartTrackingSync } from "../lib/cartTracking";

const formatTechnicalLine = (item) =>
  [
    item.measure ? `Medida: ${item.measure}` : "",
    item.thickness ? `Espessura: ${item.thickness}` : "",
    item.length ? `Comprimento: ${item.length}` : "",
    item.details ? `Detalhes: ${item.details}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

const buildCartMessage = (items) => {
  const lines = items.map((item, index) => {
    const technical = formatTechnicalLine(item);
    return [
      `${index + 1}. ${item.productName}${item.categoryName ? ` (${item.categoryName})` : ""}`,
      technical ? `   ${technical}` : "",
      `   Quantidade: ${item.quantity}`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    "Olá, gostaria de solicitar um orçamento com os itens do meu carrinho:",
    "",
    lines.join("\n\n"),
    "",
    "Fico no aguardo da confirmação de medida, disponibilidade e valor.",
  ].join("\n");
};

export default function CartWidget() {
  const rawItems = useSyncExternalStore(subscribeToCart, getCartRawSnapshot, getServerCartSnapshot);
  const items = parseCartRaw(rawItems);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fecha o drawer com Escape - conveniencia de teclado, nao afeta o funcionamento sem JS extra.
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Rastreio de abandono é opcional e debounced (ver lib/cartTracking.js) - só envia algo quando
  // o visitante já consentiu com analytics; sem consentimento, esta chamada não faz nada.
  useEffect(() => {
    scheduleCartTrackingSync(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawItems]);

  const itemCount = getCartItemCount(items);

  const handleFinalize = () => {
    if (!items.length || submitting) return;
    setSubmitting(true);

    trackLocalEvent({
      type: "click",
      label: "Finalizar compra (carrinho)",
      section: "Carrinho",
      detail: `${items.length} item(ns)`,
    });

    const message = buildCartMessage(items);
    openWhatsAppWithLead({
      message,
      flowType: LEAD_FLOW_TYPES.CART,
      product: `Carrinho (${items.length} item(ns))`,
      pagePath: "cart-checkout",
      cartCode: getCurrentCartTrackCode(),
    }).finally(() => {
      setSubmitting(false);
      clearCartItems();
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Abrir carrinho${itemCount ? `, ${itemCount} item(ns)` : ""}`}
        className="fixed bottom-5 right-5 z-[140] flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.14] bg-imesul-red text-white shadow-[0_14px_38px_rgba(212,43,43,0.32)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#ef3434] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-imesul-red/30 sm:h-16 sm:w-16"
      >
        <ShoppingCart size={22} strokeWidth={2} aria-hidden="true" />
        {itemCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-[#06101d] bg-white px-1 font-condensed text-[11px] font-bold text-imesul-red">
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[160] flex justify-end">
          <button
            type="button"
            aria-label="Fechar carrinho"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Carrinho de orçamento"
            className="relative flex h-full w-full max-w-[420px] flex-col overflow-hidden border-l border-white/[0.1] bg-[#071321] shadow-[-20px_0_60px_rgba(0,0,0,0.4)]"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:px-6">
              <h2 className="font-display text-2xl text-white">Seu carrinho</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="flex h-9 w-9 items-center justify-center rounded-[6px] text-imesul-steel-light/70 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {items.length === 0 ? (
                <p className="mt-6 text-sm leading-6 text-imesul-steel-light/68">
                  Seu carrinho está vazio. Adicione produtos pelo catálogo para montar um orçamento.
                </p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {items.map((item) => (
                    <li key={item.key} className="rounded-[8px] border border-white/[0.08] bg-white/[0.03] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-condensed text-sm font-bold uppercase tracking-[0.06em] text-white">
                            {item.productName}
                          </p>
                          {item.categoryName && (
                            <p className="mt-0.5 text-[12px] text-imesul-steel-light/60">{item.categoryName}</p>
                          )}
                          {formatTechnicalLine(item) && (
                            <p className="mt-1.5 text-[12px] leading-5 text-imesul-steel-light/72">{formatTechnicalLine(item)}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.key)}
                          aria-label={`Remover ${item.productName} do carrinho`}
                          className="shrink-0 rounded-[6px] p-1.5 text-imesul-steel-light/55 transition-colors hover:bg-white/[0.06] hover:text-[#f0c776]"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateCartItemQuantity(item.key, Math.max(1, Number(item.quantity || 1) - 1))}
                          aria-label="Diminuir quantidade"
                          className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-white/[0.14] text-white transition-colors hover:border-imesul-red/50"
                        >
                          <Minus size={14} aria-hidden="true" />
                        </button>
                        <span className="min-w-8 text-center font-condensed text-sm font-bold text-white">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateCartItemQuantity(item.key, Number(item.quantity || 1) + 1)}
                          aria-label="Aumentar quantidade"
                          className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-white/[0.14] text-white transition-colors hover:border-imesul-red/50"
                        >
                          <Plus size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-white/[0.08] px-5 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => clearCartItems()}
                  className="mb-3 font-condensed text-[12px] font-semibold uppercase tracking-[0.1em] text-imesul-steel-light/60 underline decoration-transparent underline-offset-4 transition-colors hover:text-white hover:decoration-white/40"
                >
                  Limpar carrinho
                </button>
                <p className="mb-3 text-[12px] leading-5 text-imesul-steel-light/60">
                  Você será direcionado a um vendedor para concluir a compra.
                </p>
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={submitting}
                  className="flex min-h-12 w-full items-center justify-center rounded-[8px] bg-imesul-red font-condensed text-sm font-bold uppercase tracking-[0.1em] text-white transition-all hover:-translate-y-0.5 hover:bg-[#ef3434] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Finalizar compra
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
