"use client";

import { useEffect, useMemo } from "react";
import { AlertCircle, Check, Scale } from "lucide-react";

const sameValue = (left, right) => String(left) === String(right);

// Formata valores tecnicos sem alterar a unidade armazenada no catalogo.
export function formatOptionValue(value, type) {
  if (value === "" || value === null || value === undefined) return "";
  if (type === "thickness" && typeof value === "number") {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)} mm`;
  }
  if (type === "length" && typeof value === "number") {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value / 1000)} m`;
  }
  return String(value);
}

// Mantem somente linhas compativeis com as escolhas ja feitas pelo cliente.
function filterVariations(variations, form, ignoredField) {
  return variations.filter((variation) =>
    ["measure", "thickness"].every((field) => {
      if (field === ignoredField || !form[field]) return true;
      const variationKey = {
        measure: "medida",
        thickness: "espessura",
      }[field];
      return variation[variationKey] === undefined || sameValue(variation[variationKey], form[field]);
    })
  );
}

// Calcula as proximas opcoes validas e impede combinacoes inexistentes na tabela.
export function getAvailableOptions(product, form) {
  const specifications = product.specifications;
  if (!specifications?.variacoes?.length) {
    return { measures: [], thicknesses: [] };
  }

  return {
    measures: specifications.medidas || [],
    thicknesses: [
      ...new Set(
        filterVariations(specifications.variacoes, form, "thickness")
          .map((variation) => variation.espessura)
        .filter((value) => value !== undefined)
      ),
    ],
  };
}

// Retorna a linha completa usada no resumo e no peso, quando todas as chaves conferem.
export function findSelectedVariation(product, form) {
  const variations = product.specifications?.variacoes || [];
  return variations.find((variation) =>
    [
      ["medida", form.measure],
      ["espessura", form.thickness],
    ].every(([key, selected]) =>
      variation[key] === undefined ? true : Boolean(selected) && sameValue(variation[key], selected)
    )
  );
}

// Renderiza chips acessiveis e omite grupos sem dados confiaveis.
function OptionGroup({ label, type, options, value, onSelect }) {
  if (!options.length) return null;

  return (
    <fieldset>
      <legend className="font-condensed text-[13px] font-semibold uppercase tracking-[0.13em] text-imesul-steel-light/85">
        {label}
      </legend>
      <div className="mt-3 flex max-h-52 flex-wrap gap-2 overflow-y-auto pr-1">
        {options.map((option) => {
          const isSelected = sameValue(option, value);
          return (
            <button
              key={`${type}-${option}`}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(option)}
              className={`min-h-11 rounded-[7px] border px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                isSelected
                  ? "border-imesul-red bg-imesul-red/[0.14] text-white shadow-[0_8px_24px_rgba(212,43,43,0.12)]"
                  : "border-white/[0.11] bg-white/[0.035] text-imesul-steel-light hover:border-imesul-red/45 hover:bg-white/[0.055] hover:text-white"
              }`}
            >
              <span>{formatOptionValue(option, type)}</span>
              {isSelected && <Check size={14} className="ml-2 inline text-imesul-red" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// Coordena medida e espessura conforme a tabela tecnica do produto.
export default function ProductOptionSelector({ product, form, setForm }) {
  const options = useMemo(() => getAvailableOptions(product, form), [product, form]);
  const selectedVariation = useMemo(
    () => findSelectedVariation(product, form),
    [product, form]
  );

  // Seleciona valores unicos e preserva escolhas que ainda continuam validas.
  useEffect(() => {
    const updates = {};
    if (!form.measure && options.measures.length === 1) updates.measure = options.measures[0];
    if (!form.thickness && options.thicknesses.length === 1) updates.thickness = options.thicknesses[0];
    if (Object.keys(updates).length) {
      setForm((current) => ({ ...current, ...updates }));
    }
  }, [form.measure, form.thickness, options, setForm]);

  // Uma nova medida invalida a espessura escolhida anteriormente.
  const selectMeasure = (measure) =>
    setForm((current) => ({ ...current, measure, thickness: "" }));
  const selectThickness = (thickness) =>
    setForm((current) => ({ ...current, thickness }));

  // Produtos sem tabela permanecem livres e deixam a confirmacao para o atendimento.
  if (!product.hasStructuredOptions) {
    return (
      <div className="space-y-6">
        <label className="block">
          <span className="mb-2.5 block font-condensed text-[13px] font-semibold uppercase tracking-[0.13em] text-imesul-steel-light/85">
            Características desejadas
          </span>
          <textarea
            value={form.details}
            maxLength={600}
            onChange={(event) =>
              setForm((current) => ({ ...current, details: event.target.value }))
            }
            placeholder="Informe as características desejadas."
            className="min-h-28 w-full resize-y rounded-[8px] border border-white/[0.12] bg-[#071828] px-4 py-4 text-[15px] leading-relaxed text-white outline-none transition focus:border-imesul-red/75 focus:ring-4 focus:ring-imesul-red/[0.08]"
          />
        </label>
        <div className="flex items-start gap-3 rounded-[7px] border border-[#e0a43b]/20 bg-[#e0a43b]/[0.07] p-4 text-sm leading-6 text-[#f0c776]">
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            {product.specifications?.observacao || "Produto sem tabela técnica completa no catálogo. A equipe comercial confirmará as características pelo WhatsApp."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <OptionGroup
        label="Medida"
        type="measure"
        options={options.measures}
        value={form.measure}
        onSelect={selectMeasure}
      />
      <OptionGroup
        label="Espessura"
        type="thickness"
        options={options.thicknesses}
        value={form.thickness}
        onSelect={selectThickness}
      />
      {product.specifications.observacoesTecnicas?.length > 0 && (
        <div className="rounded-[7px] border border-white/[0.09] bg-white/[0.025] p-4">
          <p className="font-mono text-[9px] tracking-[0.22em] text-imesul-red">
            DADOS DO PERFIL
          </p>
          <p className="mt-2 text-sm leading-6 text-imesul-steel-light/72">
            {product.specifications.observacoesTecnicas.join(" · ")}
          </p>
        </div>
      )}

      <div className="flex items-center gap-4 rounded-[8px] border border-imesul-red/25 bg-[linear-gradient(135deg,rgba(212,43,43,0.1),rgba(255,255,255,0.02))] p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[7px] bg-imesul-red/15 text-imesul-red">
          <Scale size={21} aria-hidden="true" />
        </span>
        <div>
          <p className="font-condensed text-xs font-semibold uppercase tracking-[0.14em] text-imesul-steel/68">
            Peso informado no catálogo
          </p>
          <p className="mt-1 text-lg font-semibold text-white">
            {selectedVariation?.peso !== undefined
              ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(selectedVariation.peso)} ${selectedVariation.pesoUnidade}`
              : "Escolha uma opção para continuar"}
          </p>
        </div>
      </div>
    </div>
  );
}
