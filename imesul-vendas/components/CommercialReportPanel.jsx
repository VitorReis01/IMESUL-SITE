"use client";

// Painel "Comercial" do admin (Lead ID, rodízio, IMEbot, carrinho - ver relatório desta fase).
// Componente autocontido: renderizado como uma camada sobre o painel de analytics existente
// (ver AdminDashboard.jsx), sem depender do estado interno dele. Usa a MESMA sessão admin
// (Bearer token em memória, ver lib/localAnalytics.js getAdminSessionToken).
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getAdminSessionToken } from "../lib/localAnalytics";
import { formatCnpj } from "../lib/cnpjValidation";

const reportEndpoint = "/api/admin/commercial-report";

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);

const formatPercent = (value) => `${Number(value) || 0}%`;

const flowLabels = {
  DIRECT_CONTACT: "Contato direto",
  GUIDED_QUOTE: "Orçamento guiado",
  CART: "Carrinho",
  WHATSAPP_IMEBOT: "WhatsApp IMEbot",
};
const siteLabels = { vendas: "Site de vendas", institucional: "Site institucional", whatsapp: "WhatsApp (IMEbot)" };
const unitLabels = { "campo-grande": "Campo Grande", dourados: "Dourados" };

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-[10px] border border-white/[0.1] bg-white/[0.035] p-4">
      <p className="font-condensed text-[11px] font-bold uppercase tracking-[0.12em] text-imesul-steel-light/60">{label}</p>
      <p className="mt-1.5 font-display text-3xl text-white">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-imesul-steel-light/55">{hint}</p>}
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
          {columns.map((col) => (
            <th key={col} className="px-4 py-2.5">{col}</th>
          ))}
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
      headers: getAdminSessionToken() ? { Authorization: `Bearer ${getAdminSessionToken()}` } : {},
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
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-imesul-red">Comercial</p>
          <h2 className="mt-1 font-display text-2xl text-white">Lead ID, rodízio e carrinho</h2>
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

      {error && (
        <p className="mt-4 rounded-[8px] border border-imesul-red/40 bg-imesul-red/10 px-4 py-3 text-sm text-[#fecaca]">{error}</p>
      )}

      {!report ? (
        <p className="mt-6 text-sm text-imesul-steel-light/60">{loading ? "Carregando..." : "Sem dados."}</p>
      ) : (
        <>
          <Section title="Geral">
            <div className="grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Total de leads" value={report.general.total} />
              <StatCard label="Negociando" value={report.general.negociando} />
              <StatCard label="Vendidos" value={report.general.vendidos} />
              <StatCard label="Não vendidos" value={report.general.naoVendidos} />
              <StatCard label="Conversão" value={formatPercent(report.general.conversionRate)} />
              <StatCard
                label="Venda líquida"
                value={formatCurrency(report.general.netSale)}
                hint={`Bruto: ${formatCurrency(report.general.grossSale)} · Devolvido: ${formatCurrency(report.general.returnsTotal)}`}
              />
            </div>
          </Section>

          <Section title="Por vendedor">
            <Table
              columns={["Vendedor", "Unidade", "Recebidos", "Vendidos", "Não vendidos", "Negociando", "Conversão", "Venda líquida", "Ticket líquido"]}
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
                  <td className="px-4 py-2.5">{formatCurrency(seller.averageNetTicket)}</td>
                </tr>
              ))}
            />
          </Section>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Por fluxo">
              <Table
                columns={["Fluxo", "Total", "Vendidos", "Conversão", "Venda líquida"]}
                rows={report.byFlow.map((row) => (
                  <tr key={row.key} className="text-sm text-imesul-steel-light/80">
                    <td className="px-4 py-2.5 text-white">{flowLabels[row.key] || row.key}</td>
                    <td className="px-4 py-2.5">{row.total}</td>
                    <td className="px-4 py-2.5">{row.sold}</td>
                    <td className="px-4 py-2.5">{formatPercent(row.conversionRate)}</td>
                    <td className="px-4 py-2.5">{formatCurrency(row.netSale)}</td>
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

          <Section title="Por página/CTA">
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

          <Section title="Por empresa (CNPJ)">
            <Table
              columns={["Empresa", "CNPJ", "Contatos", "Vendedores", "Vendas", "Venda líquida"]}
              rows={report.byCompany.map((company) => (
                <tr key={company.buyerCnpj} className="text-sm text-imesul-steel-light/80">
                  <td className="px-4 py-2.5 font-semibold text-white">{company.buyerName || "(sem nome)"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{formatCnpj(company.buyerCnpj)}</td>
                  <td className="px-4 py-2.5">{company.contacts.join(", ")}</td>
                  <td className="px-4 py-2.5">{company.sellers.join(", ")}</td>
                  <td className="px-4 py-2.5">{company.totalSales}</td>
                  <td className="px-4 py-2.5">{formatCurrency(company.netSale)}</td>
                </tr>
              ))}
            />
            <p className="px-4 pb-3 text-[11px] leading-5 text-imesul-steel-light/50">
              Agrupado sempre pelo CNPJ (nunca pelo texto do nome) - razões sociais digitadas de formas diferentes para o mesmo CNPJ aparecem juntas na mesma linha.
            </p>
          </Section>

          <Section title="Carrinho">
            <div className="grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Criados" value={report.cart.created} />
              <StatCard label="Ativos" value={report.cart.active} />
              <StatCard label="Abandonados" value={report.cart.abandoned} hint={`Limite: ${report.cart.abandonmentThresholdMinutes} min sem atividade`} />
              <StatCard label="Recuperados" value={report.cart.recovered} />
              <StatCard label="Convertidos" value={report.cart.converted} />
              <StatCard label="Taxa de abandono" value={formatPercent(report.cart.abandonmentRate)} hint={`Carrinho → venda: ${formatPercent(report.cart.cartToSaleConversionRate)}`} />
            </div>
            <p className="px-4 pb-2 text-[11px] leading-5 text-imesul-steel-light/50">
              Estes números só incluem visitantes que aceitaram analytics (ver banner de consentimento) - carrinhos de quem rejeitou continuam funcionando normalmente, mas não são rastreados aqui.
            </p>

            <div className="grid gap-4 border-t border-white/[0.08] p-4 sm:grid-cols-2">
              <div>
                <p className="font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-imesul-steel-light/60">Produtos mais adicionados</p>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm text-imesul-steel-light/80">
                  {report.cart.mostAddedProducts.length
                    ? report.cart.mostAddedProducts.map((product) => (
                        <li key={product.name} className="flex justify-between gap-3">
                          <span className="truncate text-white">{product.name}</span>
                          <span className="text-imesul-steel-light/60">{product.count}</span>
                        </li>
                      ))
                    : <li className="text-imesul-steel-light/50">Sem dados ainda.</li>}
                </ul>
              </div>
              <div>
                <p className="font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-imesul-steel-light/60">Produtos mais abandonados</p>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm text-imesul-steel-light/80">
                  {report.cart.mostAbandonedProducts.length
                    ? report.cart.mostAbandonedProducts.map((product) => (
                        <li key={product.name} className="flex justify-between gap-3">
                          <span className="truncate text-white">{product.name}</span>
                          <span className="text-imesul-steel-light/60">{product.count}</span>
                        </li>
                      ))
                    : <li className="text-imesul-steel-light/50">Sem dados ainda.</li>}
                </ul>
              </div>
            </div>
          </Section>

          <Section title="Handoff WhatsApp IMEbot">
            <div className="grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Handoffs oferecidos" value={report.handoff.offered} />
              <StatCard label="Clicaram" value={report.handoff.clicked} hint={`Taxa: ${formatPercent(report.handoff.clickRate)}`} />
              <StatCard label="Não clicaram" value={report.handoff.notClicked} />
              <StatCard label="Follow-ups" value={report.handoff.followupsSent} />
              <StatCard label="Confirmou atendido" value={report.handoff.confirmedAttended} />
              <StatCard label="Confirmou não atendido" value={report.handoff.confirmedNotAttended} />
              <StatCard label="Reofertas" value={report.handoff.reoffered} />
              <StatCard label="Sem resposta" value={report.handoff.unresponsive} />
              <StatCard label="Reatribuídos" value={report.handoff.sellerReassigned} />
              <StatCard label="Cliques totais" value={report.handoff.totalClicks} />
            </div>
          </Section>

          <Section title="Feedback de atendimento">
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Pesquisas iniciadas" value={report.feedback.HANDOFF_SERVICE.started} />
              <StatCard label="Respondidas" value={report.feedback.HANDOFF_SERVICE.completed} hint={`Taxa: ${formatPercent(report.feedback.HANDOFF_SERVICE.responseRate)}`} />
              <StatCard label="Nota média" value={report.feedback.HANDOFF_SERVICE.averageRating || "-"} />
              <StatCard label="Pós-venda respondido" value={report.feedback.POST_SALE.completed} hint={`Média: ${report.feedback.POST_SALE.averageRating || "-"}`} />
            </div>
          </Section>

          <Section title="Jobs de pós-venda">
            <Table
              columns={["Tipo", "Pendente", "Aguardando telefone", "Pendente template", "Concluído", "Cancelado", "Falhou"]}
              rows={Object.entries(report.feedbackJobs).map(([type, statuses]) => (
                <tr key={type} className="text-sm text-imesul-steel-light/80">
                  <td className="px-4 py-2.5 font-semibold text-white">{type === "POST_SALE" ? "Pós-venda" : "Checagem handoff"}</td>
                  <td className="px-4 py-2.5">{statuses.PENDING || 0}</td>
                  <td className="px-4 py-2.5">{statuses.WAITING_CUSTOMER_PHONE || 0}</td>
                  <td className="px-4 py-2.5">{statuses.PENDING_TEMPLATE || 0}</td>
                  <td className="px-4 py-2.5">{statuses.COMPLETED || 0}</td>
                  <td className="px-4 py-2.5">{statuses.CANCELLED || 0}</td>
                  <td className="px-4 py-2.5">{statuses.FAILED || 0}</td>
                </tr>
              ))}
            />
          </Section>
        </>
      )}
    </div>
  );
}
