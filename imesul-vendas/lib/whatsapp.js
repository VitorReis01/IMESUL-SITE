const fallbackPhone = "556733125600";

function valueOrFallback(value) {
  if (value === 0) return "0";
  return String(value ?? "").trim() || "Não informado";
}

function listOrFallback(values) {
  return values.length ? values.map((value) => `- ${value}`).join("\n") : "A definir";
}

function formatTechnicalValue(value, type) {
  if (value === "" || value === null || value === undefined) return "Não informado";
  if (type === "thickness" && typeof value === "number") {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)} mm`;
  }
  if (type === "length" && typeof value === "number") {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value / 1000)} m`;
  }
  return String(value);
}

export function buildProjectMessage({ project, subtype, materials, form }) {
  return `Olá, vim pelo site da IMESUL.

Projeto:
${project.name}

Subtipo:
${subtype}

Materiais recomendados:
${listOrFallback(materials)}

Medidas:
Largura: ${valueOrFallback(form.width)}
Altura: ${valueOrFallback(form.height)}
Comprimento: ${valueOrFallback(form.length)}

Quantidade:
${valueOrFallback(form.quantity)}

Cidade:
${valueOrFallback(form.city)}

Observações:
${valueOrFallback(form.notes)}

Gostaria de solicitar uma cotação.`;
}

export function buildProductMessage({ category, product, form, selectedVariation }) {
  const weight = selectedVariation?.peso !== undefined
    ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(selectedVariation.peso)} ${selectedVariation.pesoUnidade}`
    : "Não informado";

  return `Olá, vim pelo site da IMESUL.

Gostaria de solicitar uma cotação.

Tipo de solicitação:
Material

Categoria:
${category?.name || "Não informado"}

Produto:
${product.name}

Medida:
${formatTechnicalValue(form.measure, "measure")}

Espessura:
${formatTechnicalValue(form.thickness, "thickness")}

Comprimento:
${formatTechnicalValue(form.length, "length")}

Características adicionais:
${valueOrFallback(form.details)}

Peso informado no catálogo:
${weight}

Quantidade:
${valueOrFallback(form.quantity)}

Cidade:
${valueOrFallback(form.city)}

Observações:
${valueOrFallback(form.notes)}

Aguardo retorno.`;
}

export function createWhatsAppUrl(message) {
  const phone = String(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || fallbackPhone).replace(/\D/g, "");
  const safeMessage = String(message ?? "").slice(0, 4000);
  return `https://wa.me/${phone || fallbackPhone}?text=${encodeURIComponent(safeMessage)}`;
}
