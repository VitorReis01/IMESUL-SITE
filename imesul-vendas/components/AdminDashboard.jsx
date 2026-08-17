"use client";

// Painel administrativo do analytics local.
// Consulta as APIs protegidas e mostra eventos, visitantes e detalhes de seguranca.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Download,
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
} from "lucide-react";
import { clearLocalEvents, getAnalyticsEvents, getLocalEvents, subscribeToLocalEvents } from "../lib/localAnalytics";

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

const isWithinPeriod = (event, period) => {
  if (period === "all") return true;

  const eventDate = new Date(event.timestamp);
  if (Number.isNaN(eventDate.getTime())) return false;

  const now = new Date();
  if (period === "today") {
    const cutoff = new Date(now);
    cutoff.setHours(0, 0, 0, 0);
    return eventDate >= cutoff;
  }

  const days = period === "7d" ? 7 : 30;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return eventDate >= cutoff;
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

const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const getPreviousMonthKey = (date) => {
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return getMonthKey(previous);
};

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

const countMetric = (events, metric) => {
  if (metric === "uniqueVisitors") {
    return new Set(events.map((event) => event.visitorId).filter(Boolean)).size;
  }

  if (metric === "clicks") return events.filter((event) => trackedClickTypes.has(event.type)).length;
  if (metric === "whatsapp") return events.filter((event) => event.type === "whatsapp").length;
  if (metric === "searches") return events.filter((event) => event.type === "search").length;
  if (metric === "logins") {
    return events.filter((event) => event.type === "login" && !String(event.label).toLowerCase().includes("erro")).length;
  }
  return 0;
};

const getComparison = (events, metric) => {
  const now = new Date();
  const currentMonth = getMonthKey(now);
  const previousMonth = getPreviousMonthKey(now);
  const current = countMetric(events.filter((event) => getMonthKey(new Date(event.timestamp)) === currentMonth), metric);
  const previous = countMetric(events.filter((event) => getMonthKey(new Date(event.timestamp)) === previousMonth), metric);

  if (!previous) return { current, previous, label: "Sem dados anteriores", trend: "none" };

  const percent = Math.round(((current - previous) / previous) * 100);
  return {
    current,
    previous,
    label: `${percent > 0 ? "+" : ""}${percent}% vs. mês anterior`,
    trend: percent > 0 ? "up" : percent < 0 ? "down" : "flat",
  };
};

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
    const current = ranking.get(key) || { label: key, total: 0, whatsapp: 0, suspicious: 0 };
    current.total += 1;
    current.whatsapp += visitor.whatsapp > 0 ? 1 : 0;
    current.suspicious += visitor.securityStatus === "Suspeito" ? 1 : 0;
    ranking.set(key, current);
  });

  return [...ranking.values()].sort((left, right) => right.total - left.total).slice(0, 8);
};

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

