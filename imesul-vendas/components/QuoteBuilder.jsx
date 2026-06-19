"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ClipboardList,
  MessageCircle,
  Ruler,
} from "lucide-react";
import { getMaterialsByIds } from "../data/materials";
import {
  buildMaterialMessage,
  buildProjectMessage,
  createWhatsAppUrl,
} from "../lib/whatsapp";

const projectInitialForm = {
  width: "",
  height: "",
  length: "",
  quantity: "",
  city: "",
  notes: "",
};

const materialInitialForm = {
  model: "",
  measure: "",
  quantity: "",
  city: "",
  notes: "",
};

const inputClassName =
  "h-14 w-full rounded-[8px] border border-white/[0.12] bg-white/[0.035] px-4 text-[15px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] outline-none transition-all duration-200 placeholder:text-imesul-steel/38 hover:border-white/[0.2] focus:border-imesul-red/75 focus:bg-white/[0.05] focus:ring-4 focus:ring-imesul-red/[0.08]";

const textareaClassName =
  "min-h-32 w-full resize-y rounded-[8px] border border-white/[0.12] bg-white/[0.035] px-4 py-4 text-[15px] leading-relaxed text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] outline-none transition-all duration-200 placeholder:text-imesul-steel/38 hover:border-white/[0.2] focus:border-imesul-red/75 focus:bg-white/[0.05] focus:ring-4 focus:ring-imesul-red/[0.08]";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2.5 block font-condensed text-[13px] font-semibold uppercase tracking-[0.13em] text-imesul-steel-light/85">
        {label}
      </span>
      {children}
    </label>
  );
}

