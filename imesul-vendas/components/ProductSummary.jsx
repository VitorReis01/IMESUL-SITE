// Resumo exibido antes do envio ao WhatsApp.
// Mostra somente os dados uteis para a equipe confirmar medida, estoque e valor.
import { ClipboardList } from "lucide-react";
import { formatOptionValue } from "./ProductOptionSelector";

// Padroniza linhas preenchidas e ausentes no painel de confirmacao.
function SummaryRow({ label, value }) {
  return (
    <div className="border-b border-white/[0.09] py-3 sm:py-3.5">
      <dt className="font-condensed text-[12px] font-semibold uppercase tracking-[0.1em] text-imesul-steel/65">
        {label}
      </dt>
      <dd className={`mt-1.5 text-[15px] leading-relaxed ${value ? "font-medium text-white" : "text-imesul-steel/48"}`}>
        {value || "Não informado"}
      </dd>
    </div>
  );
}

// Reune produto, opcoes tecnicas e localidade antes do envio.
export default function ProductSummary({ category, product, form, selectedVariation, hideTechnicalRows = false, children }) {
  const weight = selectedVariation?.peso !== undefined
    ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(selectedVariation.peso)} ${selectedVariation.pesoUnidade}`
    : "Não informado";

  return (
    <aside className="relative overflow-hidden rounded-[8px] border border-imesul-red/25 bg-[linear-gradient(155deg,rgba(212,43,43,0.08),rgba(11,25,43,0.96)_34%)] px-4 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.2)] sm:px-8 sm:py-8 lg:sticky lg:top-6 lg:self-start">
      <span className="absolute inset-y-0 left-0 w-1 bg-imesul-red" />
      <div className="flex items-center gap-3">
        <ClipboardList size={19} className="text-imesul-red" aria-hidden="true" />
        <h3 className="font-display text-[clamp(1.9rem,8vw,2.25rem)] leading-none text-white sm:text-4xl">Resumo do orçamento</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-imesul-steel-light/72 sm:mt-4">
        Você será direcionado ao WhatsApp para continuar o atendimento. A compra não é finalizada pelo site.
      </p>

      <dl className="mt-5 sm:mt-6">
        <SummaryRow label="Tipo de solicitação" value="Material" />
        <SummaryRow label="Categoria" value={category?.name} />
        <SummaryRow label="Produto" value={product.name} />
        {!hideTechnicalRows && (
          <>
            <SummaryRow label="Medida" value={formatOptionValue(form.measure, "measure")} />
            <SummaryRow label="Espessura" value={formatOptionValue(form.thickness, "thickness")} />
          </>
        )}
        {!hideTechnicalRows && !product.hasStructuredOptions && (
          <SummaryRow label="Características" value={form.details} />
        )}
        {!hideTechnicalRows && (
          <SummaryRow label="Peso informado no catálogo" value={weight} />
        )}
        <SummaryRow label="Quantidade" value={form.quantity} />
        <SummaryRow label="Cidade" value={form.city} />
        <SummaryRow label="Estado" value={form.state} />
        <SummaryRow label="Observações" value={form.notes} />
      </dl>

      {children}
    </aside>
  );
}
