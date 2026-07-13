"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, ClipboardList, MessageCircle, Ruler } from "lucide-react";
import { getMaterialsByIds } from "../data/materials";
import { getCatalogCategory } from "../data/catalogCategories";
import {
  brazilianStates,
  citiesByState,
  msCities,
  projectSizeOptions,
  projectUrgencyOptions,
  quantityOptions,
} from "../data/quoteOptions";
import { buildProductMessage, buildProjectMessage, createWhatsAppUrl } from "../lib/whatsapp";
import { trackLocalEvent } from "../lib/localAnalytics";
import ProductOptionSelector, { findSelectedVariation } from "./ProductOptionSelector";
import ProductSummary from "./ProductSummary";

// Campos do caminho por projeto; medidas tecnicas sao confirmadas pela equipe comercial.
const projectInitialForm = {
  projectSize: "",
  urgency: "",
  quantity: "",
  city: "",
  state: "MS",
  notes: "",
};

// Campos compartilhados pelo produto estruturado e pelo produto sob consulta.
const materialInitialForm = {
  measure: "",
  thickness: "",
  details: "",
  quantity: "",
  city: "",
  state: "",
  notes: "",
};

const selectClassName =
  "h-14 w-full rounded-[8px] border border-white/[0.12] bg-[#071828] px-4 text-[15px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] outline-none transition-all duration-200 hover:border-white/[0.2] focus:border-imesul-red/75 focus:bg-[#0a1d30] focus:ring-4 focus:ring-imesul-red/[0.08]";

const textareaClassName =
  "min-h-28 w-full resize-y rounded-[8px] border border-white/[0.12] bg-[#071828] px-4 py-4 text-[15px] leading-relaxed text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] outline-none transition-all duration-200 placeholder:text-imesul-steel/38 hover:border-white/[0.2] focus:border-imesul-red/75 focus:bg-[#0a1d30] focus:ring-4 focus:ring-imesul-red/[0.08]";

// Mantem labels e indicacao de obrigatoriedade iguais em todos os controles.
function Field({ label, children, required = false }) {
  return (
    <label className="block">
      <span className="mb-2.5 block font-condensed text-[13px] font-semibold uppercase tracking-[0.13em] text-imesul-steel-light/85">
        {label}{required && <span className="text-imesul-red"> *</span>}
      </span>
      {children}
    </label>
  );
}

// Aceita opcoes simples ou pares de valor e rotulo usados por cidade e estado.
function SelectField({ label, value, onChange, options, placeholder, required = false, disabled = false }) {
  return (
    <Field label={label} required={required}>
      <select
        value={value}
        onChange={onChange}
        className={`${selectClassName} disabled:cursor-not-allowed disabled:opacity-55`}
        required={required}
        disabled={disabled}
      >
        <option value="" className="bg-[#071828] text-white">{placeholder}</option>
        {options.map((option) => {
          const optionValue = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;
          return (
            <option key={optionValue} value={optionValue} className="bg-[#071828] text-white">
              {optionLabel}
            </option>
          );
        })}
      </select>
    </Field>
  );
}

// Exibe escolhas curtas como botoes e informa o estado selecionado por ARIA.
function ChoiceGroup({ label, options, value, onSelect }) {
  return (
    <fieldset>
      <legend className="font-condensed text-[13px] font-semibold uppercase tracking-[0.13em] text-imesul-steel-light/85">
        {label}
      </legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const isSelected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(option)}
              className={`flex min-h-12 items-center justify-between rounded-[8px] border px-4 py-3 text-left font-condensed text-[14px] font-semibold transition-all duration-200 ${
                isSelected
                  ? "border-imesul-red bg-imesul-red/[0.14] text-white shadow-[0_8px_24px_rgba(212,43,43,0.12)]"
                  : "border-white/[0.1] bg-white/[0.035] text-imesul-steel-light hover:border-imesul-red/45 hover:bg-white/[0.055] hover:text-white"
              }`}
            >
              {option}
              {isSelected && <Check size={15} className="text-imesul-red" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// Situa o cliente no fluxo sem criar navegacao independente entre as etapas.
function StepHeader({ eyebrow, title, description, steps, activeStep }) {
  return (
    <header className="max-w-5xl">
      <div className="flex items-center gap-4">
        <span className="font-mono text-[10px] tracking-[0.34em] text-imesul-red">{eyebrow}</span>
        <span className="h-px w-14 bg-imesul-red" />
      </div>
      <h2 className="mt-5 font-display text-5xl leading-[0.94] text-white sm:text-6xl lg:text-7xl">
        {title}
      </h2>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-imesul-steel-light/75">
        {description}
      </p>

      <ol className="mt-9 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {steps.map((step, index) => {
          const isActive = index <= activeStep;
          return (
            <li
              key={step}
              className={`flex min-h-12 items-center gap-3 border-b-2 px-1 py-2 font-condensed text-xs font-semibold uppercase tracking-[0.12em] ${
                isActive ? "border-imesul-red text-white" : "border-white/[0.08] text-imesul-steel/45"
              }`}
            >
              <span className={isActive ? "text-imesul-red" : "text-imesul-steel/35"}>
                {String(index + 1).padStart(2, "0")}
              </span>
              {step}
            </li>
          );
        })}
      </ol>
    </header>
  );
}

