"use client";

// Restaura a URL publica antiga /douradosmatriz (cartoes, QR Codes e campanhas ja impressos - ver
// auditoria desta fase). Mapeia para a MESMA unidade COMMERCIAL_UNITS.DOURADOS que /dourados -
// nao existe (e nunca existiu na logica de negocio) um terceiro valor "dourados-matriz": o
// endereco antigo rotulado "Dourados - Matriz" foi oficialmente corrigido para "Dourados -
// Centro" (ver lib/leadFlow.js, comentario de 2026-08-20) - e a mesma unidade, so o nome mudou.
// So define a unidade CONFIRMADA (mesmo mecanismo que qualquer CTA comercial ja consulta via
// lib/commercialContact.js#requestCommercialContact) e devolve o visitante para a home - nunca
// duplica logica de WhatsApp/alternador Centro/Fabrica, que continua exclusivamente em
// lib/leadWhatsApp.js e lib/douradosDispatch.js.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { COMMERCIAL_UNITS } from "../../lib/leadFlow";
import { setStoredUnit } from "../../lib/unitPreference";

export default function DouradosMatrizLegacyEntryPage() {
  const router = useRouter();

  useEffect(() => {
    setStoredUnit(COMMERCIAL_UNITS.DOURADOS);
    router.replace("/");
  }, [router]);

  return null;
}