// Mostra eventos do backend local no painel administrativo e usa localStorage como fallback.
export default function AdminDashboard({ open, onClose, onLogout }) {
  const [events, setEvents] = useState(() => getLocalEvents());
  const [activeFilter, setActiveFilter] = useState("all");
  const [activePeriod, setActivePeriod] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSecurityEvent, setSelectedSecurityEvent] = useState(null);
  const [selectedLocationEvent, setSelectedLocationEvent] = useState(null);

  // Atualiza o painel com dados da API sem perder o fallback local em desenvolvimento.
  const refreshEvents = useCallback(() => {
    getAnalyticsEvents()
      .then(setEvents)
      .catch(() => setEvents(getLocalEvents()));
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const timer = window.setTimeout(refreshEvents, 0);
    const unsubscribe = subscribeToLocalEvents(refreshEvents);

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [open, refreshEvents]);

  // Período filtra os cards de resumo e a lista principal de eventos; a comparação "vs. mês
  // anterior" continua olhando para todo o histórico (são eixos de análise diferentes).
  const periodEvents = useMemo(
    () => (activePeriod === "all" ? events : events.filter((event) => isWithinPeriod(event, activePeriod))),
    [events, activePeriod],
  );

  const analytics = useMemo(() => {
    const lastEvent = periodEvents.at(-1);
    const visitEvents = periodEvents.filter((event) => event.type === "visit");
    const uniqueVisitors = new Set(periodEvents.map((event) => event.visitorId).filter(Boolean)).size;
    const totalAccesses = visitEvents.length;
    const repeatedAccesses = Math.max(totalAccesses - uniqueVisitors, 0);
    const visitors = groupVisitors(periodEvents);

    return {
      metrics: {
        uniqueVisitors,
        totalAccesses,
        repeatedAccesses,
        suspiciousVisitors: visitors.filter((visitor) => visitor.securityStatus === "Suspeito").length,
        clicks: countMetric(periodEvents, "clicks"),
        whatsapp: countMetric(periodEvents, "whatsapp"),
        searches: countMetric(periodEvents, "searches"),
        logins: countMetric(periodEvents, "logins"),
        lastActivity: lastEvent ? `${formatDate(lastEvent.timestamp)} ${formatTime(lastEvent.timestamp)}` : "Sem registro",
      },
      comparisons: {
        uniqueVisitors: getComparison(events, "uniqueVisitors"),
        clicks: getComparison(events, "clicks"),
        whatsapp: getComparison(events, "whatsapp"),
        searches: getComparison(events, "searches"),
        logins: getComparison(events, "logins"),
      },
      visitors,
      buttonRanking: buildButtonRanking(periodEvents),
      visitorRanking: buildVisitorRanking(periodEvents),
      locationRanking: buildLocationRanking(visitors),
    };
  }, [periodEvents, events]);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return periodEvents.filter((event) => {
      if (activeFilter === "suspicious" && getSecurityStatus(event) !== "Suspeito") return false;
      if (activeFilter === "hasDeviceLocation" && event.deviceLocationStatus !== "granted") return false;
      if (!["all", "suspicious", "hasDeviceLocation"].includes(activeFilter) && event.type !== activeFilter) return false;

      if (!query) return true;

      const identity = getClientIdentity(event);
      const haystack = [
        event.visitorId,
        identity.phone,
        identity.email,
        identity.name,
        event.pagePath || event.path,
        event.ipMasked || event.ip,
        event.location?.city,
        event.location?.region,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [activeFilter, periodEvents, searchQuery]);

  // Volta para a primeira pagina sempre que o filtro, o periodo ou a busca mudam, para nunca
  // deixar o admin numa pagina vazia. Ajuste de estado durante a renderizacao (nao em effect):
  // React garante que isso substitui o render atual sem chegar a pintar a tela intermediaria.
  const filterSignature = `${activeFilter}|${activePeriod}|${searchQuery}|${pageSize}`;
  const [lastFilterSignature, setLastFilterSignature] = useState(filterSignature);
  if (filterSignature !== lastFilterSignature) {
    setLastFilterSignature(filterSignature);
    setCurrentPage(1);
  }

  const paginatedEvents = useMemo(() => {
    const reversed = filteredEvents.slice().reverse();
    const totalPages = Math.max(Math.ceil(reversed.length / pageSize), 1);
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * pageSize;

    return { items: reversed.slice(start, start + pageSize), totalPages, safePage, total: reversed.length };
  }, [filteredEvents, pageSize, currentPage]);

  const suspiciousEvents = useMemo(
    () => events.filter((event) => getSecurityStatus(event) === "Suspeito"),
    [events],
  );

  const exportEventsAsJson = () => {
    // Exporta apenas a visao comum; detalhes sensiveis ficam restritos ao modal de seguranca.
    const sanitizedEvents = events.map(({ securityDetails, ...event }) => event);
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
    const { metrics, comparisons, visitors, buttonRanking, visitorRanking, locationRanking } = analytics;
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
            ${buildTableRows(events.slice().reverse()) || '<tr><td colspan="11">Nenhum evento registrado.</td></tr>'}
          </tbody></table>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  };

  if (!open) return null;

  const { metrics, comparisons, visitors, buttonRanking, visitorRanking, locationRanking } = analytics;
  const selectedSecurityDetails = getSecurityDetails(selectedSecurityEvent || {});

  return (
    <div className="fixed inset-0 z-[210] bg-[#030811]/88 px-4 py-5 backdrop-blur-lg">
      <section className="mx-auto flex max-h-[94vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-[12px] border border-white/[0.12] bg-[linear-gradient(145deg,rgba(8,22,38,0.98),rgba(4,10,19,0.99))] shadow-[0_30px_120px_rgba(0,0,0,0.6)]">
        <header className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-imesul-red">Área restrita</p>
            <h2 className="mt-2 font-display text-4xl leading-none text-white sm:text-5xl">Painel Administrativo IMESUL</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-imesul-steel-light/68">
              Este painel registra eventos para análise de uso do site. IPs são mascarados e não são armazenados CPF, senha ou tokens. Para produção, use política de privacidade e consentimento conforme LGPD.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={printReport} className="inline-flex h-10 items-center gap-2 rounded-[7px] border border-white/[0.12] px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.11em] text-white transition-colors hover:border-white/25 hover:bg-white/[0.07]">
              <Printer size={15} aria-hidden="true" /> Gerar PDF
            </button>
            <button type="button" onClick={exportEventsAsJson} className="inline-flex h-10 items-center gap-2 rounded-[7px] border border-white/[0.12] px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.11em] text-white transition-colors hover:border-white/25 hover:bg-white/[0.07]">
              <Download size={15} aria-hidden="true" /> Exportar dados
            </button>
            <button type="button" onClick={async () => { await clearLocalEvents(); setEvents([]); }} className="inline-flex h-10 items-center gap-2 rounded-[7px] border border-white/[0.12] px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.11em] text-white transition-colors hover:border-imesul-red/55 hover:bg-imesul-red/[0.12]">
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

        <div className="overflow-y-auto px-5 py-5 sm:px-7">
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
                    <tr key={item.label} className="text-sm text-imesul-steel-light/74"><td className="px-4 py-3 font-semibold text-white">{item.label}</td><td className="px-4 py-3">{item.total}</td><td className="px-4 py-3">{item.whatsapp}</td><td className="px-4 py-3">{item.suspicious}</td></tr>
                  )) : <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-imesul-steel-light/62">Sem localizacao registrada.</td></tr>}
                </tbody>
              </table>
            </MiniTable>

            <MiniTable title="Sessoes e seguranca">
              <table className="min-w-[760px] w-full border-collapse text-left">
                <thead className="bg-white/[0.055]"><tr className="font-condensed text-[12px] uppercase tracking-[0.12em] text-imesul-steel-light/72"><th className="px-4 py-3">Visitante</th><th className="px-4 py-3">Dispositivo</th><th className="px-4 py-3">Tempo</th><th className="px-4 py-3">Paginas</th><th className="px-4 py-3">Seguranca</th></tr></thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {visitors.length ? visitors.map((visitor) => (
                    <tr key={`session-${visitor.id}`} className="text-sm text-imesul-steel-light/74"><td className="px-4 py-3 font-semibold text-white">{visitor.identity.name}</td><td className="px-4 py-3">{visitor.device}</td><td className="px-4 py-3">{visitor.duration}</td><td className="px-4 py-3">{visitor.pages.join(", ") || "-"}</td><td className={`px-4 py-3 font-semibold ${visitor.securityStatus === "Suspeito" ? "text-[#f87171]" : "text-[#25D366]"}`}>{visitor.securityStatus}{visitor.suspiciousReasons.length ? `: ${visitor.suspiciousReasons.join(", ")}` : ""}</td></tr>
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
                  {paginatedEvents.items.length ? paginatedEvents.items.map((event) => {
                    const identity = getClientIdentity(event);
                    return (
                      <tr key={event.id} className="text-sm text-imesul-steel-light/74"><td className="px-4 py-3">{formatDate(event.timestamp)}</td><td className="px-4 py-3">{formatTime(event.timestamp)}</td><td className="px-4 py-3 font-semibold text-white">{event.type}</td><td className="px-4 py-3">{event.section || "-"}</td><td className="px-4 py-3">{event.label || "-"}</td><td className="px-4 py-3">{event.detail || "-"}</td><td className="px-4 py-3">{buildTrafficLabel(event)}</td><td className="px-4 py-3">{event.ipMasked || event.ip || "não identificado"}</td><td className="px-4 py-3">{event.visitorId || "-"}</td><td className="px-4 py-3">{identity.phone}</td><td className="px-4 py-3">{identity.name}</td><td className="px-4 py-3">{event.isLoggedIn ? "Sim" : "Não"}</td><td className="px-4 py-3"><button type="button" onClick={() => setSelectedLocationEvent(event)} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] px-3 py-1 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-imesul-steel-light/78 transition-colors hover:border-imesul-red/55 hover:text-white"><MapPin size={12} aria-hidden="true" /> Ver</button></td></tr>
                    );
                  }) : <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-imesul-steel-light/62">Ainda não há eventos para este filtro.</td></tr>}
                </tbody>
              </table>
            </div>
            {paginatedEvents.total > pageSizeOptions[0] ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-imesul-steel-light/62">
                  <span>{paginatedEvents.total} eventos</span>
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
                  <button type="button" disabled={paginatedEvents.safePage <= 1} onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))} className="rounded-full border border-white/[0.12] px-3 py-1 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-imesul-steel-light/72 transition-colors hover:border-white/[0.25] hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                    Anterior
                  </button>
                  <span className="text-xs text-imesul-steel-light/62">Página {paginatedEvents.safePage} de {paginatedEvents.totalPages}</span>
                  <button type="button" disabled={paginatedEvents.safePage >= paginatedEvents.totalPages} onClick={() => setCurrentPage((page) => Math.min(page + 1, paginatedEvents.totalPages))} className="rounded-full border border-white/[0.12] px-3 py-1 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-imesul-steel-light/72 transition-colors hover:border-white/[0.25] hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                    Próxima
                  </button>
                </div>
              </div>
            ) : null}
          </div>
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
    </div>
  );
}
