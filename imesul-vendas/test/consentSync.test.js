import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getConsentSyncUrl as getVendasConsentSyncUrl,
  getStoredConsentRaw as getVendasStoredConsentRaw,
  importConsentFromUrl as importVendasConsentFromUrl,
  parseConsentState,
  parseStoredConsent as parseVendasStoredConsent,
  saveConsent as saveVendasConsent,
} from "../lib/consent.js";
import {
  getConsentSyncUrl as getInstitucionalConsentSyncUrl,
  getStoredConsentRaw as getInstitucionalStoredConsentRaw,
  importConsentFromUrl as importInstitucionalConsentFromUrl,
  parseStoredConsent as parseInstitucionalStoredConsent,
  saveConsent as saveInstitucionalConsent,
} from "../../imesul/lib/consent.js";
import { canSendTracking } from "../components/TrackingScripts.jsx";

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.get(key) || null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

const installBrowser = (href) => {
  let cookieValue = "";
  const localStorage = new MemoryStorage();

  global.window = {
    localStorage,
    location: new URL(href),
    history: {
      state: null,
      replaceState(state, title, nextUrl) {
        this.state = state;
        window.location = new URL(nextUrl, window.location.origin);
      },
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    queueMicrotask(callback) {
      callback();
    },
  };
  global.CustomEvent = class CustomEvent {
    constructor(type) {
      this.type = type;
    }
  };
  global.document = {};
  Object.defineProperty(global.document, "cookie", {
    get() {
      return cookieValue;
    },
    set(value) {
      cookieValue = value.split(";")[0];
    },
    configurable: true,
  });

  return { localStorage, getCookie: () => cookieValue };
};

afterEach(() => {
  delete global.window;
  delete global.document;
  delete global.CustomEvent;
  delete global.fetch;
});

beforeEach(() => {
  installBrowser("https://imesul-site.vercel.app/");
});

describe("sincronizacao de consentimento entre institucional e vendas", () => {
  it("aceitou todos no institucional e vendas reconhece pela URL assinada", async () => {
    installBrowser("https://imesul-site.vercel.app/");
    saveInstitucionalConsent({ analytics: true, location: true });
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ ok: true, token: "signed.payload" }),
    });
    const href = await getInstitucionalConsentSyncUrl("https://imesul-vendas.vercel.app/?unidade=campo-grande");

    installBrowser(href);
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ ok: true, consent: { analytics: true, location: true } }),
    });
    await importVendasConsentFromUrl();
    const consent = parseVendasStoredConsent(getVendasStoredConsentRaw());

    expect(consent).toMatchObject({ necessary: true, analytics: true, location: true });
    expect(window.location.search).toBe("?unidade=campo-grande");
  });

  it("somente necessarios no institucional e vendas reconhece", async () => {
    installBrowser("https://imesul-site.vercel.app/");
    saveInstitucionalConsent({ analytics: false, location: false });
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ ok: true, token: "signed.payload" }),
    });
    const href = await getInstitucionalConsentSyncUrl("https://imesul-vendas.vercel.app/");

    installBrowser(href);
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ ok: true, consent: { analytics: false, location: false } }),
    });
    await importVendasConsentFromUrl();
    const consent = parseVendasStoredConsent(getVendasStoredConsentRaw());

    expect(consent).toMatchObject({ necessary: true, analytics: false, location: false });
  });

  it("rejeicao de analytics no institucional continua rejeitada em vendas", async () => {
    installBrowser("https://imesul-site.vercel.app/");
    saveInstitucionalConsent({ analytics: false, location: true });
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ ok: true, token: "signed.payload" }),
    });
    const href = await getInstitucionalConsentSyncUrl("https://imesul-vendas.vercel.app/");

    installBrowser(href);
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ ok: true, consent: { analytics: false, location: true } }),
    });
    await importVendasConsentFromUrl();
    const consent = parseVendasStoredConsent(getVendasStoredConsentRaw());

    expect(consent?.analytics).toBe(false);
    expect(consent?.location).toBe(true);
  });

  it("vendas tambem sincroniza de volta para o institucional", async () => {
    installBrowser("https://imesul-vendas.vercel.app/");
    saveVendasConsent({ analytics: true, location: false });
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ ok: true, token: "signed.payload" }),
    });
    const href = await getVendasConsentSyncUrl("https://imesul-site.vercel.app/");

    installBrowser(href);
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ ok: true, consent: { analytics: true, location: false } }),
    });
    await importInstitucionalConsentFromUrl();
    const consent = parseInstitucionalStoredConsent(getInstitucionalStoredConsentRaw());

    expect(consent).toMatchObject({ necessary: true, analytics: true, location: false });
    expect(window.location.search).toBe("");
  });

  it("acesso direto sem consentimento continua sem decisao local", () => {
    installBrowser("https://imesul-vendas.vercel.app/");

    expect(getVendasStoredConsentRaw()).toBe("");
  });

  it("estado invalido na URL e ignorado", () => {
    installBrowser("https://imesul-vendas.vercel.app/?im_consent=%7B%22analytics%22%3Atrue%7D");

    expect(parseConsentState('{"analytics":true}')).toBeNull();
    expect(getVendasStoredConsentRaw()).toBe("");
    expect(window.location.search).toBe("?im_consent=%7B%22analytics%22%3Atrue%7D");
  });

  it("valor fabricado como v1-a1-l1 nao concede consentimento", async () => {
    installBrowser("https://imesul-vendas.vercel.app/?im_consent=v1-a1-l1");

    await importVendasConsentFromUrl();

    expect(getVendasStoredConsentRaw()).toBe("");
  });

  it("sem segredo configurado no servidor, emissao falha fechada e navega sem token", async () => {
    installBrowser("https://imesul-site.vercel.app/");
    saveInstitucionalConsent({ analytics: true, location: true });
    global.fetch = async () => ({
      ok: false,
      json: async () => ({ ok: false }),
    });

    const href = await getInstitucionalConsentSyncUrl("https://imesul-vendas.vercel.app/");

    expect(href).toBe("https://imesul-vendas.vercel.app/");
  });

  it("tracking continua bloqueado quando NEXT_PUBLIC_TRACKING_ENABLED=false", () => {
    expect(canSendTracking({ enabled: false, consent: { analytics: true } })).toBe(false);
    expect(canSendTracking({ enabled: true, consent: { analytics: false } })).toBe(false);
    expect(canSendTracking({ enabled: true, consent: { analytics: true } })).toBe(true);
  });

  it("cookie compartilhado do dominio definitivo nao quebra localhost nem Vercel", () => {
    const vercel = installBrowser("https://imesul-vendas.vercel.app/");
    saveVendasConsent({ analytics: true, location: true });
    expect(vercel.getCookie()).toBe("");

    const production = installBrowser("https://vendas.grupoimesul.com.br/");
    saveVendasConsent({ analytics: false, location: false });
    expect(production.getCookie()).toContain("imesul_privacy_consent=v1-a0-l0");
  });
});