// Mostra um fallback consistente para campos opcionais ainda nao preenchidos.
function SummaryRow({ label, value }) {
  return (
    <div className="border-b border-white/[0.09] py-3.5">
      <dt className="font-condensed text-[11px] font-semibold uppercase tracking-[0.15em] text-imesul-steel/65">
        {label}
      </dt>
      <dd className={`mt-1.5 text-[15px] leading-relaxed ${value ? "font-medium text-white" : "text-imesul-steel/48"}`}>
        {value || "Não informado"}
      </dd>
    </div>
  );
}

// Gera o link somente quando as regras minimas do fluxo foram atendidas.
function WhatsAppButton({ message, disabledReason = "", trackingDetail = "", isLoggedIn = false }) {
  const disabled = Boolean(disabledReason);

  return (
    <div className="mt-8">
      <a
        href={disabled ? undefined : createWhatsAppUrl(message)}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={disabled}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }

          trackLocalEvent({
            type: "whatsapp",
            label: "Solicitar cotação no WhatsApp",
            section: "Resumo da solicitação",
            detail: trackingDetail,
            isLoggedIn,
          });
        }}
        className={`group relative flex min-h-[62px] w-full items-center justify-center gap-3 overflow-hidden rounded-[10px] border px-5 py-4 text-center transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 sm:px-6 ${
          disabled
            ? "cursor-not-allowed border-white/[0.08] bg-white/[0.06] text-imesul-steel/55"
            : "border-white/[0.12] bg-[#25D366] text-white shadow-[0_16px_48px_rgba(37,211,102,0.28)] hover:-translate-y-0.5 hover:bg-[#1ebe5d] hover:shadow-[0_20px_62px_rgba(37,211,102,0.38)] focus-visible:ring-[#25D366]/25"
        }`}
      >
        <MessageCircle size={19} strokeWidth={2} aria-hidden="true" />
        <span className="relative z-10 font-condensed text-sm font-bold uppercase tracking-[0.1em] text-white">
          Solicitar Cotação no WhatsApp
        </span>
        <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
        {!disabled && <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />}
      </a>
      {disabledReason && (
        <p className="mt-3 text-sm leading-6 text-[#f0c776]">{disabledReason}</p>
      )}
    </div>
  );
}

// Quantidade e localidade sao os unicos dados obrigatorios nos dois caminhos.
const isLocationReady = (form) => Boolean(form.quantity && form.city && form.state);

