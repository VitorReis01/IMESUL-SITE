"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Clock3, Database, RefreshCw, Server, ShieldCheck } from "lucide-react";

const statusStyles = {
  online: "border-[#22c55e]/35 bg-[#22c55e]/10 text-[#86efac]",
  degraded: "border-[#f59e0b]/35 bg-[#f59e0b]/10 text-[#fcd34d]",
  offline: "border-[#ef4444]/35 bg-[#ef4444]/10 text-[#fca5a5]",
  disabled: "border-white/[0.14] bg-white/[0.055] text-imesul-steel-light/70",
  checking: "border-[#38bdf8]/35 bg-[#38bdf8]/10 text-[#7dd3fc]",
  pending: "border-white/[0.14] bg-white/[0.035] text-imesul-steel-light/62",
};

const statusEndpoint = "/api/admin/monitoring/status";

const serviceOrder = ["institutional", "sales", "api", "database", "imebot"];

const fallbackServices = {
  institutional: { name: "Site Institucional", status: "checking", latencyMs: null, lastCheck: null, lastFailure: null },
  sales: { name: "Site de Vendas", status: "checking", latencyMs: null, lastCheck: null, lastFailure: null },
  api: { name: "API", status: "checking", latencyMs: null, lastCheck: null, lastFailure: null },
  database: { name: "Banco de Dados", status: "checking", latencyMs: null, lastCheck: null, lastFailure: null },
  imebot: { name: "IMEbot", status: "checking", latencyMs: null, lastCheck: null, lastFailure: null },
};

const statusLabels = {
  online: "Online",
  degraded: "Degradado",
  offline: "Offline",
  disabled: "Desativado",
  checking: "Verificando",
  pending: "Pendente",
  normal: "Normal",
  throttled: "Throttled",
  paused: "Paused",
};

const formatDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(value))
    : "-";

const formatLatency = (value) => (typeof value === "number" ? `${value} ms` : "-");

const getStatusSummary = (services) => {
  const list = serviceOrder.map((key) => services[key]).filter(Boolean);
  const offline = list.filter((service) => service.status === "offline").length;
  const degraded = list.filter((service) => service.status === "degraded").length;
  const checking = list.filter((service) => service.status === "checking").length;

  if (offline) return "offline";
  if (degraded) return "degraded";
  if (checking) return "checking";
  return "online";
};

const getAverageLatency = (services) => {
  const values = serviceOrder
    .map((key) => services[key]?.latencyMs)
    .filter((value) => typeof value === "number");
  if (!values.length) return "-";
  return `${Math.round(values.reduce((total, value) => total + value, 0) / values.length)} ms`;
};

