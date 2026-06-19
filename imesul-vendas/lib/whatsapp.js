const fallbackPhone = "556733125600";

function valueOrFallback(value) {
  return value?.trim() || "Não informado";
}

function listOrFallback(values) {
  return values.length ? values.map((value) => `- ${value}`).join("\n") : "A definir";
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

export function buildMaterialMessage({ material, form }) {
  return `Olá, vim pelo site da IMESUL.

Material:
${material.name}

Tipo/Modelo:
${valueOrFallback(form.model)}

Medida:
${valueOrFallback(form.measure)}

Quantidade:
${valueOrFallback(form.quantity)}

Cidade:
${valueOrFallback(form.city)}

Observações:
${valueOrFallback(form.notes)}

Gostaria de solicitar uma cotação.`;
}

export function createWhatsAppUrl(message) {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || fallbackPhone;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