// Monta o pre-orcamento a partir do projeto, subtipo e materiais recomendados.
export function ProjectQuoteFlow({ project, isLoggedIn = false }) {
  const [subtype, setSubtype] = useState("");
  const [form, setForm] = useState(projectInitialForm);

  // Evita recalcular os nomes enquanto o cliente altera somente o formulario.
  const recommendationNames = useMemo(() => {
    const catalogMaterials = getMaterialsByIds(project.materialIds).map((material) => material.name);
    return [...catalogMaterials, ...project.complementaryMaterials];
  }, [project]);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  // A mensagem acompanha o resumo e so existe depois da escolha do subtipo.
  const message = subtype
    ? buildProjectMessage({ project, subtype, materials: recommendationNames, form })
    : "";
  const disabledReason = !subtype
    ? "Selecione o subtipo do projeto."
    : !isLocationReady(form)
      ? "Selecione quantidade, cidade e estado para gerar a mensagem."
      : "";

  return (
    <section
      id="project-quote-flow"
      className="scroll-mt-6 overflow-hidden rounded-[8px] border border-white/[0.1] bg-[linear-gradient(145deg,rgba(12,30,51,0.96),rgba(6,16,29,0.98))] px-5 py-10 shadow-[0_26px_80px_rgba(0,0,0,0.24)] sm:px-8 sm:py-14 lg:px-10"
    >
      <StepHeader
        eyebrow="PRÉ-ORÇAMENTO GUIADO"
        title={`Vamos detalhar seu ${project.name}`}
        description="Escolha as opções principais para a equipe comercial validar medidas, estoque e preço pelo WhatsApp."
        steps={["Projeto", "Subtipo", "Seleções", "Resumo"]}
        activeStep={subtype ? 3 : 1}
      />

      <div className="mt-10 border-t border-white/[0.08] pt-8">
        <p className="font-condensed text-sm font-semibold uppercase tracking-[0.15em] text-white">
          Qual é o subtipo do projeto?
        </p>
        <div className="mt-4 grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {project.subtypes.map((option) => {
            const isSelected = subtype === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSubtype(option)}
                className={`flex min-h-16 h-full items-center justify-between rounded-[8px] border px-4 py-3 text-left font-condensed text-[15px] font-semibold transition-all duration-300 ${
                  isSelected
                    ? "border-imesul-red bg-imesul-red/[0.13] text-white shadow-[0_10px_30px_rgba(212,43,43,0.1)]"
                    : "border-white/[0.1] bg-white/[0.025] text-imesul-steel-light hover:-translate-y-0.5 hover:border-imesul-red/45 hover:bg-white/[0.045] hover:text-white"
                }`}
              >
                {option}
                {isSelected && <Check size={16} className="text-imesul-red" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      {subtype && (
        <div className="mt-12 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
          <div className="rounded-[8px] border border-white/[0.08] bg-black/[0.08] p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <Ruler size={18} className="text-imesul-red" aria-hidden="true" />
              <h3 className="font-condensed text-lg font-semibold uppercase tracking-[0.1em] text-white">
                Seleções básicas
              </h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-imesul-steel/70">
              Não é necessário digitar medidas. A equipe IMESUL confirma as dimensões técnicas no atendimento.
            </p>

            <div className="mt-7 space-y-7">
              <ChoiceGroup
                label="Porte estimado"
                options={projectSizeOptions}
                value={form.projectSize}
                onSelect={(projectSize) => setForm((current) => ({ ...current, projectSize }))}
              />
              <ChoiceGroup
                label="Momento da compra"
                options={projectUrgencyOptions}
                value={form.urgency}
                onSelect={(urgency) => setForm((current) => ({ ...current, urgency }))}
              />
              <div className="grid gap-5 sm:grid-cols-3">
                <SelectField label="Quantidade" value={form.quantity} onChange={updateField("quantity")} options={quantityOptions} placeholder="Selecione" required />
                <SelectField label="Cidade" value={form.city} onChange={updateField("city")} options={msCities} placeholder="Selecione" required />
                <SelectField label="Estado" value={form.state} onChange={updateField("state")} options={brazilianStates} placeholder="Selecione" required />
              </div>
              <Field label="Observações">
                <textarea
                  value={form.notes}
                  onChange={updateField("notes")}
                  maxLength={600}
                  placeholder="Conte detalhes importantes do projeto."
                  className={textareaClassName}
                />
              </Field>
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-[8px] border border-imesul-red/25 bg-[linear-gradient(155deg,rgba(212,43,43,0.08),rgba(11,25,43,0.94)_34%)] px-6 py-7 shadow-[0_22px_60px_rgba(0,0,0,0.2)] sm:px-8 sm:py-8">
            <span className="absolute inset-y-0 left-0 w-1 bg-imesul-red" />
            <div className="flex items-center gap-3">
              <ClipboardList size={19} className="text-imesul-red" aria-hidden="true" />
              <h3 className="font-display text-4xl leading-none text-white">Resumo da Solicitação</h3>
            </div>
            <dl className="mt-6">
              <SummaryRow label="Tipo" value="Projeto" />
              <SummaryRow label="Projeto selecionado" value={project.name} />
              <SummaryRow label="Subtipo selecionado" value={subtype} />
              <SummaryRow label="Materiais recomendados" value={recommendationNames.join(", ")} />
              <SummaryRow label="Porte estimado" value={form.projectSize} />
              <SummaryRow label="Momento da compra" value={form.urgency} />
              <SummaryRow label="Quantidade" value={form.quantity} />
              <SummaryRow label="Cidade" value={form.city} />
              <SummaryRow label="Estado" value={form.state} />
              <SummaryRow label="Observações" value={form.notes} />
            </dl>
            <WhatsAppButton
              message={message}
              disabledReason={disabledReason}
              trackingDetail={`Projeto: ${project.name}`}
              isLoggedIn={isLoggedIn}
            />
          </aside>
        </div>
      )}
    </section>
  );
}

