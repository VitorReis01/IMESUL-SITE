"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { formatCnpj } from "../lib/cnpjValidation";

const reportEndpoint = "/api/admin/commercial-report";

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);

const formatPercent = (value) => `${Number(value) || 0}%`;

const flowLabels = {
  DIRECT_CONTACT: "Contato direto",
  GUIDED_QUOTE: "Orçamento guiado",
  CART: "Carrinho",
  WHATSAPP_IMEBOT: "WhatsApp",
};

const siteLabels = {
  vendas: "Site de vendas",
  institucional: "Site institucional",
  whatsapp: "WhatsApp",
};

const unitLabels = {
  "campo-grande": "Campo Grande",
  dourados: "Dourados",
};

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-[10px] border border-white/[0.1] bg-white/[0.035] p-4">
      <p className="font-condensed text-[11px] font-bold uppercase tracking-[0.12em] text-imesul-steel-light/60">{label}</p>
      <p className="mt-1.5 font-display text-3xl text-white">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-imesul-steel-light/55">{hint}</p> : null}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-6">
      <h3 className="font-condensed text-sm font-bold uppercase tracking-[0.14em] text-white">{title}</h3>
      <div className="mt-3 overflow-x-auto rounded-[10px] border border-white/[0.1] bg-white/[0.025]">{children}</div>
    </section>
  );
}

