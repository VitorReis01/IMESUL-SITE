"use client";

// Modal de login visual para cliente e administrador.
// O admin valida credenciais na API e libera o painel sem salvar senha no navegador.
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Check,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { removeCurrentVisitorEvents, startAdminSession, trackLocalEvent } from "../lib/localAnalytics";

const inputClassName =
  "h-12 w-full rounded-[8px] border border-white/[0.12] bg-[#071828] px-4 text-[15px] text-white outline-none transition-all duration-200 placeholder:text-imesul-steel/42 hover:border-white/[0.2] focus:border-imesul-red/75 focus:bg-[#0a1d30] focus:ring-4 focus:ring-imesul-red/[0.08]";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const googleScriptSrc = "https://accounts.google.com/gsi/client";

function TextField({
  label,
  type = "text",
  placeholder,
  required = false,
  name,
  value,
  onChange,
  autoComplete,
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-condensed text-[12px] font-semibold uppercase tracking-[0.13em] text-imesul-steel-light/82">
        {label}{required && <span className="text-imesul-red"> *</span>}
      </span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={onChange}
        className={inputClassName}
        autoComplete={autoComplete || (type === "password" ? "current-password" : "off")}
      />
    </label>
  );
}

function GoogleIdentityButton({ onCredential, text = "signin_with", disabled = false }) {
  const containerRef = useRef(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!googleClientId || disabled) return undefined;

    const markReady = () => setScriptReady(true);
    const markFailed = () => setLoadFailed(true);

    if (window.google?.accounts?.id) {
      const readyTimer = window.setTimeout(markReady, 0);
      return () => window.clearTimeout(readyTimer);
    }

    const existingScript = document.querySelector(`script[src="${googleScriptSrc}"]`);

    if (existingScript) {
      existingScript.addEventListener("load", markReady);
      existingScript.addEventListener("error", markFailed);

      return () => {
        existingScript.removeEventListener("load", markReady);
        existingScript.removeEventListener("error", markFailed);
      };
    }

    // Carrega o SDK oficial do Google somente quando o modal precisa do login social.
    const script = document.createElement("script");
    script.src = googleScriptSrc;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", markReady);
    script.addEventListener("error", markFailed);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", markReady);
      script.removeEventListener("error", markFailed);
    };
  }, [disabled]);

  useEffect(() => {
    if (!googleClientId || disabled || !scriptReady || !containerRef.current || !window.google?.accounts?.id) {
      return;
    }

    containerRef.current.innerHTML = "";

    // O backend deve validar o credential antes de criar uma sessão real.
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => {
        if (response?.credential) onCredential(response);
      },
    });

    window.google.accounts.id.renderButton(containerRef.current, {
      theme: "outline",
      size: "large",
      type: "standard",
      shape: "rectangular",
      text,
      width: Math.max(containerRef.current.offsetWidth, 240),
    });
  }, [disabled, onCredential, scriptReady, text]);

  if (!googleClientId || loadFailed) {
    return (
      <p className="flex min-h-12 items-center rounded-[8px] border border-white/[0.1] bg-white/[0.035] px-4 text-sm leading-5 text-imesul-steel-light/68">
        Login com Google indisponível no momento. Você pode enviar seu orçamento sem fazer login.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`min-h-12 min-w-[240px] rounded-[8px] ${disabled ? "pointer-events-none opacity-50" : ""}`}
    />
  );
}

