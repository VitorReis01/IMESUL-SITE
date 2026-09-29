import { beforeEach, describe, expect, it, vi } from "vitest";

// lib/cart.js só funciona no navegador (window.localStorage) - simula um window mínimo em Node
// para testar a lógica pura de add/update/remove/clear sem precisar de jsdom (dependência extra
// que este projeto não usa em nenhum outro lugar).
class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
}

beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), {
    localStorage: new MemoryStorage(),
  });
  vi.resetModules();
});

const importCartFresh = () => import("../lib/cart.js");

describe("lib/cart.js", () => {
  it("começa vazio", async () => {
    const { getCartItems } = await importCartFresh();
    expect(getCartItems()).toEqual([]);
  });

  it("adiciona um item novo", async () => {
    const { addCartItem, getCartItems } = await importCartFresh();
    addCartItem({ categoryId: "tubos", productId: "quadrado", quantity: 2 });
    const items = getCartItems();
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it("adicionar o MESMO produto/opções de novo atualiza a quantidade em vez de duplicar", async () => {
    const { addCartItem, getCartItems } = await importCartFresh();
    addCartItem({ categoryId: "tubos", productId: "quadrado", measure: "20x20", quantity: 1 });
    addCartItem({ categoryId: "tubos", productId: "quadrado", measure: "20x20", quantity: 5 });
    const items = getCartItems();
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(5);
  });

  it("itens com opções técnicas diferentes NÃO se misturam", async () => {
    const { addCartItem, getCartItems } = await importCartFresh();
    addCartItem({ categoryId: "tubos", productId: "quadrado", measure: "20x20", quantity: 1 });
    addCartItem({ categoryId: "tubos", productId: "quadrado", measure: "30x30", quantity: 1 });
    expect(getCartItems()).toHaveLength(2);
  });

  it("atualiza a quantidade de um item existente", async () => {
    const { addCartItem, updateCartItemQuantity, getCartItems } = await importCartFresh();
    addCartItem({ categoryId: "tubos", productId: "quadrado", quantity: 1 });
    const [item] = getCartItems();
    updateCartItemQuantity(item.key, 9);
    expect(getCartItems()[0].quantity).toBe(9);
  });

  it("remove um item pelo key", async () => {
    const { addCartItem, removeCartItem, getCartItems } = await importCartFresh();
    addCartItem({ categoryId: "tubos", productId: "quadrado", quantity: 1 });
    const [item] = getCartItems();
    removeCartItem(item.key);
    expect(getCartItems()).toEqual([]);
  });

  it("limpa o carrinho inteiro", async () => {
    const { addCartItem, clearCartItems, getCartItems } = await importCartFresh();
    addCartItem({ categoryId: "tubos", productId: "a", quantity: 1 });
    addCartItem({ categoryId: "tubos", productId: "b", quantity: 1 });
    clearCartItems();
    expect(getCartItems()).toEqual([]);
  });

  it("getCartItemCount soma as quantidades, ignorando valores inválidos", async () => {
    const { addCartItem, getCartItemCount, getCartItems } = await importCartFresh();
    addCartItem({ categoryId: "tubos", productId: "a", quantity: 2 });
    addCartItem({ categoryId: "tubos", productId: "b", quantity: 3 });
    expect(getCartItemCount(getCartItems())).toBe(5);
  });

  it("nunca guarda campos que pareçam PII (nome/telefone/e-mail) mesmo se enviados", async () => {
    const { addCartItem, getCartItems } = await importCartFresh();
    addCartItem({
      categoryId: "tubos",
      productId: "a",
      quantity: 1,
      customerName: "João",
      customerPhone: "5567999999999",
    });
    const [item] = getCartItems();
    expect(item.customerName).toBeUndefined();
    expect(item.customerPhone).toBeUndefined();
  });
});

describe("quantidade do carrinho (texto do formulário)", () => {
  it("parseQuantityText preserva unidades e metragem decimal", async () => {
    const { parseQuantityText } = await importCartFresh();
    expect(parseQuantityText("5 unidades")).toEqual({ quantity: 5, unit: "unidade" });
    expect(parseQuantityText("12 unidades")).toEqual({ quantity: 12, unit: "unidade" });
    expect(parseQuantityText("1 unidade")).toEqual({ quantity: 1, unit: "unidade" });
    expect(parseQuantityText("100 unidades")).toEqual({ quantity: 100, unit: "unidade" });
    expect(parseQuantityText("25,5 m")).toEqual({ quantity: 25.5, unit: "m" });
    expect(parseQuantityText("0,5 m")).toEqual({ quantity: 0.5, unit: "m" });
    expect(parseQuantityText("40 m")).toEqual({ quantity: 40, unit: "m" });
    expect(parseQuantityText("3")).toEqual({ quantity: 3, unit: "unidade" });
  });

  it("parseQuantityText cai em 1 unidade quando vazio/inválido/zero", async () => {
    const { parseQuantityText } = await importCartFresh();
    for (const value of ["", "Não informado", "Outro", "0 unidades", "0 m", undefined, null]) {
      expect(parseQuantityText(value)).toEqual({ quantity: 1, unit: "unidade" });
    }
  });

  it("guarda quantidade e unidade no item e formata para exibição", async () => {
    const { addCartItem, getCartItems, parseQuantityText, formatCartQuantity } = await importCartFresh();
    addCartItem({ categoryId: "telhas", productId: "t40", ...parseQuantityText("25,5 m") });
    addCartItem({ categoryId: "tubos", productId: "q", ...parseQuantityText("5 unidades") });
    const [telha, tubo] = getCartItems();
    expect(telha.quantity).toBe(25.5);
    expect(telha.unit).toBe("m");
    expect(formatCartQuantity(telha)).toBe("25,5 m");
    expect(tubo.quantity).toBe(5);
    expect(formatCartQuantity(tubo)).toBe("5 unidades");
    expect(formatCartQuantity({ quantity: 1 })).toBe("1 unidade");
  });

  it("stepCartQuantity anda 1 em unidades e 0,5 em metragem, nunca abaixo do passo", async () => {
    const { stepCartQuantity } = await importCartFresh();
    expect(stepCartQuantity({ quantity: 5, unit: "unidade" }, 1)).toBe(6);
    expect(stepCartQuantity({ quantity: 1, unit: "unidade" }, -1)).toBe(1);
    expect(stepCartQuantity({ quantity: 25.5, unit: "m" }, 1)).toBe(26);
    expect(stepCartQuantity({ quantity: 25.55, unit: "m" }, 1)).toBe(26.05);
    expect(stepCartQuantity({ quantity: 0.5, unit: "m" }, -1)).toBe(0.5);
    expect(stepCartQuantity({ quantity: 7 }, 1)).toBe(8);
  });

  it("getCartItemCount conta item em metragem como 1 linha", async () => {
    const { getCartItemCount } = await importCartFresh();
    expect(getCartItemCount([{ quantity: 5, unit: "unidade" }, { quantity: 25.5, unit: "m" }, { quantity: 2 }])).toBe(8);
  });
});
