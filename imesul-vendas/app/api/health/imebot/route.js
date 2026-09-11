import { isImebotEnabled } from "../../../../Backend.js/imebotFeatureGate";
import { isMonitoringRequestAuthorized } from "../../../../Backend.js/monitoringAuth";
import { noStoreJson } from "../../../../Backend.js/requestGuards";

// Antes desta rodada, esta rota era 100% pública e sempre revelava se o IMEbot está
// enabled/disabled - baixa sensibilidade, mas era o único health check deste projeto que expunha
// estado de configuração interna sem nenhuma autenticação (o irmão /api/health/database já exige
// x-monitoring-key - ver Backend.js/monitoringAuth.js). Nenhuma dependência encontrada no
// repositório (nem no painel admin, que lê isImebotEnabled() direto, nem em nenhum fetch interno)
// nem no Better Stack configurado neste projeto (RELIABILITY.md documenta Better Stack só como
// destino de LOG via logger.security/logger.circuitBreaker, nunca como poller HTTP desta rota) -
// por isso a resposta pública passa a ser genérica. Quem já tem o mesmo segredo de
// /api/health/database (x-monitoring-key) continua vendo o detalhe real.
export function GET(request) {
  if (!isMonitoringRequestAuthorized(request)) {
    return noStoreJson({ status: "ok" });
  }

  if (!isImebotEnabled()) {
    return noStoreJson({ status: "disabled", imebot: "disabled" });
  }

  return noStoreJson({ status: "ok", imebot: "enabled" });
}
