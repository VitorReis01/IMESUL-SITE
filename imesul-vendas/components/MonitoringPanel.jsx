"use client";

import { Activity, AlertTriangle, Clock3, Database, Server, ShieldCheck } from "lucide-react";

const statusStyles = {
  online: "border-[#22c55e]/35 bg-[#22c55e]/10 text-[#86efac]",
  degraded: "border-[#f59e0b]/35 bg-[#f59e0b]/10 text-[#fcd34d]",
  offline: "border-[#ef4444]/35 bg-[#ef4444]/10 text-[#fca5a5]",
  disabled: "border-white/[0.14] bg-white/[0.055] text-imesul-steel-light/70",
  pending: "border-white/[0.14] bg-white/[0.035] text-imesul-steel-light/62",
};

const services = [
  { name: "Site Institucional", status: "pending", latency: "-", lastCheck: "-", lastFailure: "-" },
  { name: "Site de Vendas", status: "pending", latency: "-", lastCheck: "-", lastFailure: "-" },
  { name: "Banco de Dados", status: "pending", latency: "-", lastCheck: "-", lastFailure: "-" },
  { name: "APIs", status: "pending", latency: "-", lastCheck: "-", lastFailure: "-" },
  { name: "IMEbot", status: "disabled", latency: "-", lastCheck: "-", lastFailure: "-" },
];

const statusLabels = {
  online: "Online",
  degraded: "Degradado",
  offline: "Offline",
  disabled: "Desativado",
  pending: "Pendente",
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
  return (
    <div className="h-full overflow-y-auto bg-[linear-gradient(145deg,rgba(8,22,38,0.99),rgba(4,10,19,0.995))] px-5 py-5 sm:px-7">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 rounded-[10px] border border-white/[0.1] bg-white/[0.035] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-imesul-red">Monitoramento</p>
          <h3 className="mt-2 font-display text-4xl leading-none text-white">Saúde dos serviços</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-imesul-steel-light/68">
            Estrutura pronta para Better Stack e Sentry. Os dados reais ainda não estão conectados nesta homologação.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Section title="Status geral" icon={Activity}>
            <div className="grid gap-2">
              {services.map((service) => (
                <div key={service.name} className="flex items-center justify-between gap-3 rounded-[8px] border border-white/[0.08] bg-white/[0.025] px-3 py-2.5">
                  <span className="text-sm font-semibold text-white">{service.name}</span>
                  <StatusPill status={service.status} />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Indicadores" icon={Clock3}>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricBlock label="Uptime 30 dias" value="-" />
              <MetricBlock label="Latência média" value="-" />
              <MetricBlock label="Erros 24h" value="-" />
              <MetricBlock label="Incidentes abertos" value="-" />
            </div>
          </Section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <Section title="Serviços" icon={Server}>
            <div className="grid gap-2">
              {services.map((service) => (
                <div key={service.name} className="grid gap-3 rounded-[8px] border border-white/[0.08] bg-white/[0.025] p-3 text-sm text-imesul-steel-light/72 sm:grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_1fr] sm:items-center">
                  <div>
                    <p className="font-semibold text-white">{service.name}</p>
                  </div>
                  <StatusPill status={service.status} />
                  <span>Latência: {service.latency}</span>
                  <span>Última verificação: {service.lastCheck}</span>
                  <span>Última falha: {service.lastFailure}</span>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid gap-4">
            <Section title="Incidentes recentes" icon={AlertTriangle}>
              <div className="rounded-[8px] border border-dashed border-white/[0.14] bg-white/[0.02] p-4 text-sm leading-6 text-imesul-steel-light/66">
                Nenhum incidente real conectado ainda.
              </div>
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
                <StatusPill status="disabled" />
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
