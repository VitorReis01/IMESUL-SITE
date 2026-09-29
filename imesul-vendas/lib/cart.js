"use client";

// Carrinho GLOBAL do site de vendas. Armazenamento NECESSARIO no navegador (funciona mesmo se o
// visitante rejeitar analytics - ver lib/consent.js, que so cobre analytics/localizacao,
// opcionais). Generaliza o antigo carrinho especifico da secao "roldanas"
// (imesul-vendas-cart) para qualquer produto do catalogo. Nunca guarda nome, telefone, e-mail,
// PDF ou qualquer PII - so referencias de produto/medida/quantidade (ver auditoria de segurança
// desta fase, secao carrinho).
const cartStorageKey = "imesul_cart_items";
const cartEventName = "imesul-cart-updated";
const cartOpenEventName = "imesul-cart-open";
const maxCartItems = 60;

const canUseBrowserStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const notifyCartUpdated = () => {
  if (!canUseBrowserStorage()) return;
  window.dispatchEvent(new CustomEvent(cartEventName));
};

// Snapshot bruto (string) para uso com useSyncExternalStore - retornar um objeto novo a cada
// chamada quebraria a garantia de snapshot estavel do React (mesmo padrao de lib/consent.js).
export const getCartRawSnapshot = () =>
  canUseBrowserStorage() ? window.localStorage.getItem(cartStorageKey) || "[]" : "[]";

export const getServerCartSnapshot = () => "[]";

export const parseCartRaw = (raw) => {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getCartItems = () => parseCartRaw(getCartRawSnapshot());

const saveCartItems = (items) => {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(cartStorageKey, JSON.stringify(items.slice(0, maxCartItems)));
  notifyCartUpdated();
};

// Mesma combinacao categoria+produto+opcoes tecnicas = mesmo item; adicionar de novo so
// atualiza a quantidade em vez de duplicar a linha no carrinho.
const buildItemKey = (item) =>
  [item.categoryId, item.productId, item.measure, item.thickness, item.length, item.details]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");

// Allowlist explicita de campos - nunca "...item" direto no objeto salvo. Defesa em profundidade:
// mesmo que um chamador futuro passe acidentalmente nome/telefone/e-mail do cliente, esses
// campos nunca chegam ao localStorage (ver auditoria de seguranca desta fase, "carrinho nunca
// guarda PII").
const allowedItemFields = [
  "categoryId", "categoryName", "productId", "productName", "image",
  "measure", "thickness", "length", "details", "quantity", "unit",
];

const pickAllowedFields = (item) =>
  allowedItemFields.reduce((picked, field) => {
    if (item[field] !== undefined) picked[field] = item[field];
    return picked;
  }, {});

// Quantidade do formulario ("5 unidades", "1 unidade", "25,5 m") -> { quantity, unit }. quantity e
// sempre numerica (pode ser decimal em metragem); unit e "unidade" ou "m". Texto vazio/invalido
// ("Não informado") cai em 1 unidade, como antes.
export const parseQuantityText = (text) => {
  const match = String(text ?? "").trim().match(/^(\d+(?:[.,]\d+)?)\s*(m|unidades?)?$/i);
  const quantity = match ? Number(match[1].replace(",", ".")) : 0;
  if (!(quantity > 0)) return { quantity: 1, unit: "unidade" };
  return { quantity, unit: /^m$/i.test(match[2] || "") ? "m" : "unidade" };
};

// Texto exibido no carrinho e na mensagem do WhatsApp: "5 unidades", "1 unidade", "25,5 m".
export const formatCartQuantity = (item) => {
  const quantity = Number(item?.quantity) > 0 ? Number(item.quantity) : 1;
  const formatted = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(quantity);
  if (item?.unit === "m") return `${formatted} m`;
  return `${formatted} ${quantity === 1 ? "unidade" : "unidades"}`;
};

// Passo dos botoes +/- do carrinho: 1 unidade, ou 0,5 m em metragem (minimo = um passo).
export const stepCartQuantity = (item, direction) => {
  const step = item?.unit === "m" ? 0.5 : 1;
  const current = Number(item?.quantity) > 0 ? Number(item.quantity) : step;
  return Math.max(step, Math.round((current + direction * step) * 100) / 100);
};

// item: { categoryId, categoryName, productId, productName, image, measure, thickness, length,
// details, quantity, unit }. Campos tecnicos sao opcionais (nem todo produto tem todos).
export const addCartItem = (item) => {
  const key = buildItemKey(item);
  const current = getCartItems();
  const existingIndex = current.findIndex((existing) => buildItemKey(existing) === key);
  const entry = { ...pickAllowedFields(item), key, addedAt: new Date().toISOString() };

  const next = existingIndex >= 0
    ? current.map((existing, index) => (index === existingIndex ? { ...existing, quantity: item.quantity, unit: item.unit ?? existing.unit } : existing))
    : [...current, entry];

  saveCartItems(next);
  return next;
};

export const updateCartItemQuantity = (key, quantity) => {
  const next = getCartItems().map((item) => (item.key === key ? { ...item, quantity } : item));
  saveCartItems(next);
  return next;
};

export const removeCartItem = (key) => {
  const next = getCartItems().filter((item) => item.key !== key);
  saveCartItems(next);
  return next;
};

export const clearCartItems = () => {
  saveCartItems([]);
};

// Badge do carrinho: soma unidades; item em metragem conta como 1 linha (metros nao somam com unidades).
export const getCartItemCount = (items = getCartItems()) =>
  items.reduce((total, item) => {
    if (!(Number(item.quantity) > 0)) return total;
    return total + (item.unit === "m" ? 1 : Number(item.quantity));
  }, 0);

export const subscribeToCart = (callback) => {
  if (!canUseBrowserStorage()) return () => {};
  window.addEventListener(cartEventName, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(cartEventName, callback);
    window.removeEventListener("storage", callback);
  };
};

export const openCartDrawer = () => {
  if (!canUseBrowserStorage()) return;
  window.dispatchEvent(new CustomEvent(cartOpenEventName));
};

export const subscribeToCartOpen = (callback) => {
  if (!canUseBrowserStorage()) return () => {};
  window.addEventListener(cartOpenEventName, callback);
  return () => window.removeEventListener(cartOpenEventName, callback);
};