function StatusPill({ status }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-full border px-2.5 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] ${statusStyles[status] || statusStyles.pending}`}>
      {statusLabels[status] || "Pendente"}
    </span>
  );
}

function MetricBlock({ label, value }) {
  return (
    <div className="rounded-[8px] border border-white/[0.09] bg-white/[0.035] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-imesul-steel-light/55">{label}</p>
      <strong className="mt-2 block font-display text-3xl leading-none text-white">{value}</strong>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <section className="rounded-[10px] border border-white/[0.1] bg-white/[0.025] p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-[7px] border border-imesul-red/35 bg-imesul-red/[0.1] text-imesul-red">
          <Icon size={16} aria-hidden="true" />
        </span>
        <h3 className="font-condensed text-[15px] font-bold uppercase tracking-[0.13em] text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function MonitoringPanel() {
  const [status, setStatus] = useState({
    checkedAt: null,
    services: fallbackServices,
    incidents: [],
    externalMonitoring: {
      connected: false,
      message: "Monitoramento externo ainda não conectado",
    },
    imebotProtection: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const services = useMemo(() => ({ ...fallbackServices, ...(status.services || {}) }), [status.services]);
  const servicesList = serviceOrder.map((key) => services[key]);
  const summaryStatus = getStatusSummary(services);
  const openIncidents = status.incidents?.length || 0;

  const refresh = useCallback(() => {
    setLoading(true);
    setError("");

    fetch(statusEndpoint, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then((response) => response.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.message || "Falha ao carregar monitoramento.");
        setStatus(data);
      })
      .catch(() => setError("Não foi possível atualizar o monitoramento."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const firstLoad = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(interval);
    };
  }, [refresh]);

  return (
    <div className="h-full overflow-y-auto bg-[linear-gradient(145deg,rgba(8,22,38,0.99),rgba(4,10,19,0.995))] px-5 py-5 sm:px-7">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-col gap-4 rounded-[10px] border border-white/[0.1] bg-white/[0.035] p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-imesul-red">Monitoramento</p>
            <h3 className="mt-2 font-display text-4xl leading-none text-white">Saúde dos serviços</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-imesul-steel-light/68">
              {status.externalMonitoring?.message || "Monitoramento externo ainda não conectado"}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex h-10 w-fit items-center gap-2 rounded-[7px] border border-white/[0.12] px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:border-white/25 hover:bg-white/[0.07] disabled:opacity-60"
          >
            <RefreshCw size={14} aria-hidden="true" className={loading ? "animate-spin" : ""} /> Atualizar agora
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-[8px] border border-imesul-red/40 bg-imesul-red/10 px-4 py-3 text-sm text-[#fecaca]">{error}</p>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Section title="Status geral" icon={Activity}>
            <div className="grid gap-2">
              {servicesList.map((service) => (
                <div key={service.name} className="flex items-center justify-between gap-3 rounded-[8px] border border-white/[0.08] bg-white/[0.025] px-3 py-2.5">
                  <span className="text-sm font-semibold text-white">{service.name}</span>
                  <StatusPill status={service.status} />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Indicadores" icon={Clock3}>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricBlock label="Status geral" value={statusLabels[summaryStatus]} />
              <MetricBlock label="Latência média" value={getAverageLatency(services)} />
              <MetricBlock label="Última verificação" value={formatDateTime(status.checkedAt)} />
              <MetricBlock label="Incidentes abertos" value={openIncidents} />
            </div>
          </Section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <Section title="Serviços" icon={Server}>
            <div className="grid gap-2">
              {servicesList.map((service) => (
                <div key={service.name} className="grid gap-3 rounded-[8px] border border-white/[0.08] bg-white/[0.025] p-3 text-sm text-imesul-steel-light/72 sm:grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_1fr] sm:items-center">
                  <div>
                    <p className="font-semibold text-white">{service.name}</p>
                  </div>
                  <StatusPill status={service.status} />
                  <span>Latência: {formatLatency(service.latencyMs)}</span>
                  <span>Última verificação: {formatDateTime(service.lastCheck)}</span>
                  <span>Última falha: {service.lastFailure || "-"}</span>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid gap-4">
            <Section title="Incidentes recentes" icon={AlertTriangle}>
              {status.incidents?.length ? (
                <div className="grid gap-2">
                  {status.incidents.map((incident) => (
                    <div key={`${incident.service}-${incident.checkedAt}`} className="rounded-[8px] border border-white/[0.08] bg-white/[0.025] p-3 text-sm text-imesul-steel-light/72">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-white">{incident.label}</strong>
                        <StatusPill status={incident.status} />
                      </div>
                      <p className="mt-2">{incident.message}</p>
                      <p className="mt-1 text-xs text-imesul-steel-light/50">{formatDateTime(incident.checkedAt)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[8px] border border-dashed border-white/[0.14] bg-white/[0.02] p-4 text-sm leading-6 text-imesul-steel-light/66">
                  Nenhum incidente ativo nas verificações internas.
                </div>
              )}
            </Section>

            <Section title="Segurança" icon={ShieldCheck}>
              <div className="grid gap-2 text-sm text-imesul-steel-light/70">
                <div className="flex justify-between rounded-[8px] border border-white/[0.08] bg-white/[0.025] px-3 py-2"><span>Tentativas bloqueadas</span><strong className="text-white">-</strong></div>
                <div className="flex justify-between rounded-[8px] border border-white/[0.08] bg-white/[0.025] px-3 py-2"><span>Rate limit</span><strong className="text-white">-</strong></div>
                <div className="flex justify-between rounded-[8px] border border-white/[0.08] bg-white/[0.025] px-3 py-2"><span>Alertas recentes</span><strong className="text-white">-</strong></div>
              </div>
            </Section>

            <Section title="IMEbot" icon={Database}>
              <div className="flex items-center justify-between gap-3 rounded-[8px] border border-white/[0.08] bg-white/[0.025] px-3 py-2.5">
                <span className="text-sm font-semibold text-white">IMEbot</span>
                <StatusPill status={services.imebot.status} />
              </div>
              <div className="mt-3 grid gap-2 text-sm text-imesul-steel-light/70">
                <div className="flex justify-between rounded-[8px] border border-white/[0.08] bg-white/[0.025] px-3 py-2">
                  <span>Proteção de custo</span>
                  <strong className="text-white">{statusLabels[status.imebotProtection?.status] || "-"}</strong>
                </div>
                <div className="flex justify-between rounded-[8px] border border-white/[0.08] bg-white/[0.025] px-3 py-2">
                  <span>Modo</span>
                  <strong className="text-white">{status.imebotProtection?.mode === "volume_quota" ? "Quota por volume" : "-"}</strong>
                </div>
                <div className="flex justify-between rounded-[8px] border border-white/[0.08] bg-white/[0.025] px-3 py-2">
                  <span>Budget financeiro</span>
                  <strong className="text-white">{status.imebotProtection?.config?.costModelConfigured ? "Configurado" : "Pendente"}</strong>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