// Monta o fluxo direto e valida combinacoes tecnicas antes de abrir o WhatsApp.
export function MaterialQuoteFlow({ product, isLoggedIn = false }) {
  const [form, setForm] = useState(materialInitialForm);
  const category = getCatalogCategory(product.categoryId);
  const cityOptions = form.state ? citiesByState[form.state] || ["Outra"] : [];
  // A variacao exata fornece peso e confirma que a combinacao existe no catalogo.
  const selectedVariation = findSelectedVariation(product, form);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };
  const updateState = (event) => {
    const state = event.target.value;
    setForm((current) => ({ ...current, state, city: "" }));
  };

  const message = buildProductMessage({
    category,
    product,
    form,
    selectedVariation,
  });
  // Produtos estruturados exigem combinacao valida; os demais aceitam detalhes livres.
  const disabledReason = product.hasStructuredOptions && !selectedVariation
    ? "Selecione uma combinação válida do catálogo."
    : !isLocationReady(form)
        ? "Selecione quantidade, cidade e estado para gerar a mensagem."
        : "";

  return (
    <section
      id="material-quote-flow"
      className="scroll-mt-6 overflow-visible rounded-[8px] border border-white/[0.1] bg-[linear-gradient(145deg,rgba(12,30,51,0.98),rgba(6,16,29,0.99))] px-5 py-10 shadow-[0_26px_80px_rgba(0,0,0,0.24)] sm:px-8 sm:py-14 lg:px-10"
    >
      <StepHeader
        eyebrow="SELEÇÃO TÉCNICA"
        title={product.name}
        description={product.hasStructuredOptions
          ? "Escolha somente combinações publicadas no catálogo oficial da IMESUL."
          : "Este item não possui tabela técnica completa no catálogo. Informe as características desejadas e a equipe comercial confirma os detalhes."}
        steps={["Categoria", "Produto", "Opções", "Resumo"]}
        activeStep={3}
      />

      <div className="mt-12 grid gap-8 border-t border-white/[0.08] pt-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
        <div className="rounded-[8px] border border-white/[0.08] bg-black/[0.08] p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <Ruler size={18} className="text-imesul-red" aria-hidden="true" />
            <h3 className="font-condensed text-lg font-semibold uppercase tracking-[0.1em] text-white">
              Opções do catálogo
            </h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-imesul-steel/70">
            {product.hasStructuredOptions
              ? `Dados extraídos da página ${product.specifications.paginaFonte} do catálogo 2024.`
              : "Seleção guiada com base no cadastro comercial do produto."}
          </p>

          <div className="mt-8">
            <ProductOptionSelector product={product} form={form} setForm={setForm} />
          </div>

          <div className="mt-9 grid gap-5 border-t border-white/[0.08] pt-8 sm:grid-cols-3">
            <SelectField label="Quantidade" value={form.quantity} onChange={updateField("quantity")} options={quantityOptions} placeholder="Selecione" required />
            <SelectField label="Estado" value={form.state} onChange={updateState} options={brazilianStates} placeholder="Selecione" required />
            <SelectField label="Cidade" value={form.city} onChange={updateField("city")} options={cityOptions} placeholder={form.state ? "Selecione" : "Selecione o estado"} required disabled={!form.state} />
          </div>
          <div className="mt-5">
            <Field label="Observações">
              <textarea
                value={form.notes}
                onChange={updateField("notes")}
                maxLength={600}
                placeholder="Inclua acabamento, aplicação ou outras informações."
                className={textareaClassName}
              />
            </Field>
          </div>
        </div>

        <ProductSummary
          category={category}
          product={product}
          form={form}
          selectedVariation={selectedVariation}
        >
          <WhatsAppButton
            message={message}
            disabledReason={disabledReason}
            trackingDetail={`Material: ${product.name}`}
            isLoggedIn={isLoggedIn}
          />
        </ProductSummary>
      </div>
    </section>
  );
}
