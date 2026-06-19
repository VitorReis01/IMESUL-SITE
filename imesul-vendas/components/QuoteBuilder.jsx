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
  "h-12 w-full rounded-[6px] border border-white/[0.1] bg-[#07101d]/80 px-4 text-sm text-white outline-none transition-colors placeholder:text-imesul-steel/40 focus:border-imesul-red/70";

const textareaClassName =
  "min-h-28 w-full resize-y rounded-[6px] border border-white/[0.1] bg-[#07101d]/80 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-imesul-steel/40 focus:border-imesul-red/70";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block font-condensed text-xs font-semibold uppercase tracking-[0.14em] text-imesul-steel-light/70">
        {label}
      </span>
      {children}
    </label>
  );
}

function StepHeader({ eyebrow, title, description, steps, activeStep }) {
  return (
    <header>
      <div className="flex items-center gap-4">
        <span className="font-mono text-[10px] tracking-[0.36em] text-imesul-red">
          {eyebrow}
        </span>
        <span className="h-px w-14 bg-imesul-red" />
      </div>
      <h2 className="mt-5 font-display text-[clamp(2.8rem,5vw,5rem)] leading-[0.94] text-white">
        {title}
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-imesul-steel-light/70 sm:text-base">
        {description}
      </p>

      <ol className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((step, index) => {
          const isActive = index <= activeStep;
          return (
            <li
              key={step}
              className={`flex min-h-11 items-center gap-3 border-b px-1 py-2 font-condensed text-xs font-semibold uppercase tracking-[0.12em] ${
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
  return (
    <div className="border-b border-white/[0.08] py-3">
      <dt className="font-condensed text-[11px] font-semibold uppercase tracking-[0.14em] text-imesul-steel/60">
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-relaxed text-white">
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
      className="group mt-7 flex min-h-[52px] w-full items-center justify-center gap-3 rounded-[10px] bg-[#25D366] px-6 py-4 text-center shadow-[0_12px_38px_rgba(37,211,102,0.2)] transition-all duration-300 hover:bg-[#1ebe5d] hover:shadow-[0_16px_46px_rgba(37,211,102,0.3)]"
    >
      <MessageCircle size={19} strokeWidth={2} aria-hidden="true" />
      <span className="font-condensed text-sm font-bold uppercase tracking-[0.12em] text-white">
        Solicitar Cotação no WhatsApp
      </span>
      <ArrowRight
        size={17}
        className="transition-transform duration-300 group-hover:translate-x-1"
        aria-hidden="true"
      />
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
      className="scroll-mt-6 border-y border-white/[0.08] bg-[#081321]/82 px-5 py-12 sm:px-8 sm:py-14 lg:px-10"
    >
      <StepHeader
        eyebrow="PRÉ-ORÇAMENTO GUIADO"
        title={`Vamos detalhar seu ${project.name}`}
        description="Escolha o subtipo e informe apenas o que souber. Nenhum campo de medida é obrigatório."
        steps={["Projeto", "Subtipo", "Informações", "Resumo"]}
        activeStep={subtype ? 3 : 1}
      />

      <div className="mt-10">
        <p className="font-condensed text-sm font-semibold uppercase tracking-[0.14em] text-white">
          Qual é o subtipo do projeto?
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {project.subtypes.map((option) => {
            const isSelected = subtype === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSubtype(option)}
                className={`flex min-h-14 items-center justify-between rounded-[6px] border px-4 py-3 text-left font-condensed text-sm font-semibold transition-all duration-300 ${
                  isSelected
                    ? "border-imesul-red bg-imesul-red/[0.1] text-white"
                    : "border-white/[0.1] bg-white/[0.025] text-imesul-steel-light hover:border-imesul-red/45 hover:text-white"
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
        <div className="mt-12 grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="flex items-center gap-3">
              <Ruler size={18} className="text-imesul-red" aria-hidden="true" />
              <h3 className="font-condensed text-lg font-semibold uppercase tracking-[0.1em] text-white">
                Informações básicas
              </h3>
            </div>
            <p className="mt-2 text-sm text-imesul-steel/65">
              Preencha somente os dados que já tiver.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
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

          <aside className="border-l border-imesul-red/35 bg-[#0B192B]/75 px-6 py-7 sm:px-8">
            <div className="flex items-center gap-3">
              <ClipboardList size={19} className="text-imesul-red" aria-hidden="true" />
              <h3 className="font-display text-3xl text-white">Resumo da Solicitação</h3>
            </div>

            <dl className="mt-5">
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
      className="scroll-mt-6 border-y border-white/[0.08] bg-[#081321]/82 px-5 py-12 sm:px-8 sm:py-14 lg:px-10"
    >
      <StepHeader
        eyebrow="PRÉ-ORÇAMENTO DIRETO"
        title={`Detalhes de ${material.name}`}
        description="Informe o modelo, medida e quantidade que procura. Você pode continuar mesmo sem preencher tudo."
        steps={["Material", "Informações", "Resumo"]}
        activeStep={2}
      />

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="flex items-center gap-3">
            <Ruler size={18} className="text-imesul-red" aria-hidden="true" />
            <h3 className="font-condensed text-lg font-semibold uppercase tracking-[0.1em] text-white">
              Informações do material
            </h3>
          </div>
          <p className="mt-2 text-sm text-imesul-steel/65">
            Os campos são opcionais e serão confirmados pela equipe comercial.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
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

        <aside className="border-l border-imesul-red/35 bg-[#0B192B]/75 px-6 py-7 sm:px-8">
          <div className="flex items-center gap-3">
            <ClipboardList size={19} className="text-imesul-red" aria-hidden="true" />
            <h3 className="font-display text-3xl text-white">Resumo da Solicitação</h3>
          </div>

          <dl className="mt-5">
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
