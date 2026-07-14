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

// Inclui campos opcionais apenas quando o cliente informou algo relevante.
function optionalBlock(label, value) {
  const normalized = String(value ?? "").trim();
  return normalized ? `${label}:\n${normalized}` : "";
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
  return [
    "Olá, gostaria de solicitar um orçamento com os itens abaixo:",
    "Tipo de solicitação:\nProjeto",
    `Projeto:\n${project.name}`,
    `Subtipo:\n${subtype}`,
    `Materiais recomendados:\n${listOrFallback(materials)}`,
    `Porte estimado:\n${valueOrFallback(form.projectSize)}`,
    `Momento da compra:\n${valueOrFallback(form.urgency)}`,
    `Quantidade:\n${valueOrFallback(form.quantity)}`,
    `Cidade/UF:\n${valueOrFallback(form.city)} - ${valueOrFallback(form.state)}`,
    optionalBlock("Observações", form.notes),
    "Fico no aguardo da confirmação de medida, disponibilidade e valor.",
  ].filter(Boolean).join("\n\n");
}

// Monta a mensagem tecnica e inclui peso somente quando a linha selecionada o informa.
export function buildProductMessage({ category, product, form, selectedVariation }) {
  const weight = selectedVariation?.peso !== undefined
    ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(selectedVariation.peso)} ${selectedVariation.pesoUnidade}`
    : "Não informado";

  const details = optionalBlock("Características adicionais", form.details);
  const notes = optionalBlock("Observações", form.notes);
  const thickness = form.thickness || form.thickness === 0
    ? optionalBlock("Espessura", formatTechnicalValue(form.thickness, "thickness"))
    : "";

  return [
    "Olá, gostaria de solicitar um orçamento com os itens abaixo:",
    "Tipo de solicitação:\nMaterial",
    `Categoria:\n${category?.name || "Não informado"}`,
    `Produto:\n${product.name}`,
    `Medida:\n${formatTechnicalValue(form.measure, "measure")}`,
    thickness,
    details,
    `Peso informado no catálogo:\n${weight}`,
    `Quantidade:\n${valueOrFallback(form.quantity)}`,
    `Cidade/UF:\n${valueOrFallback(form.city)} - ${valueOrFallback(form.state)}`,
    notes,
    "Fico no aguardo da confirmação de medida, disponibilidade e valor.",
  ].filter(Boolean).join("\n\n");
}

// Limita a mensagem a 4.000 caracteres e codifica o texto para a URL do WhatsApp.
export function createWhatsAppUrl(message) {
  const phone = String(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || fallbackPhone).replace(/\D/g, "");
  const safeMessage = String(message ?? "").slice(0, 4000);
  return `https://wa.me/${phone || fallbackPhone}?text=${encodeURIComponent(safeMessage)}`;
}
