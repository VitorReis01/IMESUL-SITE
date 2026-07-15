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
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Busca", value: "search" },
  { label: "Cliques", value: "click" },
  { label: "Login", value: "login" },
  { label: "Suspeitos", value: "suspicious" },
];

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
  const [selectedSecurityEvent, setSelectedSecurityEvent] = useState(null);

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

  const analytics = useMemo(() => {
    const lastEvent = events.at(-1);
    const visitEvents = events.filter((event) => event.type === "visit");
    const uniqueVisitors = new Set(events.map((event) => event.visitorId).filter(Boolean)).size;
    const totalAccesses = visitEvents.length;
    const repeatedAccesses = Math.max(totalAccesses - uniqueVisitors, 0);
    const visitors = groupVisitors(events);

    return {
      metrics: {
        uniqueVisitors,
        totalAccesses,
        repeatedAccesses,
        suspiciousVisitors: visitors.filter((visitor) => visitor.securityStatus === "Suspeito").length,
        clicks: countMetric(events, "clicks"),
        whatsapp: countMetric(events, "whatsapp"),
        searches: countMetric(events, "searches"),
        logins: countMetric(events, "logins"),
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
      buttonRanking: buildButtonRanking(events),
      visitorRanking: buildVisitorRanking(events),
      locationRanking: buildLocationRanking(visitors),
    };
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (activeFilter === "all") return events;
    if (activeFilter === "suspicious") return events.filter((event) => getSecurityStatus(event) === "Suspeito");
    return events.filter((event) => event.type === activeFilter);
  }, [activeFilter, events]);

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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <SummaryCard icon={Users} label="Visitantes únicos" value={metrics.uniqueVisitors} comparison={comparisons.uniqueVisitors} />
            <SummaryCard icon={BarChart3} label="Total de acessos" value={metrics.totalAccesses} />
            <SummaryCard icon={BarChart3} label="Acessos repetidos" value={metrics.repeatedAccesses} />
            <SummaryCard icon={MousePointerClick} label="Cliques em botões" value={metrics.clicks} comparison={comparisons.clicks} />
            <SummaryCard icon={MessageCircle} label="Cliques WhatsApp" value={metrics.whatsapp} comparison={comparisons.whatsapp} />
            <SummaryCard icon={Search} label="Pesquisas" value={metrics.searches} comparison={comparisons.searches} />
            <SummaryCard icon={UserCheck} label="Logins/cadastros" value={metrics.logins} comparison={comparisons.logins} />
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

          <div className="mt-6 flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button key={filter.value} type="button" onClick={() => setActiveFilter(filter.value)} className={`rounded-full border px-4 py-2 font-condensed text-[12px] font-bold uppercase tracking-[0.12em] transition-colors ${activeFilter === filter.value ? "border-imesul-red bg-imesul-red text-white" : "border-white/[0.12] bg-white/[0.035] text-imesul-steel-light/72 hover:border-white/[0.22] hover:text-white"}`}>
                {filter.label}
              </button>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-[10px] border border-white/[0.1]">
            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full border-collapse text-left">
                <thead className="bg-white/[0.055]"><tr className="font-condensed text-[12px] uppercase tracking-[0.12em] text-imesul-steel-light/72"><th className="px-4 py-3">Data</th><th className="px-4 py-3">Hora</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Página/seção</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Detalhe</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">IP mascarado</th><th className="px-4 py-3">Visitor ID</th><th className="px-4 py-3">Telefone</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Logado?</th></tr></thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {filteredEvents.length ? filteredEvents.slice().reverse().map((event) => {
                    const identity = getClientIdentity(event);
                    return (
                      <tr key={event.id} className="text-sm text-imesul-steel-light/74"><td className="px-4 py-3">{formatDate(event.timestamp)}</td><td className="px-4 py-3">{formatTime(event.timestamp)}</td><td className="px-4 py-3 font-semibold text-white">{event.type}</td><td className="px-4 py-3">{event.section || "-"}</td><td className="px-4 py-3">{event.label || "-"}</td><td className="px-4 py-3">{event.detail || "-"}</td><td className="px-4 py-3">{buildTrafficLabel(event)}</td><td className="px-4 py-3">{event.ipMasked || event.ip || "não identificado"}</td><td className="px-4 py-3">{event.visitorId || "-"}</td><td className="px-4 py-3">{identity.phone}</td><td className="px-4 py-3">{identity.name}</td><td className="px-4 py-3">{event.isLoggedIn ? "Sim" : "Não"}</td></tr>
                    );
                  }) : <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-imesul-steel-light/62">Ainda não há eventos para este filtro.</td></tr>}
                </tbody>
              </table>
            </div>
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
    </div>
  );
}
