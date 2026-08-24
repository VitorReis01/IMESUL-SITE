"use client";

// Painel administrativo do analytics.
// Consulta as APIs protegidas (paginacao/metricas server-side) e mostra eventos, visitantes e
// detalhes de seguranca.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Briefcase,
  Copy,
  Download,
  Filter,
  LogOut,
  MapPin,
  MessageCircle,
  MousePointerClick,
  Printer,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
  X,
  Activity,
} from "lucide-react";
import { clearLocalEvents, getAnalyticsEvents, subscribeToLocalEvents } from "../lib/localAnalytics";
import CommercialReportPanel from "./CommercialReportPanel";
import MonitoringPanel from "./MonitoringPanel";

const filters = [
  { label: "Todos", value: "all" },
  { label: "Visitas", value: "visit" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Busca", value: "search" },
  { label: "Cliques", value: "click" },
  { label: "Login", value: "login" },
  { label: "Com localização", value: "hasDeviceLocation" },
  { label: "Suspeitos", value: "suspicious" },
];

const periodFilters = [
  { label: "Hoje", value: "today" },
  { label: "7 dias", value: "7d" },
  { label: "30 dias", value: "30d" },
  { label: "Tudo", value: "all" },
];

const pageSizeOptions = [25, 50, 100];

// Dataset usado para os rankings/agrupamento por visitante (nao a tabela paginada de eventos).
// E um recorte recente e limitado, nao o historico inteiro - evita SELECT sem limite no
// Postgres e mantem o painel leve. Os cards de metricas (que precisam ser exatos) vem de uma
// consulta agregada separada (summary), independente deste recorte.
const rankingsPageSize = 500;

const emptyComparison = { current: 0, previous: 0, label: "Sem dados anteriores", trend: "none" };
const defaultSummary = {
  metrics: {
    uniqueVisitors: 0,
    totalAccesses: 0,
    repeatedAccesses: 0,
    suspiciousVisitors: 0,
    clicks: 0,
    whatsapp: 0,
    searches: 0,
    logins: 0,
    lastActivity: null,
  },
  comparisons: {
    uniqueVisitors: emptyComparison,
    clicks: emptyComparison,
    whatsapp: emptyComparison,
    searches: emptyComparison,
    logins: emptyComparison,
  },
};

const trackedClickTypes = new Set(["click", "whatsapp"]);

const formatDate = (timestamp) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));

const formatTime = (timestamp) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const reportObservation =
  "Os IPs sao exibidos de forma mascarada para preservar a privacidade. Para uso em producao, mantenha politica de privacidade e consentimento conforme LGPD.";

const formatDuration = (start, end) => {
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}min ${remainingSeconds}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
};

const getLocationLabel = (event) => {
  const location = event.location || {};
  return [location.city, location.region, location.country].filter((item) => item && item !== "Desconhecido").join(" / ") || "Desconhecido";
};

const getDeviceLabel = (event) => {
  const device = event.device || {};
  return [device.device, device.browser, device.os].filter((item) => item && item !== "Desconhecido").join(" / ") || "Desconhecido";
};

const getSecurityStatus = (event) => event.securityStatus || "Normal";

const getSecurityDetails = (event) => event.securityDetails || {};

// Eventos antigos nao tem location/network completos: sempre usar optional chaining + fallback.
const getNetworkLabel = (event) => event?.network?.organization || event?.network?.isp || "Não identificado";

// Coordenadas por IP sao aproximadas por natureza (infraestrutura de rede, nao o dispositivo).
// Mantidas so por compatibilidade com eventos antigos - NUNCA usadas no botao "Ver no mapa".
const getIpCoordinates = (event) => {
  const latitude = event?.location?.latitude || "";
  const longitude = event?.location?.longitude || "";
  return latitude && longitude ? { latitude, longitude } : null;
};

// Coordenadas do DISPOSITIVO: existem somente quando o proprio visitante autorizou o navegador.
// Sao as UNICAS coordenadas usadas no botao "Ver no mapa" (nunca misturar com localizacao por IP).
const getDeviceCoordinates = (event) => {
  const { latitude, longitude } = event?.deviceLocation || {};
  return typeof latitude === "number" && typeof longitude === "number" && Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
};

const getMapUrl = (coordinates) => `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}`;

// 6 casas decimais bastam para o painel; o valor original permanece integro no armazenamento.
const formatCoordinate = (value) => (typeof value === "number" ? value.toFixed(6) : value);

const deviceLocationStatusLabels = {
  granted: "Autorizada pelo visitante",
  denied: "Não autorizada pelo visitante",
  unavailable: "Localização indisponível",
  timeout: "Tempo limite excedido",
  unsupported: "Não suportada pelo navegador",
};

const getDeviceLocationStatusLabel = (event) =>
  deviceLocationStatusLabels[event?.deviceLocationStatus] || "Não solicitada / evento antigo";

const getClientIdentity = (event) => {
  const client = event.client || {};
  const hasClientData = Boolean(client.name || client.phone || client.email || event.isLoggedIn);

  return {
    name: hasClientData ? client.name || "Cliente com login" : "Visitante sem login",
    phone: hasClientData ? client.phone || "Telefone não informado" : "Telefone não informado",
    email: hasClientData ? client.email || "Não informado" : "Não informado",
    status: hasClientData ? client.status || "Cliente com login" : "Visitante sem login",
  };
};

const buildTrafficLabel = (event) => {
  const utm = event.utm || {};
  const utmParts = [
    utm.source && `source=${utm.source}`,
    utm.medium && `medium=${utm.medium}`,
    utm.campaign && `campaign=${utm.campaign}`,
    utm.content && `content=${utm.content}`,
    utm.term && `term=${utm.term}`,
  ].filter(Boolean);

  if (utmParts.length) return utmParts.join(" | ");
  return event.referrer || event.origin || "Direto / não informado";
};

// Rankings/agrupamento por visitante: calculados client-side sobre o recorte "rankingEvents"
// (recente, limitado - ver rankingsPageSize acima). Os cards de metricas NAO usam nada disto;
// vem prontos do backend (summary) para ficarem corretos independente desse recorte.
const groupVisitors = (events) => {
  const visitors = new Map();

  events.forEach((event) => {
    const key = event.visitorId || "visitor-unavailable";
    const current = visitors.get(key) || {
      id: key,
      identity: getClientIdentity(event),
      accesses: 0,
      clicks: 0,
      whatsapp: 0,
      searches: 0,
      firstActivity: event.timestamp,
      lastActivity: event.timestamp,
      traffic: buildTrafficLabel(event),
      trafficSource: event.trafficSource || buildTrafficLabel(event),
      ipMasked: event.ipMasked || event.ip || "nao identificado",
      ipHash: event.ipHash || "",
      location: getLocationLabel(event),
      device: getDeviceLabel(event),
      pages: new Set(),
      securityStatus: getSecurityStatus(event),
      suspiciousReasons: new Set(event.suspiciousReasons || []),
      status: getClientIdentity(event).status,
    };

    const identity = getClientIdentity(event);
    if (identity.status === "Cliente com login") {
      current.identity = identity;
      current.status = identity.status;
    }

    if (event.type === "visit") current.accesses += 1;
    if (trackedClickTypes.has(event.type)) current.clicks += 1;
    if (event.type === "whatsapp") current.whatsapp += 1;
    if (event.type === "search") current.searches += 1;
    if (event.pagePath || event.path) current.pages.add(event.pagePath || event.path);
    if (new Date(event.timestamp) < new Date(current.firstActivity)) current.firstActivity = event.timestamp;
    if (new Date(event.timestamp) > new Date(current.lastActivity)) current.lastActivity = event.timestamp;
    if (current.traffic === "Direto / nao informado") current.traffic = buildTrafficLabel(event);
    if (current.location === "Desconhecido") current.location = getLocationLabel(event);
    if (current.device === "Desconhecido") current.device = getDeviceLabel(event);
    if (getSecurityStatus(event) === "Suspeito") current.securityStatus = "Suspeito";
    (event.suspiciousReasons || []).forEach((reason) => current.suspiciousReasons.add(reason));
    if (current.ipMasked === "nao identificado" && (event.ipMasked || event.ip)) {
      current.ipMasked = event.ipMasked || event.ip;
    }

    visitors.set(key, current);
  });

  return [...visitors.values()]
    .map((visitor) => ({
      ...visitor,
      duration: formatDuration(visitor.firstActivity, visitor.lastActivity),
      pages: [...visitor.pages],
      suspiciousReasons: [...visitor.suspiciousReasons],
    }))
    .sort((left, right) => new Date(right.lastActivity) - new Date(left.lastActivity));
};

