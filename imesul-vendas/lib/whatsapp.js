// Garante um destino comercial valido quando a variavel publica nao foi configurada.
const fallbackPhone = "556733125600";

// Normaliza campos opcionais antes de inseri-los na mensagem.
function valueOrFallback(value) {
  if (value === 0) return "0";
  return String(value ?? "").trim() || "Não informado";
}

// Converte materiais recomendados em uma lista legivel pelo vendedor.
function listOrFallback(values) {
  return values.length ? values.map((value) => `- ${value}`).join("\n") : "A definir";
}

// Aplica unidade apenas na exibicao; os dados continuam no formato do catalogo.
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

// Monta a mensagem do caminho por projeto na mesma ordem apresentada no resumo.
export function buildProjectMessage({ project, subtype, materials, form }) {
  return `Olá, vim pelo site da IMESUL.

Projeto:
${project.name}

Subtipo:
${subtype}

Materiais recomendados:
${listOrFallback(materials)}

Porte estimado:
${valueOrFallback(form.projectSize)}

Momento da compra:
${valueOrFallback(form.urgency)}

Quantidade:
${valueOrFallback(form.quantity)}

Cidade/UF:
${valueOrFallback(form.city)} - ${valueOrFallback(form.state)}

Observações:
${valueOrFallback(form.notes)}

Gostaria de solicitar uma cotação.`;
}

// Monta a mensagem tecnica e inclui peso somente quando a linha selecionada o informa.
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

Características adicionais:
${valueOrFallback(form.details)}

Peso informado no catálogo:
${weight}

Quantidade:
${valueOrFallback(form.quantity)}

Cidade/UF:
${valueOrFallback(form.city)} - ${valueOrFallback(form.state)}

Observações:
${valueOrFallback(form.notes)}

Aguardo retorno.`;
}

// Limita a mensagem a 4.000 caracteres e codifica o texto para a URL do WhatsApp.
export function createWhatsAppUrl(message) {
  const phone = String(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || fallbackPhone).replace(/\D/g, "");
  const safeMessage = String(message ?? "").slice(0, 4000);
  return `https://wa.me/${phone || fallbackPhone}?text=${encodeURIComponent(safeMessage)}`;
}