function ActionButton({ children, variant = "primary", type = "button", disabled = false, onClick }) {
  const styles = variant === "primary"
    ? "border-imesul-red bg-imesul-red text-white shadow-[0_16px_44px_rgba(212,43,43,0.24)] hover:bg-[#ef3434]"
    : "border-white/[0.12] bg-white/[0.045] text-white hover:border-white/[0.22] hover:bg-white/[0.075]";

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border px-5 py-3 font-condensed text-sm font-bold uppercase tracking-[0.11em] transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none ${styles}`}
    >
      {children}
    </button>
  );
}

// Controla apenas a interface de acesso; autenticacao real entra em fase posterior.
export default function AuthModal({ open, onClose, onAuthenticated, onAdminAuthenticated }) {
  const [mode, setMode] = useState("start");
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({ user: "", password: "" });
  const [adminError, setAdminError] = useState("");

  const closeModal = useCallback(() => {
    setMode("start");
    setAcceptedPrivacy(false);
    setAdminCredentials({ user: "", password: "" });
    setAdminError("");
    onClose();
  }, [onClose]);

  const completeVisualAuth = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const client = mode === "client-register"
      ? {
          name: String(formData.get("name") || ""),
          phone: String(formData.get("phone") || ""),
          email: String(formData.get("email") || ""),
          status: "Cliente com login",
        }
      : { status: "Cliente com login" };

    trackLocalEvent({
      type: "login",
      label: mode === "client-register" ? "Cadastro visual cliente" : "Login visual cliente",
      section: "Modal de login",
      detail: "Fluxo demonstrativo sem autenticação real",
      client,
      isLoggedIn: true,
    });
    onAuthenticated();
    closeModal();
  };

  const completeGoogleVisualAuth = useCallback((response) => {
    if (!response?.credential) return;

    trackLocalEvent({
      type: "login",
      label: "Login visual com Google",
      section: "Modal de login",
      detail: "Credential recebido pelo Google Identity Services",
      isLoggedIn: false,
    });
    onAuthenticated();
    closeModal();
  }, [closeModal, onAuthenticated]);

  const updateAdminCredential = (field) => (event) => {
    setAdminError("");
    setAdminCredentials((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const returnToStart = () => {
    setMode("start");
    setAdminCredentials({ user: "", password: "" });
    setAdminError("");
  };

  const completeAdminVisualAuth = async (event) => {
    event.preventDefault();

    // Envia credenciais ao backend para evitar expor senha no bundle do navegador.
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: adminCredentials.user.trim(),
        password: adminCredentials.password,
      }),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => null) : null;

    if (!response?.ok || !result?.ok) {
      trackLocalEvent({
        type: "login",
        label: "Tentativa de login admin com erro",
        section: "Modal administrativo",
        detail: adminCredentials.user.trim() || "Usuário não informado",
        isLoggedIn: false,
      });
      setAdminError("Usuário ou senha inválidos.");
      return;
    }

    startAdminSession(result.adminSessionToken);
    removeCurrentVisitorEvents();
    onAuthenticated();
    onAdminAuthenticated?.();
    closeModal();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#030811]/82 px-4 py-6 backdrop-blur-md">
      <div className="relative max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-[10px] border border-white/[0.12] bg-[linear-gradient(145deg,rgba(12,30,51,0.98),rgba(5,12,22,0.99))] shadow-[0_30px_110px_rgba(0,0,0,0.56)]">
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 opacity-[0.075] blur-[1px] sm:h-[560px] sm:w-[560px]">
          <Image
            src="/logo/imesul-symbol.png"
            alt=""
            fill
            sizes="(max-width: 640px) 420px, 560px"
            className="object-contain"
          />
        </div>
        <button
          type="button"
          onClick={closeModal}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] text-white transition-colors hover:bg-white/[0.08]"
          aria-label="Fechar login"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="relative z-10 overflow-hidden border-b border-white/[0.08] px-6 py-7 sm:px-8">
          <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-imesul-red/15 blur-3xl" />
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-imesul-red">
            IMESUL VENDAS
          </p>
          <h2 className="mt-3 font-display text-5xl leading-none text-white">
            Acesse sua conta
          </h2>
          {mode === "start" && (
            <p className="mt-3 max-w-xl text-sm leading-6 text-imesul-steel-light/70">
              Área em implantação. Você pode enviar seu orçamento sem fazer login.{" "}
              <button
                type="button"
                onClick={() => setMode("admin-login")}
                className="inline-flex h-6 w-6 translate-y-1 items-center justify-center rounded-full text-imesul-steel-light/62 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red/60"
                aria-label="Acesso administrativo"
              >
                <ShieldCheck size={15} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </p>
          )}
        </div>

        <div className="relative z-10 p-6 sm:p-8">
          {mode === "start" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("client-login")}
                className="group min-h-40 rounded-[8px] border border-white/[0.1] bg-white/[0.035] p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-imesul-red/55 hover:bg-white/[0.055]"
              >
                <UserRound size={28} className="text-imesul-red" aria-hidden="true" />
                <strong className="mt-5 block font-condensed text-2xl font-semibold uppercase text-white">
                  Já tenho conta
                </strong>
                <span className="mt-2 block text-sm leading-6 text-imesul-steel-light/68">
                  Entre como cliente para acompanhar visualmente seu atendimento.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("client-register")}
                className="group min-h-40 rounded-[8px] border border-white/[0.1] bg-white/[0.035] p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-imesul-red/55 hover:bg-white/[0.055]"
              >
                <Check size={28} className="text-imesul-red" aria-hidden="true" />
                <strong className="mt-5 block font-condensed text-2xl font-semibold uppercase text-white">
                  Criar conta
                </strong>
                <span className="mt-2 block text-sm leading-6 text-imesul-steel-light/68">
                  Cadastro opcional para facilitar próximos atendimentos.
                </span>
              </button>
            </div>
          )}

          {mode === "client-login" && (
            <form onSubmit={completeVisualAuth} className="space-y-5">
              <TextField label="CPF, telefone ou e-mail" required />
              <TextField label="Senha" type="password" required />
              <label className="flex items-start gap-3 text-sm leading-6 text-imesul-steel-light/72">
                <input type="checkbox" className="mt-1 accent-imesul-red" />
                Manter conectado neste dispositivo
              </label>
              <p className="rounded-[8px] border border-white/[0.09] bg-white/[0.035] p-4 text-sm leading-6 text-imesul-steel-light/72">
                Por segurança, não salvamos sua senha no site. Você também pode enviar seu orçamento sem fazer login.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ActionButton type="submit">
                  <LockKeyhole size={16} aria-hidden="true" />
                  Entrar
                </ActionButton>
                <GoogleIdentityButton onCredential={completeGoogleVisualAuth} />
              </div>
            </form>
          )}

          {mode === "client-register" && (
            <form onSubmit={completeVisualAuth} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="Nome completo" name="name" required />
                <TextField label="Número de telefone" name="phone" required />
                <TextField label="E-mail opcional" name="email" type="email" />
                <TextField label="CPF" required />
                <TextField label="Criar senha" type="password" required />
                <TextField label="Confirmar senha" type="password" required />
              </div>
              <p className="rounded-[8px] border border-imesul-red/25 bg-imesul-red/[0.08] p-4 text-sm leading-6 text-imesul-steel-light/78">
                Cadastro opcional para facilitar próximos atendimentos. O orçamento também pode ser enviado sem login.
              </p>
              <label className="flex items-start gap-3 text-sm leading-6 text-imesul-steel-light/72">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                  className="mt-1 accent-imesul-red"
                  required
                />
                <span>
                  Li e aceito a{" "}
                  <a href="/politica-de-privacidade" className="text-imesul-red underline decoration-imesul-red/40 underline-offset-4">
                    Política de Privacidade
                  </a>.
                </span>
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ActionButton type="submit" disabled={!acceptedPrivacy}>
                  Criar conta
                </ActionButton>
                <GoogleIdentityButton
                  onCredential={completeGoogleVisualAuth}
                  text="signup_with"
                  disabled={!acceptedPrivacy}
                />
              </div>
            </form>
          )}

          {mode === "admin-login" && (
            <form onSubmit={completeAdminVisualAuth} className="space-y-5">
              <div className="rounded-[8px] border border-[#f0c776]/25 bg-[#f0c776]/[0.07] p-4 text-sm leading-6 text-[#f0c776]">
                Acesso restrito à equipe IMESUL.
              </div>
              {adminError && (
                <p className="rounded-[8px] border border-imesul-red/35 bg-imesul-red/[0.09] p-4 text-sm leading-6 text-white">
                  {adminError}
                </p>
              )}
              <TextField
                label="Usuário ou e-mail"
                required
                value={adminCredentials.user}
                onChange={updateAdminCredential("user")}
                autoComplete="username"
              />
              <TextField
                label="Senha"
                type="password"
                required
                value={adminCredentials.password}
                onChange={updateAdminCredential("password")}
                autoComplete="current-password"
              />
              <ActionButton type="submit">
                <ShieldCheck size={16} aria-hidden="true" />
                Entrar como administrador
              </ActionButton>
            </form>
          )}

          {mode !== "start" && (
            <button
              type="button"
              onClick={returnToStart}
              className="mt-6 font-condensed text-sm font-semibold uppercase tracking-[0.13em] text-imesul-steel-light/68 transition-colors hover:text-white"
            >
              Voltar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
