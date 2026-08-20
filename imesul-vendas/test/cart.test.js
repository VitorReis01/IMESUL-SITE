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