function StepHeader({ eyebrow, title, description, steps, activeStep }) {
  return (
    <header className="max-w-5xl">
      <div className="flex items-center gap-4">
        <span className="font-mono text-[10px] tracking-[0.36em] text-imesul-red">
          {eyebrow}
        </span>
        <span className="h-px w-14 bg-imesul-red" />
      </div>
      <h2 className="mt-5 font-display text-[clamp(3rem,5vw,5.4rem)] leading-[0.92] text-white">
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
                isActive
                  ? "border-imesul-red text-white"
                  : "border-white/[0.08] text-imesul-steel/45"
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

function SummaryRow({ label, value }) {
  const hasValue = Boolean(value);

  return (
    <div
      className={`border-b py-3.5 transition-colors ${
        hasValue ? "border-white/[0.1]" : "border-white/[0.06]"
      }`}
    >
      <dt className="font-condensed text-[11px] font-semibold uppercase tracking-[0.15em] text-imesul-steel/65">
        {label}
      </dt>
      <dd
        className={`mt-1.5 text-[15px] leading-relaxed ${
          hasValue ? "font-medium text-white" : "text-imesul-steel/48"
        }`}
      >
        {value || "Não informado"}
      </dd>
    </div>
  );
}

function WhatsAppButton({ message }) {
  return (
    <a
      href={createWhatsAppUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative mt-8 flex min-h-[62px] w-full items-center justify-center gap-3 overflow-hidden rounded-[10px] border border-white/[0.12] bg-[#25D366] px-6 py-4 text-center shadow-[0_16px_48px_rgba(37,211,102,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#1ebe5d] hover:shadow-[0_20px_62px_rgba(37,211,102,0.38)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/25"
    >
      <MessageCircle size={19} strokeWidth={2} aria-hidden="true" />
      <span className="relative z-10 font-condensed text-sm font-bold uppercase tracking-[0.12em] text-white">
        Solicitar Cotação no WhatsApp
      </span>
      <ArrowRight
        size={17}
        className="transition-transform duration-300 group-hover:translate-x-1"
        aria-hidden="true"
      />
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
    </a>
  );
}

export function ProjectQuoteFlow({ project }) {
  const [subtype, setSubtype] = useState("");
  const [form, setForm] = useState(projectInitialForm);

  const recommendationNames = useMemo(() => {
    const catalogMaterials = getMaterialsByIds(project.materialIds).map(
      (material) => material.name
    );
    return [...catalogMaterials, ...project.complementaryMaterials];
  }, [project]);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const message = subtype
    ? buildProjectMessage({
        project,
        subtype,
        materials: recommendationNames,
        form,
      })
    : "";

  return (
    <section
      id="project-quote-flow"
      className="scroll-mt-6 overflow-hidden rounded-[8px] border border-white/[0.1] bg-[linear-gradient(145deg,rgba(12,30,51,0.96),rgba(6,16,29,0.98))] px-5 py-10 shadow-[0_26px_80px_rgba(0,0,0,0.24)] sm:px-8 sm:py-14 lg:px-10"
    >
      <StepHeader
        eyebrow="PRÉ-ORÇAMENTO GUIADO"
        title={`Vamos detalhar seu ${project.name}`}
        description="Escolha o subtipo e informe apenas o que souber. Nenhum campo de medida é obrigatório."
        steps={["Projeto", "Subtipo", "Informações", "Resumo"]}
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
                Informações básicas
              </h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-imesul-steel/70">
              Preencha somente os dados que já tiver.
            </p>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <Field label="Largura">
                <input
                  value={form.width}
                  onChange={updateField("width")}
                  inputMode="decimal"
                  placeholder="Ex.: 3,00 m"
                  className={inputClassName}
                />
              </Field>
              <Field label="Altura">
                <input
                  value={form.height}
                  onChange={updateField("height")}
                  inputMode="decimal"
                  placeholder="Ex.: 2,20 m"
                  className={inputClassName}
                />
              </Field>
              <Field label="Comprimento">
                <input
                  value={form.length}
                  onChange={updateField("length")}
                  inputMode="decimal"
                  placeholder="Ex.: 6,00 m"
                  className={inputClassName}
                />
              </Field>
              <Field label="Quantidade">
                <input
                  value={form.quantity}
                  onChange={updateField("quantity")}
                  inputMode="numeric"
                  placeholder="Ex.: 2 unidades"
                  className={inputClassName}
                />
              </Field>
              <Field label="Cidade">
                <input
                  value={form.city}
                  onChange={updateField("city")}
                  placeholder="Ex.: Campo Grande"
                  className={inputClassName}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Observações">
                  <textarea
                    value={form.notes}
                    onChange={updateField("notes")}
                    placeholder="Conte detalhes importantes do projeto."
                    className={textareaClassName}
                  />
                </Field>
              </div>
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
              <SummaryRow
                label="Materiais recomendados"
                value={recommendationNames.join(", ")}
              />
              <SummaryRow
                label="Medidas informadas"
                value={[
                  form.width && `Largura: ${form.width}`,
                  form.height && `Altura: ${form.height}`,
                  form.length && `Comprimento: ${form.length}`,
                ]
                  .filter(Boolean)
                  .join(" | ")}
              />
              <SummaryRow label="Quantidade" value={form.quantity} />
              <SummaryRow label="Cidade" value={form.city} />
              <SummaryRow label="Observações" value={form.notes} />
            </dl>

            <WhatsAppButton message={message} />
          </aside>
        </div>
      )}
    </section>
  );
}

export function MaterialQuoteFlow({ material }) {
  const [form, setForm] = useState(materialInitialForm);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const message = buildMaterialMessage({ material, form });

  return (
    <section
      id="material-quote-flow"
      className="scroll-mt-6 overflow-hidden rounded-[8px] border border-white/[0.1] bg-[linear-gradient(145deg,rgba(12,30,51,0.96),rgba(6,16,29,0.98))] px-5 py-10 shadow-[0_26px_80px_rgba(0,0,0,0.24)] sm:px-8 sm:py-14 lg:px-10"
    >
      <StepHeader
        eyebrow="PRÉ-ORÇAMENTO DIRETO"
        title={`Detalhes de ${material.name}`}
        description="Informe o modelo, medida e quantidade que procura. Você pode continuar mesmo sem preencher tudo."
        steps={["Material", "Informações", "Resumo"]}
        activeStep={2}
      />

      <div className="mt-12 grid gap-8 border-t border-white/[0.08] pt-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
        <div className="rounded-[8px] border border-white/[0.08] bg-black/[0.08] p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <Ruler size={18} className="text-imesul-red" aria-hidden="true" />
            <h3 className="font-condensed text-lg font-semibold uppercase tracking-[0.1em] text-white">
              Informações do material
            </h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-imesul-steel/70">
            Os campos são opcionais e serão confirmados pela equipe comercial.
          </p>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <Field label="Tipo/Modelo">
              <input
                value={form.model}
                onChange={updateField("model")}
                placeholder="Ex.: Tubo retangular"
                className={inputClassName}
              />
            </Field>
            <Field label="Medida">
              <input
                value={form.measure}
                onChange={updateField("measure")}
                placeholder="Ex.: 30 x 50 mm"
                className={inputClassName}
              />
            </Field>
            <Field label="Quantidade">
              <input
                value={form.quantity}
                onChange={updateField("quantity")}
                inputMode="numeric"
                placeholder="Ex.: 10 barras"
                className={inputClassName}
              />
            </Field>
            <Field label="Cidade">
              <input
                value={form.city}
                onChange={updateField("city")}
                placeholder="Ex.: Dourados"
                className={inputClassName}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Observações">
                <textarea
                  value={form.notes}
                  onChange={updateField("notes")}
                  placeholder="Inclua acabamento, aplicação ou outras informações."
                  className={textareaClassName}
                />
              </Field>
            </div>
          </div>
        </div>

        <aside className="relative overflow-hidden rounded-[8px] border border-imesul-red/25 bg-[linear-gradient(155deg,rgba(212,43,43,0.08),rgba(11,25,43,0.94)_34%)] px-6 py-7 shadow-[0_22px_60px_rgba(0,0,0,0.2)] sm:px-8 sm:py-8">
          <span className="absolute inset-y-0 left-0 w-1 bg-imesul-red" />
          <div className="flex items-center gap-3">
            <ClipboardList size={19} className="text-imesul-red" aria-hidden="true" />
            <h3 className="font-display text-4xl leading-none text-white">Resumo da Solicitação</h3>
          </div>

          <dl className="mt-6">
            <SummaryRow label="Tipo" value="Material" />
            <SummaryRow label="Material escolhido" value={material.name} />
            <SummaryRow
              label="Especificações"
              value={[
                form.model && `Tipo/Modelo: ${form.model}`,
                form.measure && `Medida: ${form.measure}`,
              ]
                .filter(Boolean)
                .join(" | ")}
            />
            <SummaryRow label="Quantidade" value={form.quantity} />
            <SummaryRow label="Cidade" value={form.city} />
            <SummaryRow label="Observações" value={form.notes} />
          </dl>

          <WhatsAppButton message={message} />
        </aside>
      </div>
    </section>
  );
}
