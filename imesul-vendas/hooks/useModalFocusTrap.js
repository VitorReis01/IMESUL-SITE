"use client";

import { useEffect, useRef } from "react";

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Foco inicial no dialog, focus trap (Tab/Shift+Tab preso dentro do modal) e restauracao do foco
// no elemento que abriu o modal ao fechar - mesmo padrao para qualquer modal controlado por um
// estado "open" booleano. Nao decide abertura/fechamento nem Escape (cada modal trata isso do
// jeito que faz sentido pro proprio fluxo) - so cuida de onde o foco vai enquanto o dialog existe.
// containerRef deve apontar para o elemento com role="dialog" e tabIndex={-1}.
export function useModalFocusTrap(containerRef, open) {
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedRef.current = document.activeElement;
    const container = containerRef.current;
    const focusTimer = window.setTimeout(() => container?.focus(), 0);

    const handleTabTrap = (event) => {
      if (event.key !== "Tab" || !container) return;

      const focusable = Array.from(container.querySelectorAll(focusableSelector)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleTabTrap);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleTabTrap);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, containerRef]);
}