const buildButtonRanking = (events) => {
  const ranking = new Map();

  events.filter((event) => trackedClickTypes.has(event.type)).forEach((event) => {
    const key = event.label || "Interação sem nome";
    const current = ranking.get(key) || {
      label: key,
      total: 0,
      lastActivity: event.timestamp,
      visitor: getClientIdentity(event).name,
    };

    current.total += 1;
    current.visitor = getClientIdentity(event).name;
    if (new Date(event.timestamp) > new Date(current.lastActivity)) current.lastActivity = event.timestamp;
    ranking.set(key, current);
  });

  return [...ranking.values()].sort((left, right) => right.total - left.total).slice(0, 8);
};

const buildVisitorRanking = (events) =>
  groupVisitors(events)
    .map((visitor) => {
      const visitorEvents = events.filter((event) => event.visitorId === visitor.id && trackedClickTypes.has(event.type));
      const clicksByLabel = new Map();
      visitorEvents.forEach((event) => clicksByLabel.set(event.label, (clicksByLabel.get(event.label) || 0) + 1));
      const topButton = [...clicksByLabel.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "Sem clique";

      return {
        ...visitor,
        topButton,
        hasWhatsapp: visitor.whatsapp > 0,
      };
    })
    .sort((left, right) => right.clicks - left.clicks)
    .slice(0, 8);

const buildLocationRanking = (visitors) => {
  const ranking = new Map();

  visitors.forEach((visitor) => {
    const key = visitor.location || "Desconhecido";
    const current = ranking.get(key) || { label: key, total: 0, whatsapp: 0, suspicious: 0, visitorIds: [] };
    current.total += 1;
    current.whatsapp += visitor.whatsapp > 0 ? 1 : 0;
    current.suspicious += visitor.securityStatus === "Suspeito" ? 1 : 0;
    current.visitorIds.push(visitor.id);
    ranking.set(key, current);
  });

  return [...ranking.values()].sort((left, right) => right.total - left.total).slice(0, 8);
};

// Abrevia o visitorId para exibicao (o ID completo continua disponivel via "Copiar ID").
const shortenVisitorId = (id) => (id && id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id || "-");

// Splits que a visao agregada de groupVisitors nao guarda (so o texto combinado ja usado nas
// tabelas existentes) - derivados aqui, sob demanda, so quando o painel de detalhes abre.
const getDeviceParts = (events) => {
  const withDevice = events.find((event) => event.device && (event.device.device || event.device.browser || event.device.os));
  const device = withDevice?.device || {};
  return {
    device: device.device || "Desconhecido",
    browser: device.browser || "Desconhecido",
    os: device.os || "Desconhecido",
  };
};

const getLocationParts = (events) => {
  const withLocation = events.find((event) => event.location && (event.location.city || event.location.region || event.location.country));
  const location = withLocation?.location || {};
  return {
    city: location.city && location.city !== "Desconhecido" ? location.city : "Desconhecido",
    region: location.region && location.region !== "Desconhecido" ? location.region : "Desconhecido",
    country: location.country && location.country !== "Desconhecido" ? location.country : "Desconhecido",
  };
};

const getTrafficParts = (events) => {
  const withUtm = events.find((event) => event.utm && Object.values(event.utm).some(Boolean));
  const utm = withUtm?.utm || null;
  const withOrigin = events.find((event) => event.referrer || event.origin);
  return {
    origin: withOrigin?.referrer || withOrigin?.origin || "Direto / não informado",
    utm,
  };
};

const eventTypeLabels = {
  visit: "Visita",
  click: "Clique",
  whatsapp: "WhatsApp",
  search: "Pesquisa",
  login: "Login",
  device_location: "Localização do dispositivo",
};

const getEventTypeLabel = (event) => eventTypeLabels[event.type] || event.type;

function SummaryCard({ icon: Icon, label, value, comparison }) {
  const TrendIcon = comparison?.trend === "down" ? ArrowDown : ArrowUp;
  const hasTrend = comparison?.trend === "up" || comparison?.trend === "down";

  return (
    <article className="rounded-[10px] border border-white/[0.1] bg-white/[0.045] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-[7px] border border-imesul-red/35 bg-imesul-red/[0.12] text-imesul-red">
        <Icon size={18} aria-hidden="true" />
      </span>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-imesul-steel-light/58">
        {label}
      </p>
      <strong className="mt-1 block font-display text-4xl leading-none text-white">
        {value}
      </strong>
      {comparison && (
        <span className={`mt-3 inline-flex items-center gap-1 text-[11px] font-semibold ${hasTrend ? comparison.trend === "up" ? "text-[#25D366]" : "text-[#f87171]" : "text-imesul-steel-light/55"}`}>
          {hasTrend && <TrendIcon size={13} aria-hidden="true" />}
          {comparison.label}
        </span>
      )}
    </article>
  );
}

function MiniTable({ title, children }) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-white/[0.1] bg-white/[0.025]">
      <h3 className="border-b border-white/[0.08] px-4 py-3 font-condensed text-[15px] font-bold uppercase tracking-[0.12em] text-white">
        {title}
      </h3>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

// Painel lateral "Detalhes do visitante": cruza tudo que ja existe para aquele visitorId (visitor
// agregado de groupVisitors + os proprios eventos ja carregados em rankingEvents) sem consultar
// nada novo no backend nem criar um segundo sistema de analytics.
function VisitorDetailsPanel({ visitor, events, onClose, onFilterVisitor }) {
  const [copied, setCopied] = useState(false);
  const deviceParts = getDeviceParts(events);
  const locationParts = getLocationParts(events);
  const trafficParts = getTrafficParts(events);
  const pages = events
    .filter((event) => event.pagePath || event.path)
    .map((event) => ({ path: event.pagePath || event.path, timestamp: event.timestamp }));

  const copyVisitorId = async () => {
    try {
      await navigator.clipboard.writeText(visitor.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponivel (permissao/navegador antigo) - o ID completo ja fica visivel no painel.
    }
  };

  return (
    <div className="fixed inset-0 z-[240] flex justify-end bg-[#020711]/82 backdrop-blur-md">
      <button type="button" onClick={onClose} aria-label="Fechar detalhes do visitante" className="absolute inset-0 cursor-default" />
      <section className="relative flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-white/[0.12] bg-[linear-gradient(145deg,rgba(8,22,38,0.99),rgba(4,10,19,0.99))] shadow-[0_0_120px_rgba(0,0,0,0.6)]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-5">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-imesul-red">Detalhes do visitante</p>
            <h3 className="mt-2 truncate font-display text-2xl text-white" title={visitor.identity.name}>{visitor.identity.name}</h3>
            <p className="mt-1 font-mono text-xs text-imesul-steel-light/55">{shortenVisitorId(visitor.id)}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.12] text-white hover:bg-white/[0.08]" aria-label="Fechar">
            <X size={17} aria-hidden="true" />
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap gap-2 border-b border-white/[0.08] px-5 py-4">
          <button type="button" onClick={() => onFilterVisitor(visitor.id)} className="inline-flex h-9 items-center gap-2 rounded-[7px] border border-imesul-red/45 px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-imesul-red transition-colors hover:bg-imesul-red/10">
            <Filter size={14} aria-hidden="true" /> Filtrar só este visitante
          </button>
          <button type="button" onClick={copyVisitorId} className="inline-flex h-9 items-center gap-2 rounded-[7px] border border-white/[0.14] px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:border-white/25 hover:bg-white/[0.07]">
            <Copy size={14} aria-hidden="true" /> {copied ? "ID copiado!" : "Copiar ID do visitante"}
          </button>
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center gap-2 rounded-[7px] border border-white/[0.12] px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-imesul-steel-light/72 transition-colors hover:border-white/25 hover:text-white">
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <dl className="grid gap-3 text-sm text-imesul-steel-light/76 sm:grid-cols-2">
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3 sm:col-span-2"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Identificação</dt><dd className="mt-1 text-white">{visitor.identity.name}</dd></div>
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Cidade</dt><dd className="mt-1">{locationParts.city}</dd></div>
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Região / País</dt><dd className="mt-1">{locationParts.region} / {locationParts.country}</dd></div>
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">IP mascarado</dt><dd className="mt-1 break-all font-mono">{visitor.ipMasked}</dd></div>
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Dispositivo</dt><dd className="mt-1">{deviceParts.device}</dd></div>
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Navegador</dt><dd className="mt-1">{deviceParts.browser}</dd></div>
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Sistema operacional</dt><dd className="mt-1">{deviceParts.os}</dd></div>
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3 sm:col-span-2"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Origem do tráfego</dt><dd className="mt-1 break-all">{trafficParts.origin}</dd></div>
            {trafficParts.utm ? (
              <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3 sm:col-span-2">
                <dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">UTM</dt>
                <dd className="mt-1 break-all">
                  {[
                    trafficParts.utm.source && `source=${trafficParts.utm.source}`,
                    trafficParts.utm.medium && `medium=${trafficParts.utm.medium}`,
                    trafficParts.utm.campaign && `campaign=${trafficParts.utm.campaign}`,
                    trafficParts.utm.content && `content=${trafficParts.utm.content}`,
                    trafficParts.utm.term && `term=${trafficParts.utm.term}`,
                  ].filter(Boolean).join(" | ") || "-"}
                </dd>
              </div>
            ) : null}
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Primeira atividade</dt><dd className="mt-1">{formatDate(visitor.firstActivity)} {formatTime(visitor.firstActivity)}</dd></div>
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Última atividade</dt><dd className="mt-1">{formatDate(visitor.lastActivity)} {formatTime(visitor.lastActivity)}</dd></div>
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Duração observada</dt><dd className="mt-1">{visitor.duration}</dd></div>
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Total de acessos</dt><dd className="mt-1">{visitor.accesses}</dd></div>
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Total de cliques</dt><dd className="mt-1">{visitor.clicks}</dd></div>
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Total de buscas</dt><dd className="mt-1">{visitor.searches}</dd></div>
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Total de WhatsApp</dt><dd className="mt-1">{visitor.whatsapp}</dd></div>
            <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3 sm:col-span-2">
              <dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Status de segurança</dt>
              <dd className={`mt-1 font-semibold ${visitor.securityStatus === "Suspeito" ? "text-[#f87171]" : "text-[#25D366]"}`}>
                {visitor.securityStatus}
                {visitor.suspiciousReasons.length ? ` — ${visitor.suspiciousReasons.join(", ")}` : ""}
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <h4 className="font-condensed text-[13px] font-bold uppercase tracking-[0.14em] text-white">Páginas visitadas</h4>
            <ol className="mt-3 space-y-1.5">
              {pages.length ? pages.map((page, index) => (
                <li key={`page-${index}-${page.timestamp}`} className="flex items-center gap-3 rounded-[6px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-imesul-steel-light/76">
                  <span className="shrink-0 font-mono text-[11px] text-imesul-steel-light/50">{formatTime(page.timestamp)}</span>
                  <span className="truncate text-white/90">{page.path}</span>
                </li>
              )) : <li className="rounded-[6px] border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-center text-sm text-imesul-steel-light/55">Nenhuma página registrada.</li>}
            </ol>
          </div>

          <div className="mt-6">
            <h4 className="font-condensed text-[13px] font-bold uppercase tracking-[0.14em] text-white">Linha do tempo</h4>
            <ol className="mt-3 space-y-2">
              {events.length ? events.map((event) => (
                <li key={event.id} className="rounded-[8px] border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-sm text-imesul-steel-light/76">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-[11px] text-imesul-steel-light/50">{formatDate(event.timestamp)} {formatTime(event.timestamp)}</span>
                    <span className="rounded-full border border-white/[0.14] px-2 py-0.5 font-condensed text-[10px] font-bold uppercase tracking-[0.08em] text-white">{getEventTypeLabel(event)}</span>
                    {event.label ? <span className="font-semibold text-white">{event.label}</span> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-imesul-steel-light/58">
                    {event.section ? <span>Seção: {event.section}</span> : null}
                    {(event.pagePath || event.path) ? <span>Path: {event.pagePath || event.path}</span> : null}
                    {event.detail ? <span>Detalhe: {event.detail}</span> : null}
                  </div>
                </li>
              )) : <li className="rounded-[8px] border border-white/[0.08] bg-white/[0.025] px-3 py-4 text-center text-sm text-imesul-steel-light/55">Nenhum evento registrado.</li>}
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}

// Mostra eventos vindos das APIs protegidas (paginacao/metricas server-side) no painel admin.
export default function AdminDashboard({ open, onClose, onLogout }) {
  // Recorte usado para rankings/agrupamento por visitante (ver rankingsPageSize acima).
  const [rankingEvents, setRankingEvents] = useState([]);
  // Eventos ja marcados suspeitos, buscados a parte para nao depender do recorte de rankings.
  const [suspiciousEvents, setSuspiciousEvents] = useState([]);
  // Tabela principal de eventos: paginada de verdade pelo backend.
  const [tableEvents, setTableEvents] = useState([]);
  const [tablePagination, setTablePagination] = useState({ page: 1, pageSize: pageSizeOptions[0], total: 0, totalPages: 1 });
  // Metricas dos cards: agregadas no backend, corretas independente da paginacao/recorte acima.
  const [summary, setSummary] = useState(defaultSummary);

  const [activeFilter, setActiveFilter] = useState("all");
  const [activePeriod, setActivePeriod] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSecurityEvent, setSelectedSecurityEvent] = useState(null);
  const [selectedLocationEvent, setSelectedLocationEvent] = useState(null);
  // "Detalhes do visitante": selectedVisitorId aponta para o mesmo visitor.id ja calculado por
  // groupVisitors. locationVisitorPicker guarda o item de "Visitantes por cidade/regiao" quando
  // ha mais de um visitante naquela localizacao, ate o admin escolher um deles.
  const [selectedVisitorId, setSelectedVisitorId] = useState(null);
  const [locationVisitorPicker, setLocationVisitorPicker] = useState(null);
  // Aba "Comercial" (Lead ID, rodízio, IMEbot, carrinho) - renderizada como camada por cima do
  // analytics existente, sem depender do estado dele (ver CommercialReportPanel.jsx).
  const [activeTab, setActiveTab] = useState("analytics");

  // Cards + rankings dependem so do periodo selecionado (nao do filtro/busca/pagina da tabela).
  const refreshOverview = useCallback(() => {
    getAnalyticsEvents({ period: activePeriod, pageSize: rankingsPageSize })
      .then((result) => {
        setRankingEvents(result.events);
        if (result.summary) setSummary(result.summary);
      })
      .catch(() => {});

    getAnalyticsEvents({ type: "suspicious", pageSize: 100 })
      .then((result) => setSuspiciousEvents(result.events))
      .catch(() => {});
  }, [activePeriod]);

  // Tabela principal: paginacao/filtro/busca reais no backend.
  const refreshTable = useCallback(() => {
    getAnalyticsEvents({
      page: currentPage,
      pageSize,
      type: activeFilter === "hasDeviceLocation" ? "all" : activeFilter,
      period: activePeriod,
      search: searchQuery,
      hasDeviceLocation: activeFilter === "hasDeviceLocation",
    })
      .then((result) => {
        setTableEvents(result.events);
        setTablePagination(result.pagination);
      })
      .catch(() => {});
  }, [currentPage, pageSize, activeFilter, activePeriod, searchQuery]);

  useEffect(() => {
    if (!open) return undefined;

    const timer = window.setTimeout(() => {
      refreshOverview();
      refreshTable();
    }, 0);
    const unsubscribe = subscribeToLocalEvents(() => {
      refreshOverview();
      refreshTable();
    });

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [open, refreshOverview, refreshTable]);

  const analytics = useMemo(() => {
    const visitors = groupVisitors(rankingEvents);

    return {
      visitors,
      buttonRanking: buildButtonRanking(rankingEvents),
      visitorRanking: buildVisitorRanking(rankingEvents),
      locationRanking: buildLocationRanking(visitors),
    };
  }, [rankingEvents]);

  // Eventos do visitante selecionado, em ordem cronologica - mesmo recorte rankingEvents ja
  // carregado (ate rankingsPageSize), sem nenhuma consulta nova ao backend.
  const selectedVisitorEvents = useMemo(() => {
    if (!selectedVisitorId) return [];
    return rankingEvents
      .filter((event) => (event.visitorId || "visitor-unavailable") === selectedVisitorId)
      .slice()
      .sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
  }, [rankingEvents, selectedVisitorId]);

  const openVisitorDetails = (visitorId) => {
    setLocationVisitorPicker(null);
    setSelectedVisitorId(visitorId);
  };

  const handleLocationRowClick = (item) => {
    if (item.visitorIds.length === 1) {
      openVisitorDetails(item.visitorIds[0]);
    } else {
      setLocationVisitorPicker(item);
    }
  };

  // Reaproveita a busca do backend ja existente (visitor_id ILIKE, ver Backend.js/analyticsStore.js)
  // em vez de criar um segundo mecanismo de filtro so para o painel de detalhes.
  const handleFilterVisitor = (visitorId) => {
    setSelectedVisitorId(null);
    setSearchQuery(visitorId);
  };

  // Volta para a primeira pagina sempre que o filtro, o periodo ou a busca mudam, para nunca
  // deixar o admin numa pagina vazia. Ajuste de estado durante a renderizacao (nao em effect):
  // React garante que isso substitui o render atual sem chegar a pintar a tela intermediaria.
  const filterSignature = `${activeFilter}|${activePeriod}|${searchQuery}|${pageSize}`;
  const [lastFilterSignature, setLastFilterSignature] = useState(filterSignature);
  if (filterSignature !== lastFilterSignature) {
    setLastFilterSignature(filterSignature);
    setCurrentPage(1);
  }

  const exportEventsAsJson = () => {
    // Exporta o recorte de rankings (periodo atual, ate rankingsPageSize eventos) - a mesma
    // base usada pelos rankings do painel. Detalhes sensiveis ficam restritos ao modal de seguranca.
    const sanitizedEvents = rankingEvents.map(({ securityDetails, ...event }) => event);
    const file = new Blob([JSON.stringify(sanitizedEvents, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = url;
    link.download = `relatorio-imesul-vendas-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const buildTableRows = (list) =>
    list.map((event) => `
      <tr>
        <td>${escapeHtml(formatDate(event.timestamp))}</td>
        <td>${escapeHtml(formatTime(event.timestamp))}</td>
        <td>${escapeHtml(event.type)}</td>
        <td>${escapeHtml(event.section || "-")}</td>
        <td>${escapeHtml(event.label || "-")}</td>
        <td>${escapeHtml(event.detail || "-")}</td>
        <td>${escapeHtml(event.origin || "-")}</td>
        <td>${escapeHtml(event.ipMasked || event.ip || "não identificado")}</td>
        <td>${escapeHtml(event.visitorId || "-")}</td>
        <td>${escapeHtml(getClientIdentity(event).phone)}</td>
        <td>${event.isLoggedIn ? "Sim" : "Não"}</td>
      </tr>
    `).join("");

  const printReport = () => {
    const generatedAt = new Date();
    const { metrics, comparisons } = summary;
    const { visitors, buttonRanking, visitorRanking, locationRanking } = analytics;
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return;

    reportWindow.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Relatório do Site — IMESUL Vendas</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 32px; color: #111827; background: #ffffff; font-family: Arial, sans-serif; }
            h1 { margin: 0; font-size: 28px; letter-spacing: .02em; }
            h2 { margin: 28px 0 12px; font-size: 18px; }
            .meta { margin-top: 8px; color: #4b5563; font-size: 13px; }
            .notice { margin: 22px 0; padding: 14px 16px; border-left: 4px solid #d42b2b; background: #f9fafb; color: #374151; font-size: 13px; line-height: 1.5; }
            .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 22px 0; }
            .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 14px; }
            .card span { display: block; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
            .card strong { display: block; margin-top: 6px; font-size: 22px; color: #111827; }
            .card em { display: block; margin-top: 6px; color: #6b7280; font-size: 11px; font-style: normal; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 10px; }
            th, td { border: 1px solid #d1d5db; padding: 7px; vertical-align: top; text-align: left; }
            th { background: #f3f4f6; color: #111827; text-transform: uppercase; letter-spacing: .04em; }
            @media print { body { padding: 20px; } .cards { grid-template-columns: repeat(3, 1fr); } }
          </style>
        </head>
        <body>
          <h1>Relatório do Site — IMESUL Vendas</h1>
          <p class="meta">Gerado em ${escapeHtml(formatDate(generatedAt.toISOString()))} às ${escapeHtml(formatTime(generatedAt.toISOString()))}</p>
          <p class="notice">${escapeHtml(reportObservation)} Não são armazenados CPF, senha ou tokens neste painel.</p>
          <section class="cards">
            <div class="card"><span>Visitantes únicos</span><strong>${metrics.uniqueVisitors}</strong><em>${escapeHtml(comparisons.uniqueVisitors.label)}</em></div>
            <div class="card"><span>Total de acessos</span><strong>${metrics.totalAccesses}</strong><em>Acessos repetidos: ${metrics.repeatedAccesses}</em></div>
            <div class="card"><span>Cliques em botões</span><strong>${metrics.clicks}</strong><em>${escapeHtml(comparisons.clicks.label)}</em></div>
            <div class="card"><span>Cliques WhatsApp</span><strong>${metrics.whatsapp}</strong><em>${escapeHtml(comparisons.whatsapp.label)}</em></div>
            <div class="card"><span>Pesquisas</span><strong>${metrics.searches}</strong><em>${escapeHtml(comparisons.searches.label)}</em></div>
            <div class="card"><span>Logins/cadastros</span><strong>${metrics.logins}</strong><em>${escapeHtml(comparisons.logins.label)}</em></div>
          </section>
          <h2>Ranking de botões</h2>
          <table><thead><tr><th>Botão</th><th>Cliques</th><th>Quem clicou</th><th>Última vez</th></tr></thead><tbody>
            ${buttonRanking.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${item.total}</td><td>${escapeHtml(item.visitor)}</td><td>${escapeHtml(formatDate(item.lastActivity))} ${escapeHtml(formatTime(item.lastActivity))}</td></tr>`).join("") || '<tr><td colspan="4">Sem cliques registrados.</td></tr>'}
          </tbody></table>
          <h2>Ranking por cliente/visitante</h2>
          <table><thead><tr><th>Cliente/visitante</th><th>Visitor ID</th><th>Telefone</th><th>Botão mais clicado</th><th>Total de cliques</th><th>WhatsApp</th><th>Última atividade</th></tr></thead><tbody>
            ${visitorRanking.map((item) => `<tr><td>${escapeHtml(item.identity.name)}</td><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.identity.phone)}</td><td>${escapeHtml(item.topButton)}</td><td>${item.clicks}</td><td>${item.hasWhatsapp ? "Sim" : "Não"}</td><td>${escapeHtml(formatDate(item.lastActivity))} ${escapeHtml(formatTime(item.lastActivity))}</td></tr>`).join("") || '<tr><td colspan="7">Sem visitantes registrados.</td></tr>'}
          </tbody></table>
          <h2>Visitantes e clientes</h2>
          <table><thead><tr><th>Identificação</th><th>Visitor ID</th><th>Telefone</th><th>E-mail</th><th>Acessos</th><th>Cliques</th><th>WhatsApp</th><th>Pesquisas</th><th>Origem/UTM</th><th>IP mascarado</th><th>Status</th></tr></thead><tbody>
            ${visitors.map((visitor) => `<tr><td>${escapeHtml(visitor.identity.name)}</td><td>${escapeHtml(visitor.id)}</td><td>${escapeHtml(visitor.identity.phone)}</td><td>${escapeHtml(visitor.identity.email)}</td><td>${visitor.accesses}</td><td>${visitor.clicks}</td><td>${visitor.whatsapp}</td><td>${visitor.searches}</td><td>${escapeHtml(visitor.traffic)}</td><td>${escapeHtml(visitor.ipMasked)}</td><td>${escapeHtml(visitor.status)}</td></tr>`).join("") || '<tr><td colspan="11">Sem visitantes registrados.</td></tr>'}
          </tbody></table>
          <h2>Eventos</h2>
          <table><thead><tr><th>Data</th><th>Hora</th><th>Tipo</th><th>Seção</th><th>Ação</th><th>Detalhe</th><th>Origem</th><th>IP mascarado</th><th>Visitor ID</th><th>Telefone</th><th>Logado?</th></tr></thead><tbody>
            ${buildTableRows(rankingEvents.slice().reverse()) || '<tr><td colspan="11">Nenhum evento registrado.</td></tr>'}
          </tbody></table>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  };

  if (!open) return null;

  const { metrics, comparisons } = summary;
  const { visitors, buttonRanking, visitorRanking, locationRanking } = analytics;
  const selectedSecurityDetails = getSecurityDetails(selectedSecurityEvent || {});

  return (
    <div className="fixed inset-0 z-[210] bg-[#030811]/88 px-4 py-5 backdrop-blur-lg">
      <section className="relative mx-auto flex h-[94vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-[12px] border border-white/[0.12] bg-[linear-gradient(145deg,rgba(8,22,38,0.98),rgba(4,10,19,0.99))] shadow-[0_30px_120px_rgba(0,0,0,0.6)]">
        <header className="flex shrink-0 flex-col gap-4 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-imesul-red">Área restrita</p>
            <h2 className="mt-2 font-display text-4xl leading-none text-white sm:text-5xl">Painel Administrativo IMESUL</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-imesul-steel-light/68">
              Este painel registra eventos para análise de uso do site. IPs são mascarados e não são armazenados CPF, senha ou tokens. Para produção, use política de privacidade e consentimento conforme LGPD.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("analytics")}
                className={`inline-flex h-9 items-center gap-2 rounded-[7px] border px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.11em] transition-colors ${activeTab === "analytics" ? "border-imesul-red bg-imesul-red text-white" : "border-white/[0.12] text-imesul-steel-light/72 hover:border-white/25 hover:text-white"}`}
              >
                <BarChart3 size={14} aria-hidden="true" /> Analytics
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("commercial")}
                className={`inline-flex h-9 items-center gap-2 rounded-[7px] border px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.11em] transition-colors ${activeTab === "commercial" ? "border-imesul-red bg-imesul-red text-white" : "border-white/[0.12] text-imesul-steel-light/72 hover:border-white/25 hover:text-white"}`}
              >
                <Briefcase size={14} aria-hidden="true" /> Comercial
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("monitoring")}
                className={`inline-flex h-9 items-center gap-2 rounded-[7px] border px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.11em] transition-colors ${activeTab === "monitoring" ? "border-imesul-red bg-imesul-red text-white" : "border-white/[0.12] text-imesul-steel-light/72 hover:border-white/25 hover:text-white"}`}
              >
                <Activity size={14} aria-hidden="true" /> Monitoramento
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={printReport} className="inline-flex h-10 items-center gap-2 rounded-[7px] border border-white/[0.12] px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.11em] text-white transition-colors hover:border-white/25 hover:bg-white/[0.07]">
              <Printer size={15} aria-hidden="true" /> Gerar PDF
            </button>
            <button type="button" onClick={exportEventsAsJson} className="inline-flex h-10 items-center gap-2 rounded-[7px] border border-white/[0.12] px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.11em] text-white transition-colors hover:border-white/25 hover:bg-white/[0.07]">
              <Download size={15} aria-hidden="true" /> Exportar dados
            </button>
            <button
              type="button"
              onClick={async () => {
                await clearLocalEvents();
                refreshOverview();
                refreshTable();
              }}
              className="inline-flex h-10 items-center gap-2 rounded-[7px] border border-white/[0.12] px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.11em] text-white transition-colors hover:border-imesul-red/55 hover:bg-imesul-red/[0.12]"
            >
              <Trash2 size={15} aria-hidden="true" /> Limpar eventos
            </button>
            <button type="button" onClick={onLogout} className="inline-flex h-10 items-center gap-2 rounded-[7px] border border-white/[0.12] px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.11em] text-white transition-colors hover:border-white/25 hover:bg-white/[0.07]">
              <LogOut size={15} aria-hidden="true" /> Sair do admin
            </button>
            <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] text-white transition-colors hover:bg-white/[0.08]" aria-label="Fechar painel administrativo">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {activeTab === "commercial" && <CommercialReportPanel />}
          {activeTab === "monitoring" && <MonitoringPanel />}
          {activeTab === "analytics" && (
            <>
          <div className="flex flex-wrap gap-2">
            {periodFilters.map((period) => (
              <button key={period.value} type="button" onClick={() => setActivePeriod(period.value)} className={`rounded-full border px-3.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${activePeriod === period.value ? "border-imesul-red bg-imesul-red text-white" : "border-white/[0.12] bg-white/[0.035] text-imesul-steel-light/72 hover:border-white/[0.22] hover:text-white"}`}>
                {period.label}
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <SummaryCard icon={Users} label="Visitantes únicos" value={metrics.uniqueVisitors} comparison={activePeriod === "all" ? comparisons.uniqueVisitors : null} />
            <SummaryCard icon={BarChart3} label="Total de acessos" value={metrics.totalAccesses} />
            <SummaryCard icon={BarChart3} label="Acessos repetidos" value={metrics.repeatedAccesses} />
            <SummaryCard icon={MousePointerClick} label="Cliques em botões" value={metrics.clicks} comparison={activePeriod === "all" ? comparisons.clicks : null} />
            <SummaryCard icon={MessageCircle} label="Cliques WhatsApp" value={metrics.whatsapp} comparison={activePeriod === "all" ? comparisons.whatsapp : null} />
            <SummaryCard icon={Search} label="Pesquisas" value={metrics.searches} comparison={activePeriod === "all" ? comparisons.searches : null} />
            <SummaryCard icon={UserCheck} label="Logins/cadastros" value={metrics.logins} comparison={activePeriod === "all" ? comparisons.logins : null} />
            <SummaryCard icon={ShieldAlert} label="Suspeitos" value={metrics.suspiciousVisitors} />
          </div>

          <div className="mt-5 rounded-[10px] border border-white/[0.1] bg-white/[0.035] p-4 text-sm leading-6 text-imesul-steel-light/72">
            <strong className="text-white">Privacidade:</strong> IPs são exibidos de forma mascarada. Origem/referrer/UTM são registrados apenas quando o navegador informa esses dados.
          </div>

          <div className="mt-5">
            <MiniTable title="Detalhes de seguranca">
              <table className="min-w-[900px] w-full border-collapse text-left">
                <thead className="bg-white/[0.055]"><tr className="font-condensed text-[12px] uppercase tracking-[0.12em] text-imesul-steel-light/72"><th className="px-4 py-3">Data</th><th className="px-4 py-3">Hora</th><th className="px-4 py-3">Evento</th><th className="px-4 py-3">Path</th><th className="px-4 py-3">Motivo</th><th className="px-4 py-3">Acao</th></tr></thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {suspiciousEvents.length ? suspiciousEvents.slice().reverse().map((event) => (
                    <tr key={`security-${event.id}`} className="text-sm text-imesul-steel-light/74"><td className="px-4 py-3">{formatDate(event.timestamp)}</td><td className="px-4 py-3">{formatTime(event.timestamp)}</td><td className="px-4 py-3 font-semibold text-white">{event.label || event.type}</td><td className="px-4 py-3">{event.pagePath || event.path || "-"}</td><td className="px-4 py-3 text-[#fca5a5]">{(event.suspiciousReasons || []).join(", ") || "Suspeito"}</td><td className="px-4 py-3"><button type="button" onClick={() => setSelectedSecurityEvent(event)} className="rounded-full border border-[#f87171]/35 px-3 py-1 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-[#fecaca] transition-colors hover:border-[#f87171] hover:bg-[#f87171]/10">Abrir detalhes</button></td></tr>
                  )) : <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-imesul-steel-light/62">Nenhum evento suspeito registrado.</td></tr>}
                </tbody>
              </table>
            </MiniTable>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <MiniTable title="Visitantes por cidade/regiao">
              <table className="min-w-[520px] w-full border-collapse text-left">
                <thead className="bg-white/[0.055]"><tr className="font-condensed text-[12px] uppercase tracking-[0.12em] text-imesul-steel-light/72"><th className="px-4 py-3">Localizacao</th><th className="px-4 py-3">Visitantes</th><th className="px-4 py-3">WhatsApp</th><th className="px-4 py-3">Suspeitos</th></tr></thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {locationRanking.length ? locationRanking.map((item) => (
                    <tr key={item.label} onClick={() => handleLocationRowClick(item)} className="cursor-pointer text-sm text-imesul-steel-light/74 transition-colors hover:bg-white/[0.04]"><td className="px-4 py-3 font-semibold text-white">{item.label}</td><td className="px-4 py-3">{item.total}</td><td className="px-4 py-3">{item.whatsapp}</td><td className="px-4 py-3">{item.suspicious}</td></tr>
                  )) : <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-imesul-steel-light/62">Sem localizacao registrada.</td></tr>}
                </tbody>
              </table>
            </MiniTable>

            <MiniTable title="Sessoes e seguranca">
              <table className="min-w-[760px] w-full border-collapse text-left">
                <thead className="bg-white/[0.055]"><tr className="font-condensed text-[12px] uppercase tracking-[0.12em] text-imesul-steel-light/72"><th className="px-4 py-3">Visitante</th><th className="px-4 py-3">Dispositivo</th><th className="px-4 py-3">Tempo</th><th className="px-4 py-3">Paginas</th><th className="px-4 py-3">Seguranca</th></tr></thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {visitors.length ? visitors.map((visitor) => (
                    <tr key={`session-${visitor.id}`} onClick={() => openVisitorDetails(visitor.id)} className="cursor-pointer text-sm text-imesul-steel-light/74 transition-colors hover:bg-white/[0.04]"><td className="px-4 py-3 font-semibold text-white">{visitor.identity.name}</td><td className="px-4 py-3">{visitor.device}</td><td className="px-4 py-3">{visitor.duration}</td><td className="px-4 py-3">{visitor.pages.join(", ") || "-"}</td><td className={`px-4 py-3 font-semibold ${visitor.securityStatus === "Suspeito" ? "text-[#f87171]" : "text-[#25D366]"}`}>{visitor.securityStatus}{visitor.suspiciousReasons.length ? `: ${visitor.suspiciousReasons.join(", ")}` : ""}</td></tr>
                  )) : <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-imesul-steel-light/62">Sem sessoes registradas.</td></tr>}
                </tbody>
              </table>
            </MiniTable>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <MiniTable title="Ranking de interações">
              <table className="min-w-[620px] w-full border-collapse text-left">
                <thead className="bg-white/[0.055]"><tr className="font-condensed text-[12px] uppercase tracking-[0.12em] text-imesul-steel-light/72"><th className="px-4 py-3">Botão</th><th className="px-4 py-3">Cliques</th><th className="px-4 py-3">Quem clicou</th><th className="px-4 py-3">Última vez</th></tr></thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {buttonRanking.length ? buttonRanking.map((item) => (
                    <tr key={item.label} className="text-sm text-imesul-steel-light/74"><td className="px-4 py-3 font-semibold text-white">{item.label}</td><td className="px-4 py-3">{item.total}</td><td className="px-4 py-3">{item.visitor}</td><td className="px-4 py-3">{formatDate(item.lastActivity)} {formatTime(item.lastActivity)}</td></tr>
                  )) : <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-imesul-steel-light/62">Sem cliques registrados.</td></tr>}
                </tbody>
              </table>
            </MiniTable>

            <MiniTable title="Ranking por cliente/visitante">
              <table className="min-w-[700px] w-full border-collapse text-left">
                <thead className="bg-white/[0.055]"><tr className="font-condensed text-[12px] uppercase tracking-[0.12em] text-imesul-steel-light/72"><th className="px-4 py-3">Cliente/visitante</th><th className="px-4 py-3">Visitor ID</th><th className="px-4 py-3">Botão mais clicado</th><th className="px-4 py-3">Cliques</th><th className="px-4 py-3">WhatsApp</th><th className="px-4 py-3">Última atividade</th></tr></thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {visitorRanking.length ? visitorRanking.map((item) => (
                    <tr key={item.id} className="text-sm text-imesul-steel-light/74"><td className="px-4 py-3 font-semibold text-white">{item.identity.name}</td><td className="px-4 py-3">{item.id}</td><td className="px-4 py-3">{item.topButton}</td><td className="px-4 py-3">{item.clicks}</td><td className="px-4 py-3">{item.hasWhatsapp ? "Sim" : "Não"}</td><td className="px-4 py-3">{formatDate(item.lastActivity)} {formatTime(item.lastActivity)}</td></tr>
                  )) : <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-imesul-steel-light/62">Sem visitantes registrados.</td></tr>}
                </tbody>
              </table>
            </MiniTable>
          </div>

          <div className="mt-5">
            <MiniTable title="Visitantes e clientes">
              <table className="min-w-[1100px] w-full border-collapse text-left">
                <thead className="bg-white/[0.055]"><tr className="font-condensed text-[12px] uppercase tracking-[0.12em] text-imesul-steel-light/72"><th className="px-4 py-3">Identificação</th><th className="px-4 py-3">Visitor ID</th><th className="px-4 py-3">IP mascarado</th><th className="px-4 py-3">Telefone</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Acessos</th><th className="px-4 py-3">Cliques</th><th className="px-4 py-3">WhatsApp</th><th className="px-4 py-3">Pesquisas</th><th className="px-4 py-3">Última atividade</th><th className="px-4 py-3">Origem/referrer/UTM</th><th className="px-4 py-3">Status</th></tr></thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {visitors.length ? visitors.map((visitor) => (
                    <tr key={visitor.id} className="text-sm text-imesul-steel-light/74"><td className="px-4 py-3 font-semibold text-white">{visitor.identity.name}</td><td className="px-4 py-3">{visitor.id}</td><td className="px-4 py-3">{visitor.ipMasked}</td><td className="px-4 py-3">{visitor.identity.phone}</td><td className="px-4 py-3">{visitor.identity.email}</td><td className="px-4 py-3">{visitor.accesses}</td><td className="px-4 py-3">{visitor.clicks}</td><td className="px-4 py-3">{visitor.whatsapp}</td><td className="px-4 py-3">{visitor.searches}</td><td className="px-4 py-3">{formatDate(visitor.lastActivity)} {formatTime(visitor.lastActivity)}</td><td className="px-4 py-3">{visitor.traffic}</td><td className="px-4 py-3">{visitor.status}</td></tr>
                  )) : <tr><td colSpan={12} className="px-4 py-8 text-center text-sm text-imesul-steel-light/62">Sem visitantes registrados.</td></tr>}
                </tbody>
              </table>
            </MiniTable>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {filters.map((filter) => (
              <button key={filter.value} type="button" onClick={() => setActiveFilter(filter.value)} className={`rounded-full border px-4 py-2 font-condensed text-[12px] font-bold uppercase tracking-[0.12em] transition-colors ${activeFilter === filter.value ? "border-imesul-red bg-imesul-red text-white" : "border-white/[0.12] bg-white/[0.035] text-imesul-steel-light/72 hover:border-white/[0.22] hover:text-white"}`}>
                {filter.label}
              </button>
            ))}
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar por visitante, telefone, e-mail, página, IP ou cidade"
              className="ml-auto h-9 w-full max-w-xs rounded-full border border-white/[0.12] bg-white/[0.035] px-4 text-[13px] text-white outline-none placeholder:text-imesul-steel-light/45 focus:border-imesul-red/60"
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-[10px] border border-white/[0.1]">
            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full border-collapse text-left">
                <thead className="bg-white/[0.055]"><tr className="font-condensed text-[12px] uppercase tracking-[0.12em] text-imesul-steel-light/72"><th className="px-4 py-3">Data</th><th className="px-4 py-3">Hora</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Página/seção</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Detalhe</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">IP mascarado</th><th className="px-4 py-3">Visitor ID</th><th className="px-4 py-3">Telefone</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Logado?</th><th className="px-4 py-3">Localização</th></tr></thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {tableEvents.length ? tableEvents.map((event) => {
                    const identity = getClientIdentity(event);
                    return (
                      <tr key={event.id} className="text-sm text-imesul-steel-light/74"><td className="px-4 py-3">{formatDate(event.timestamp)}</td><td className="px-4 py-3">{formatTime(event.timestamp)}</td><td className="px-4 py-3 font-semibold text-white">{event.type}</td><td className="px-4 py-3">{event.section || "-"}</td><td className="px-4 py-3">{event.label || "-"}</td><td className="px-4 py-3">{event.detail || "-"}</td><td className="px-4 py-3">{buildTrafficLabel(event)}</td><td className="px-4 py-3">{event.ipMasked || event.ip || "não identificado"}</td><td className="px-4 py-3">{event.visitorId || "-"}</td><td className="px-4 py-3">{identity.phone}</td><td className="px-4 py-3">{identity.name}</td><td className="px-4 py-3">{event.isLoggedIn ? "Sim" : "Não"}</td><td className="px-4 py-3"><button type="button" onClick={() => setSelectedLocationEvent(event)} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] px-3 py-1 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-imesul-steel-light/78 transition-colors hover:border-imesul-red/55 hover:text-white"><MapPin size={12} aria-hidden="true" /> Ver</button></td></tr>
                    );
                  }) : <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-imesul-steel-light/62">Ainda não há eventos para este filtro.</td></tr>}
                </tbody>
              </table>
            </div>
            {tablePagination.total > pageSizeOptions[0] ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-imesul-steel-light/62">
                  <span>{tablePagination.total} eventos</span>
                  <select
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                    className="rounded-[6px] border border-white/[0.12] bg-white/[0.035] px-2 py-1 text-xs text-white outline-none"
                  >
                    {pageSizeOptions.map((size) => (
                      <option key={size} value={size} className="bg-[#0a1727]">{size} por página</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={tablePagination.page <= 1} onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))} className="rounded-full border border-white/[0.12] px-3 py-1 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-imesul-steel-light/72 transition-colors hover:border-white/[0.25] hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                    Anterior
                  </button>
                  <span className="text-xs text-imesul-steel-light/62">Página {tablePagination.page} de {tablePagination.totalPages}</span>
                  <button type="button" disabled={tablePagination.page >= tablePagination.totalPages} onClick={() => setCurrentPage((page) => Math.min(page + 1, tablePagination.totalPages))} className="rounded-full border border-white/[0.12] px-3 py-1 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-imesul-steel-light/72 transition-colors hover:border-white/[0.25] hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                    Próxima
                  </button>
                </div>
              </div>
            ) : null}
          </div>
            </>
          )}
        </div>
      </section>
      {selectedSecurityEvent ? (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-[#020711]/82 px-4 backdrop-blur-md">
          <section className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[12px] border border-[#f87171]/22 bg-[linear-gradient(145deg,rgba(8,22,38,0.98),rgba(4,10,19,0.99))] p-5 shadow-[0_26px_90px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#fca5a5]">Evento suspeito</p>
                <h3 className="mt-2 font-display text-3xl text-white">Detalhes de segurança</h3>
                <p className="mt-2 text-sm leading-6 text-imesul-steel-light/68">IP completo e headers reduzidos aparecem aqui apenas para investigação administrativa.</p>
              </div>
              <button type="button" onClick={() => setSelectedSecurityEvent(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.12] text-white hover:bg-white/[0.08]" aria-label="Fechar detalhes de segurança">
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <dl className="mt-5 grid gap-3 text-sm text-imesul-steel-light/76 sm:grid-cols-2">
              <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">IP completo</dt><dd className="mt-1 break-all font-mono text-[#fecaca]">{selectedSecurityDetails.ipFull || "Indisponivel"}</dd></div>
              <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Horario exato</dt><dd className="mt-1">{selectedSecurityDetails.serverTimestamp || selectedSecurityEvent.timestamp}</dd></div>
              <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Path acessado</dt><dd className="mt-1 break-all">{selectedSecurityDetails.path || selectedSecurityEvent.pagePath || "-"}</dd></div>
              <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Metodo / host</dt><dd className="mt-1">{selectedSecurityDetails.method || "-"} / {selectedSecurityDetails.host || "Nao informado"}</dd></div>
              <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3 sm:col-span-2"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Motivo da suspeita</dt><dd className="mt-1 text-[#fca5a5]">{(selectedSecurityDetails.reasons || selectedSecurityEvent.suspiciousReasons || []).join(", ") || "Suspeito"}</dd></div>
              <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3 sm:col-span-2"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">User-agent completo</dt><dd className="mt-1 break-all font-mono text-xs">{selectedSecurityDetails.userAgentFull || "Desconhecido"}</dd></div>
              <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3 sm:col-span-2"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Referer</dt><dd className="mt-1 break-all">{selectedSecurityDetails.refererFull || "Nao informado"}</dd></div>
              <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3 sm:col-span-2"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Headers uteis</dt><dd className="mt-2 whitespace-pre-wrap break-all font-mono text-xs text-imesul-steel-light/68">{JSON.stringify(selectedSecurityDetails.headers || {}, null, 2)}</dd></div>
            </dl>
          </section>
        </div>
      ) : null}
      {selectedLocationEvent ? (() => {
        const ipCoordinates = getIpCoordinates(selectedLocationEvent);
        const deviceCoordinates = getDeviceCoordinates(selectedLocationEvent);
        const deviceStatus = selectedLocationEvent?.deviceLocationStatus || "";
        return (
          <div className="fixed inset-0 z-[230] flex items-center justify-center bg-[#020711]/82 px-4 backdrop-blur-md">
            <section className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[12px] border border-white/[0.12] bg-[linear-gradient(145deg,rgba(8,22,38,0.98),rgba(4,10,19,0.99))] p-5 shadow-[0_26px_90px_rgba(0,0,0,0.55)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-imesul-red">Localização do evento</p>
                  <h3 className="mt-2 font-display text-3xl text-white">{selectedLocationEvent.label || selectedLocationEvent.type}</h3>
                  <p className="mt-2 text-sm leading-6 text-imesul-steel-light/68">Horário: {formatDate(selectedLocationEvent.timestamp)} {formatTime(selectedLocationEvent.timestamp)}</p>
                </div>
                <button type="button" onClick={() => setSelectedLocationEvent(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.12] text-white hover:bg-white/[0.08]" aria-label="Fechar localização do evento">
                  <X size={17} aria-hidden="true" />
                </button>
              </div>

              <div className="mt-5 rounded-[8px] border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="font-condensed text-[12px] font-bold uppercase tracking-[0.14em] text-white/75">Localização por IP</p>
                <p className="mt-1.5 text-xs leading-5 text-imesul-steel-light/62">Localização aproximada baseada no endereço IP. Não representa endereço físico nem posição GPS exata.</p>
                <dl className="mt-4 grid gap-3 text-sm text-imesul-steel-light/76 sm:grid-cols-2">
                  <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">IP</dt><dd className="mt-1 break-all font-mono">{selectedLocationEvent.ipMasked || selectedLocationEvent.ip || "não identificado"}</dd></div>
                  <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3 sm:col-span-2"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Cidade / Estado / País</dt><dd className="mt-1">{getLocationLabel(selectedLocationEvent)}{selectedLocationEvent.location?.continent && selectedLocationEvent.location.continent !== "Desconhecido" ? ` — ${selectedLocationEvent.location.continent}` : ""}</dd></div>
                  <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Rede / Operadora</dt><dd className="mt-1">{getNetworkLabel(selectedLocationEvent)}</dd></div>
                  <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">ASN</dt><dd className="mt-1">{selectedLocationEvent.network?.asn || "Não identificado"}</dd></div>
                  {selectedLocationEvent.location?.timezone ? (
                    <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Fuso horário (aproximado)</dt><dd className="mt-1">{selectedLocationEvent.location.timezone}</dd></div>
                  ) : null}
                  {selectedLocationEvent.location?.postalCode ? (
                    <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">CEP aproximado</dt><dd className="mt-1">{selectedLocationEvent.location.postalCode}</dd></div>
                  ) : null}
                  {ipCoordinates ? (
                    <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3 sm:col-span-2"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Coordenadas aproximadas por IP</dt><dd className="mt-1 font-mono">{ipCoordinates.latitude}, {ipCoordinates.longitude}</dd><dd className="mt-1 text-xs text-imesul-steel-light/55">Sem precisão de GPS — não disponível para abrir no mapa.</dd></div>
                  ) : null}
                  <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3 sm:col-span-2"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Origem / dispositivo</dt><dd className="mt-1">{getDeviceLabel(selectedLocationEvent)}</dd></div>
                </dl>
              </div>

              <div className="mt-4 rounded-[8px] border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="font-condensed text-[12px] font-bold uppercase tracking-[0.14em] text-white/75">Localização do dispositivo</p>
                {deviceStatus === "granted" && deviceCoordinates ? (
                  <>
                    <p className="mt-1.5 text-xs leading-5 text-imesul-steel-light/62">Localização fornecida pelo dispositivo com autorização do visitante.</p>
                    <dl className="mt-4 grid gap-3 text-sm text-imesul-steel-light/76 sm:grid-cols-2">
                      <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Latitude</dt><dd className="mt-1 font-mono">{formatCoordinate(deviceCoordinates.latitude)}</dd></div>
                      <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Longitude</dt><dd className="mt-1 font-mono">{formatCoordinate(deviceCoordinates.longitude)}</dd></div>
                      <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Precisão estimada</dt><dd className="mt-1">{typeof selectedLocationEvent.deviceLocation?.accuracy === "number" ? `± ${Math.round(selectedLocationEvent.deviceLocation.accuracy)} m` : "Não informada"}</dd></div>
                      <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.035] p-3"><dt className="font-condensed text-[11px] uppercase tracking-[0.12em] text-white/60">Horário da captura</dt><dd className="mt-1">{selectedLocationEvent.deviceLocation?.capturedAt ? `${formatDate(selectedLocationEvent.deviceLocation.capturedAt)} ${formatTime(selectedLocationEvent.deviceLocation.capturedAt)}` : "-"}</dd></div>
                    </dl>
                    <a href={getMapUrl(deviceCoordinates)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-imesul-red/45 px-3 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-imesul-red transition-colors hover:bg-imesul-red/10">
                      <MapPin size={12} aria-hidden="true" /> Ver no mapa
                    </a>
                    <p className="mt-2 text-[11px] leading-4 text-imesul-steel-light/50">Precisão estimada informada pelo dispositivo do visitante.</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-imesul-steel-light/68">{getDeviceLocationStatusLabel(selectedLocationEvent)}</p>
                )}
              </div>
            </section>
          </div>
        );
      })() : null}
      {locationVisitorPicker ? (
        <div className="fixed inset-0 z-[235] flex items-center justify-center bg-[#020711]/82 px-4 backdrop-blur-md">
          <section className="w-full max-w-md rounded-[12px] border border-white/[0.12] bg-[linear-gradient(145deg,rgba(8,22,38,0.98),rgba(4,10,19,0.99))] p-5 shadow-[0_26px_90px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-imesul-red">{locationVisitorPicker.label}</p>
                <h3 className="mt-2 font-display text-2xl text-white">{locationVisitorPicker.visitorIds.length} visitantes</h3>
              </div>
              <button type="button" onClick={() => setLocationVisitorPicker(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.12] text-white hover:bg-white/[0.08]" aria-label="Fechar">
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <ul className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
              {locationVisitorPicker.visitorIds.map((visitorId) => {
                const visitor = visitors.find((item) => item.id === visitorId);
                if (!visitor) return null;
                return (
                  <li key={visitorId}>
                    <button
                      type="button"
                      onClick={() => openVisitorDetails(visitorId)}
                      className="flex w-full items-center justify-between gap-3 rounded-[8px] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:border-imesul-red/45 hover:bg-white/[0.06]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">{visitor.identity.name}</span>
                        <span className="block font-mono text-[11px] text-imesul-steel-light/55">{shortenVisitorId(visitor.id)}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-imesul-steel-light/55">{formatDate(visitor.lastActivity)} {formatTime(visitor.lastActivity)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : null}
      {selectedVisitorId ? (() => {
        const selectedVisitor = visitors.find((visitor) => visitor.id === selectedVisitorId);
        if (!selectedVisitor) return null;
        return (
          <VisitorDetailsPanel
            visitor={selectedVisitor}
            events={selectedVisitorEvents}
            onClose={() => setSelectedVisitorId(null)}
            onFilterVisitor={handleFilterVisitor}
          />
        );
      })() : null}
    </div>
  );
}