function Table({ columns, rows }) {
  return (
    <table className="min-w-[640px] w-full border-collapse text-left">
      <thead className="bg-white/[0.05]">
        <tr className="font-condensed text-[11px] uppercase tracking-[0.1em] text-imesul-steel-light/70">
          {columns.map((col) => <th key={col} className="px-4 py-2.5">{col}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.06]">
        {rows.length ? rows : (
          <tr>
            <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-imesul-steel-light/55">
              Sem dados ainda.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export default function CommercialReportPanel() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = () => {
    setLoading(true);
    setError("");

    fetch(reportEndpoint, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then((response) => response.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.message || "Falha ao carregar.");
        setReport(data.report);
      })
      .catch(() => setError("Não foi possível carregar o relatório comercial."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-[linear-gradient(145deg,rgba(8,22,38,0.98),rgba(4,10,19,0.99))] px-5 py-5 sm:px-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-imesul-red">Comercial</p>
          <h2 className="mt-1 font-display text-2xl text-white">Fabrício · Campo Grande</h2>
          <p className="mt-2 text-sm text-imesul-steel-light/60">
            Este relatório considera somente os registros comerciais atribuídos ao Fabrício.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-[7px] border border-white/[0.12] px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:border-white/25 hover:bg-white/[0.07] disabled:opacity-60"
        >
          <RefreshCw size={14} aria-hidden="true" className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-[8px] border border-imesul-red/40 bg-imesul-red/10 px-4 py-3 text-sm text-[#fecaca]">{error}</p>
      ) : null}

      {!report ? (
        <p className="mt-6 text-sm text-imesul-steel-light/60">{loading ? "Carregando..." : "Sem dados."}</p>
      ) : (
        <>
          <Section title="Resumo">
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total de contatos" value={report.general.total} />
              <StatCard label="Negociando" value={report.general.negociando} />
              <StatCard label="Vendidos" value={report.general.vendidos} />
              <StatCard label="Não vendidos" value={report.general.naoVendidos} />
              <StatCard label="Conversão" value={formatPercent(report.general.conversionRate)} />
              <StatCard label="Venda bruta" value={formatCurrency(report.general.grossSale)} />
              <StatCard label="Devoluções" value={formatCurrency(report.general.returnsTotal)} />
              <StatCard label="Venda líquida" value={formatCurrency(report.general.netSale)} hint={`Ticket líquido: ${formatCurrency(report.general.averageNetTicket)}`} />
            </div>
          </Section>

          <Section title="Vendedor">
            <Table
              columns={["Vendedor", "Unidade", "Recebidos", "Vendidos", "Não vendidos", "Negociando", "Conversão", "Venda líquida"]}
              rows={report.bySeller.map((seller) => (
                <tr key={seller.id} className="text-sm text-imesul-steel-light/80">
                  <td className="px-4 py-2.5 font-semibold text-white">{seller.name}</td>
                  <td className="px-4 py-2.5">{unitLabels[seller.unit] || "Sem unidade"}</td>
                  <td className="px-4 py-2.5">{seller.received}</td>
                  <td className="px-4 py-2.5">{seller.sold}</td>
                  <td className="px-4 py-2.5">{seller.notSold}</td>
                  <td className="px-4 py-2.5">{seller.negotiating}</td>
                  <td className="px-4 py-2.5">{formatPercent(seller.conversionRate)}</td>
                  <td className="px-4 py-2.5">{formatCurrency(seller.netSale)}</td>
                </tr>
              ))}
            />
          </Section>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Por fluxo">
              <Table
                columns={["Fluxo", "Total", "Vendidos", "Conversão"]}
                rows={report.byFlow.map((row) => (
                  <tr key={row.key} className="text-sm text-imesul-steel-light/80">
                    <td className="px-4 py-2.5 text-white">{flowLabels[row.key] || row.key}</td>
                    <td className="px-4 py-2.5">{row.total}</td>
                    <td className="px-4 py-2.5">{row.sold}</td>
                    <td className="px-4 py-2.5">{formatPercent(row.conversionRate)}</td>
                  </tr>
                ))}
              />
            </Section>

            <Section title="Por site">
              <Table
                columns={["Site", "Total", "Vendidos", "Conversão"]}
                rows={report.bySite.map((row) => (
                  <tr key={row.key} className="text-sm text-imesul-steel-light/80">
                    <td className="px-4 py-2.5 text-white">{siteLabels[row.key] || row.key}</td>
                    <td className="px-4 py-2.5">{row.total}</td>
                    <td className="px-4 py-2.5">{row.sold}</td>
                    <td className="px-4 py-2.5">{formatPercent(row.conversionRate)}</td>
                  </tr>
                ))}
              />
            </Section>

            <Section title="Por unidade">
              <Table
                columns={["Unidade", "Total", "Vendidos", "Conversão"]}
                rows={report.byUnit.map((row) => (
                  <tr key={row.key} className="text-sm text-imesul-steel-light/80">
                    <td className="px-4 py-2.5 text-white">{unitLabels[row.key] || "Sem unidade"}</td>
                    <td className="px-4 py-2.5">{row.total}</td>
                    <td className="px-4 py-2.5">{row.sold}</td>
                    <td className="px-4 py-2.5">{formatPercent(row.conversionRate)}</td>
                  </tr>
                ))}
              />
            </Section>
          </div>

          <Section title="Página / CTA">
            <Table
              columns={["Página/CTA", "Total", "Vendidos", "Conversão"]}
              rows={report.byPage.map((row) => (
                <tr key={row.key} className="text-sm text-imesul-steel-light/80">
                  <td className="px-4 py-2.5 text-white">{row.key}</td>
                  <td className="px-4 py-2.5">{row.total}</td>
                  <td className="px-4 py-2.5">{row.sold}</td>
                  <td className="px-4 py-2.5">{formatPercent(row.conversionRate)}</td>
                </tr>
              ))}
            />
          </Section>

          <Section title="Devoluções">
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Sem devolução" value={report.returns.noReturn} />
              <StatCard label="Devolução parcial" value={report.returns.partialReturn} />
              <StatCard label="Devolução total" value={report.returns.fullReturn} />
              <StatCard label="Taxa de devolução" value={formatPercent(report.returns.returnRate)} hint={`Total devolvido: ${formatCurrency(report.returns.totalReturnedValue)}`} />
            </div>
          </Section>

          <Section title="Empresas atendidas">
            <Table
              columns={["Empresa", "CNPJ", "Contatos", "Vendas", "Venda líquida"]}
              rows={report.byCompany.map((company) => (
                <tr key={company.buyerCnpj} className="text-sm text-imesul-steel-light/80">
                  <td className="px-4 py-2.5 font-semibold text-white">{company.buyerName || "(sem nome)"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{formatCnpj(company.buyerCnpj)}</td>
                  <td className="px-4 py-2.5">{company.contacts.join(", ")}</td>
                  <td className="px-4 py-2.5">{company.totalSales}</td>
                  <td className="px-4 py-2.5">{formatCurrency(company.netSale)}</td>
                </tr>
              ))}
            />
          </Section>
        </>
      )}
    </div>
  );
}
