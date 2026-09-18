"use client";

// Restaura a URL publica antiga /dourados (cartoes, QR Codes e campanhas ja impressos - ver
// auditoria desta fase). So define a unidade CONFIRMADA (mesmo mecanismo que qualquer CTA
// comercial ja consulta via lib/commercialContact.js#requestCommercialContact) e devolve o
// visitante para a home - nunca duplica logica de WhatsApp/alternador Centro/Fabrica, que
// continua exclusivamente em lib/leadWhatsApp.js e lib/douradosDispatch.js.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { COMMERCIAL_UNITS } from "../../lib/leadFlow";
import { setStoredUnit } from "../../lib/unitPreference";

export default function DouradosLegacyEntryPage() {
  const router = useRouter();

  useEffect(() => {
    setStoredUnit(COMMERCIAL_UNITS.DOURADOS);
    router.replace("/");
  }, [router]);

  return null;
}
