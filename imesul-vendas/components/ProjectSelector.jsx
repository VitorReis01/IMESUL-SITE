"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDownRight,
  ArrowRight,
  Building2,
  Check,
  Headphones,
  Layers3,
  MapPin,
  MessageCircle,
  PackageSearch,
  Search,
  ShieldCheck,
} from "lucide-react";
import { projects } from "../data/projects";
import { catalogCategories } from "../data/catalogCategories";
import { catalogProducts, getCatalogProduct } from "../data/catalogProducts";
import { createWhatsAppUrl } from "../lib/whatsapp";
import { endAdminSession, trackLocalEvent } from "../lib/localAnalytics";
import AdminDashboard from "./AdminDashboard";
import AuthModal from "./AuthModal";
import { MaterialQuoteFlow, ProjectQuoteFlow } from "./QuoteBuilder";
import ProductCatalog from "./ProductCatalog";
import SalesGuidanceSection from "./SalesGuidanceSection";

const salesUnits = {
  dourados: "Dourados",
  "campo-grande": "Campo Grande",
};

const institutionalUrl =
  process.env.NEXT_PUBLIC_INSTITUTIONAL_SITE_URL || "http://192.168.1.117:3000";

const sellerMessage =
  "Olá, vim pela Área de Vendas da IMESUL e quero falar com um vendedor.";

const navLinkClassName =
  "group/nav relative inline-flex origin-center items-center py-2 transition-[color,text-shadow,transform] duration-300 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.22),0_0_18px_rgba(212,43,43,0.18)] active:scale-[0.96] motion-reduce:transform-none motion-reduce:transition-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-gradient-to-r after:from-imesul-red after:via-white/70 after:to-transparent after:transition-transform after:duration-300 hover:after:scale-x-100 motion-reduce:after:transition-none";

// Termos extras ajudam a busca sem alterar o cadastro oficial de produtos.
const searchAliases = {
  "telhas-metalicas": ["telha", "telhas", "telhas metalicas", "telhas metálicas", "terça", "terças", "cobertura"],
  "tubos-metalicos": ["tubo", "tubos", "metalon", "metalons"],
  laminados: ["barra", "barras", "vergalhao", "vergalhão"],
  chapas: ["chapa", "chapas"],
  "perfis-estruturais": ["perfil", "perfis", "cantoneira", "cantoneiras"],
  "acessorios-serralheria": ["acessorio", "acessório", "acessorios", "acessórios", "fixador", "fixadores", "parafuso", "parafusos"],
  "thinner-fixadores": ["thinner", "solvente", "solventes", "diluição", "limpeza", "pintura"],
};

const normalizeSearch = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const trustItems = [
  {
    icon: ShieldCheck,
    title: "+45 anos",
    description: "experiência e confiança",
  },
  {
    icon: Headphones,
    title: "Atendimento técnico",
    description: "orientação especializada",
  },
  {
    icon: MapPin,
    title: "Dourados e Campo Grande",
    description: "três unidades",
  },
  {
    icon: Layers3,
    title: "Linha completa em aço",
    description: "do básico ao acabamento",
  },
];

const projectShowcaseCards = [
  {
    projectId: "estrutura-metalica",
    title: "Estruturas Metálicas",
    description: "Perfis, tubos e chapas para bases, reforços e grandes estruturas.",
    image: "/images/vendas/projetos/estruturas-metalicas.png",
    recommendedCategoryIds: [
      "perfis-estruturais",
      "tubos-metalicos",
      "chapas",
      "laminados",
    ],
  },
  {
    projectId: "cobertura",
    title: "Cobertimento e Telhados",
    description: "Telhas, terças e acessórios para coberturas resistentes.",
    image: "/images/vendas/projetos/cobertimento-e-telhados.png",
    recommendedCategoryIds: [
      "telhas-metalicas",
      "perfis-estruturais",
      "tubos-metalicos",
      "acessorios-serralheria",
    ],
  },
  {
    projectId: "serralheria",
    title: "Serralheria e Acabamentos",
    description: "Materiais para portões, grades, esquadrias e acabamento.",
    image: "/images/vendas/projetos/serralheria-e-acabamentos.png",
    recommendedCategoryIds: [
      "perfis-serralheria",
      "tubos-metalicos",
      "chapas",
      "acessorios-serralheria",
    ],
  },
  {
    projectId: "galpao",
    title: "Indústria e Manutenção",
    description: "Soluções em aço para operação, reforço e manutenção industrial.",
    image: "/images/vendas/projetos/industria-e-manutencao.png",
    recommendedCategoryIds: [
      "chapas",
      "tubos-metalicos",
      "perfis-estruturais",
      "laminados",
      "acessorios-serralheria",
    ],
  },
  {
    projectId: "rural",
    title: "Linha Rural e Campo",
    description: "Produtos para barracões, cercamentos e estruturas no campo.",
    image: "/images/vendas/projetos/linha-rural-e-campo.png",
    recommendedCategoryIds: [
      "tubos-metalicos",
      "telhas-metalicas",
      "laminados",
      "acessorios-serralheria",
      "perfis-estruturais",
    ],
  },
];

// Coordena os caminhos "Tenho um Projeto" e "Ja Sei o Material" na mesma pagina.
// Apenas um caminho permanece selecionado para evitar dois orcamentos concorrentes.
export default function ProjectSelector() {
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [recommendedProject, setRecommendedProject] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [originUnit, setOriginUnit] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [heroIntroReady, setHeroIntroReady] = useState(false);
  const [heroReduceMotion, setHeroReduceMotion] = useState(false);
  const [heroTrustGlowIndex, setHeroTrustGlowIndex] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authVisualActive, setAuthVisualActive] = useState(false);
  const [adminDashboardOpen, setAdminDashboardOpen] = useState(false);
  const [adminVisualActive, setAdminVisualActive] = useState(false);
  const searchRef = useRef(null);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedProduct = getCatalogProduct(selectedProductId);
  const sellerWhatsAppUrl = createWhatsAppUrl(sellerMessage);

  const isUserVisuallyLoggedIn = authVisualActive || adminVisualActive;

  const trackInteraction = useCallback((event) => {
    trackLocalEvent({
      ...event,
      isLoggedIn: isUserVisuallyLoggedIn,
    });
  }, [isUserVisuallyLoggedIn]);

  // Consolida categorias e produtos em uma lista unica de sugestoes do topo.
  const searchItems = useMemo(() => {
    const categoryItems = catalogCategories.map((category) => ({
      id: category.id,
      type: "category",
      title: category.name,
      description: category.description,
      categoryId: category.id,
      keywords: [category.name, category.description, ...(searchAliases[category.id] || [])],
    }));

    const productItems = catalogProducts.map((product) => ({
      id: product.id,
      type: "product",
      title: product.name,
      description: product.description,
      categoryId: product.categoryId,
      productId: product.id,
      keywords: [product.name, product.description, ...(product.usage || [])],
    }));

    return [...categoryItems, ...productItems];
  }, []);

  const searchSuggestions = useMemo(() => {
    const query = normalizeSearch(searchTerm.trim());
    if (!query) return [];

    return searchItems
      .map((item) => {
        const haystack = item.keywords.map(normalizeSearch);
        const startsWithScore = haystack.some((value) =>
          value.split(/\s+/).some((word) => word.startsWith(query))
        );
        const includesScore = haystack.some((value) => value.includes(query));

        if (!startsWithScore && !includesScore) return null;
        return { ...item, score: startsWithScore ? 0 : 1 };
      })
      .filter(Boolean)
      .sort((left, right) => left.score - right.score || left.title.localeCompare(right.title))
      .slice(0, 6);
  }, [searchItems, searchTerm]);

  // Captura a unidade enviada pelo site institucional e mantÃ©m o dado no fluxo comercial.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const unitParam = new URLSearchParams(window.location.search).get("unidade");
      setOriginUnit(salesUnits[unitParam] || "");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // Registra a entrada na home sem coletar dados pessoais do visitante.
  useEffect(() => {
    trackLocalEvent({
      type: "visit",
      label: "Visita iniciada",
      section: "Home",
      detail: "Nenhuma interação registrada até o momento",
      isLoggedIn: false,
    });
  }, []);

  // Debounce simples para registrar pesquisas sem salvar cada tecla digitada.
  useEffect(() => {
    const query = searchTerm.trim();
    if (query.length < 2) return undefined;

    const timer = window.setTimeout(() => {
      trackInteraction({
        type: "search",
        label: "Pesquisa realizada",
        section: "Busca do topo",
        detail: query,
      });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [searchTerm, trackInteraction]);

  // Fecha a busca quando o usuario sai do campo ou usa Esc.
  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!searchRef.current?.contains(event.target)) setSearchOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSearchOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Revela os textos e cards da hero em sequência sem animar quem prefere menos movimento.
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId;

    const syncHeroIntro = () => {
      setHeroReduceMotion(media.matches);
      if (media.matches) {
        setHeroIntroReady(true);
        setHeroTrustGlowIndex(null);
        return;
      }

      setHeroIntroReady(false);
      frameId = window.requestAnimationFrame(() => setHeroIntroReady(true));
    };

    syncHeroIntro();
    media.addEventListener("change", syncHeroIntro);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      media.removeEventListener("change", syncHeroIntro);
    };
  }, []);

  // Destaca cada prova de confiança uma vez após a entrada da hero, sem brilho em loop.
  useEffect(() => {
    if (!heroIntroReady || heroReduceMotion) {
      return undefined;
    }

    const timers = trustItems.flatMap((_, index) => {
      const startDelay = 1040 + index * 720;
      return [
        window.setTimeout(() => setHeroTrustGlowIndex(index), startDelay),
        window.setTimeout(() => setHeroTrustGlowIndex(null), startDelay + 620),
      ];
    });

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [heroIntroReady, heroReduceMotion]);

  // Revela os blocos abaixo da hero quando entram na viewport e oculta ao sair.
  useEffect(() => {
    const revealElements = Array.from(document.querySelectorAll("[data-scroll-reveal]"));
    if (!revealElements.length) return undefined;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      revealElements.forEach((element) => element.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-visible", entry.isIntersecting);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );

    revealElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  // Aguarda a renderizacao do bloco escolhido antes de leva-lo para a viewport.
  const scrollToFlow = (id) => {
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  };

  // Limpa a selecao de material ao iniciar uma solicitacao guiada por projeto.
  const selectProject = (projectId) => {
    const project = projects.find((item) => item.id === projectId);
    trackInteraction({
      type: "click",
      label: "Card de projeto",
      section: "Projetos",
      detail: project?.name || projectId,
    });
    setSelectedProjectId(projectId);
    setRecommendedProject(null);
    setSelectedCategoryId(null);
    setSelectedProductId(null);
    scrollToFlow("project-quote-flow");
  };

  // Leva o cliente dos cards de projeto para as categorias mais indicadas.
  const showRecommendedMaterials = (card) => {
    trackInteraction({
      type: "click",
      label: "Projeto para materiais indicados",
      section: "Projetos",
      detail: card.title,
    });
    setSelectedProjectId(null);
    setRecommendedProject({
      projectId: card.projectId,
      title: card.title,
      categoryIds: card.recommendedCategoryIds,
    });
    setSelectedCategoryId(null);
    setSelectedProductId(null);
    scrollToFlow("material-path");
  };

  // Abre os produtos da categoria e encerra qualquer fluxo de projeto anterior.
  const selectCategory = (categoryId) => {
    const category = catalogCategories.find((item) => item.id === categoryId);
    trackInteraction({
      type: "click",
      label: "Categoria de material",
      section: "Materiais",
      detail: category?.name || categoryId,
    });
    setSelectedCategoryId(categoryId);
    setSelectedProductId(null);
    setSelectedProjectId(null);
    setRecommendedProject(null);
    scrollToFlow("catalog-products");
  };

  // Entrega o produto ao formulario tecnico e desloca a pagina ate ele.
  const selectProduct = (productId) => {
    const product = getCatalogProduct(productId);
    trackInteraction({
      type: "click",
      label: "Produto selecionado",
      section: "Materiais",
      detail: product?.name || productId,
    });
    setSelectedProductId(productId);
    setSelectedProjectId(null);
    scrollToFlow("material-quote-flow");
  };

  // Usa a mesma selecao dos cards para levar a sugestao ate o fluxo correto.
  const selectSearchSuggestion = (suggestion) => {
    trackInteraction({
      type: "search",
      label: "Sugestão clicada",
      section: "Busca do topo",
      detail: suggestion.title,
    });
    setSearchTerm("");
    setSearchOpen(false);
    if (suggestion.type === "category") {
      selectCategory(suggestion.categoryId);
      return;
    }

    setSelectedCategoryId(suggestion.categoryId);
    selectProduct(suggestion.productId);
  };

  // Centraliza atraso e estado visual da entrada progressiva da primeira dobra.
  const heroIntroClassName = `transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none ${
    heroIntroReady || heroReduceMotion ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
  }`;
  const heroIntroStyle = (delay) => ({
    transitionDelay: heroReduceMotion ? "0ms" : `${delay}ms`,
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06101d]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(212,43,43,0.11),transparent_24%),radial-gradient(circle_at_88%_46%,rgba(42,92,151,0.14),transparent_30%),linear-gradient(180deg,#06101d_0%,#0a1727_48%,#06101d_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.055] [background-image:linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />

      <header className="relative z-30 border-b border-white/[0.08] bg-[#050b14]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-[64px] max-w-[1480px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
          <span className="relative inline-flex shrink-0 items-center">
            <span className="pointer-events-none absolute inset-[-18px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16),rgba(212,43,43,0.08)_38%,transparent_68%)] blur-xl" />
            <Image
            src="/logo/imesul-logo-completa.png"
            alt="IMESUL DistribuiÃ§Ã£o"
            width={707}
            height={353}
            priority
            className="relative h-auto w-[132px] object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.16)] sm:w-[154px]"
          />
          </span>
          <nav
            className="hidden items-center gap-5 font-condensed text-[13px] font-semibold uppercase tracking-[0.12em] text-imesul-steel-light/82 xl:flex"
            aria-label="Navegação principal"
          >
            <a
              href="#project-path"
              onClick={() => trackInteraction({ type: "click", label: "Projetos", section: "Navbar" })}
              className={navLinkClassName}
            >
              Projetos
            </a>
            <a
              href="#material-path"
              onClick={() => trackInteraction({ type: "click", label: "Materiais", section: "Navbar" })}
              className={navLinkClassName}
            >
              Materiais
            </a>
            <a
              href="/catalogo/catalogo-imesul.pdf"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackInteraction({ type: "click", label: "Catálogo", section: "Navbar", detail: "PDF catálogo IMESUL" })}
              className={navLinkClassName}
            >
              Catálogos
            </a>
            <a
              href={institutionalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackInteraction({ type: "click", label: "Sobre a Imesul", section: "Navbar", detail: institutionalUrl })}
              className={navLinkClassName}
            >
              Sobre a Imesul
            </a>
            <a
              href={sellerWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackInteraction({ type: "whatsapp", label: "Contato/WhatsApp", section: "Navbar", detail: "Contato" })}
              className={navLinkClassName}
            >
              Contato
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <div ref={searchRef} className="relative flex">
              <label className="flex h-10 w-[min(46vw,270px)] items-center gap-2 rounded-[5px] border border-white/[0.1] bg-[#06101d]/72 px-3 text-imesul-steel-light/65 sm:w-[270px]">
                <span className="sr-only">Buscar materiais</span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Buscar materiais..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-imesul-steel-light/58 focus:outline-none"
                />
                <Search size={16} strokeWidth={1.8} aria-hidden="true" />
              </label>

              {searchOpen && searchTerm.trim() && (
                <div
                  data-testid="search-dropdown"
                  className="absolute right-0 top-[calc(100%+10px)] z-[120] max-h-[360px] w-[min(88vw,360px)] overflow-y-auto rounded-[8px] border border-white/[0.12] bg-[#071321] shadow-[0_24px_70px_rgba(0,0,0,0.48)]"
                >
                  {searchSuggestions.length ? (
                    searchSuggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.type}-${suggestion.id}`}
                        type="button"
                        onClick={() => selectSearchSuggestion(suggestion)}
                        className="group block w-full cursor-pointer border-b border-white/[0.07] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.055]"
                      >
                        <span className="block min-w-0">
                          <strong className="block font-condensed text-[15px] font-semibold uppercase tracking-[0.08em] text-white transition-colors group-hover:text-imesul-red">
                            {suggestion.title}
                          </strong>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-4 py-4 text-sm text-imesul-steel-light/65">
                      Nenhum material encontrado
                    </p>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (adminVisualActive) {
                  setAdminDashboardOpen(true);
                  return;
                }

                setAuthModalOpen(true);
              }}
              className="group/login inline-flex h-10 items-center justify-center gap-2 rounded-[5px] border border-white/[0.12] bg-white/[0.035] px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.13em] text-white transition-[background-color,border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-imesul-red/55 hover:bg-white/[0.06] hover:shadow-[0_0_18px_rgba(255,255,255,0.08),0_0_20px_rgba(212,43,43,0.12)] active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none sm:px-4"
            >
              <span className="hidden sm:inline">
                {adminVisualActive ? "Painel admin" : authVisualActive ? "Conta ativa" : "Fazer login"}
              </span>
              <span className="sm:hidden">
                {adminVisualActive ? "Admin" : authVisualActive ? "Conta" : "Login"}
              </span>
              {isUserVisuallyLoggedIn && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#25D366] text-[#04110a] shadow-[0_0_12px_rgba(37,211,102,0.42)]">
                  <Check size={13} strokeWidth={3} aria-hidden="true" />
                </span>
              )}
            </button>
            <a
              href={sellerWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackInteraction({ type: "whatsapp", label: "Falar com vendedor", section: "Navbar", detail: "Botão superior" })}
              className="group/seller hidden h-10 items-center justify-center gap-2 rounded-[5px] border border-imesul-red/65 px-4 font-condensed text-[12px] font-bold uppercase tracking-[0.13em] text-white shadow-[0_0_0_rgba(37,211,102,0)] transition-[background-color,border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-[#25D366] hover:bg-[#25D366] hover:text-white hover:shadow-[0_0_24px_rgba(37,211,102,0.28),0_0_12px_rgba(255,255,255,0.10)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/25 active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none sm:inline-flex"
            >
              <MessageCircle
                size={15}
                strokeWidth={2}
                className="text-imesul-red transition-[filter,color,transform] duration-300 group-hover/seller:text-white group-hover/seller:drop-shadow-[0_0_8px_rgba(255,255,255,0.34)] group-active/seller:scale-110 motion-reduce:transform-none motion-reduce:transition-none"
                aria-hidden="true"
              />
              Falar com vendedor
            </a>
          </div>
        </div>
      </header>

      <section className="relative z-10 overflow-hidden border-b border-white/[0.08]">
        <video
          className="pointer-events-none absolute inset-0 hidden h-full w-full object-cover motion-safe:block motion-reduce:hidden"
          src="/videos/fundo-animado-hero.mp4"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(5,11,20,0.9)_0%,rgba(5,11,20,0.68)_44%,rgba(5,11,20,0.55)_100%)] motion-safe:block motion-reduce:hidden" />

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-64px)] max-w-[1480px] items-center gap-8 px-6 py-10 sm:px-8 sm:py-12 lg:grid-cols-[0.93fr_1.07fr] lg:px-12 lg:py-12">
          <div className="max-w-[620px]">
            <div className={`flex items-center gap-4 ${heroIntroClassName}`} style={heroIntroStyle(80)}>
              <span className="font-mono text-[10px] tracking-[0.4em] text-imesul-red">
                IMESUL VENDAS
              </span>
              <span className="h-px w-14 bg-imesul-red" />
            </div>

            <h1 className="mt-4 font-display text-[clamp(2.55rem,4.75vw,5.35rem)] leading-[0.9] tracking-[0.02em] text-white drop-shadow-[0_18px_55px_rgba(0,0,0,0.45)]">
              <span className={`block ${heroIntroClassName}`} style={heroIntroStyle(220)}>ENCONTRE O</span>
              <span className={`block whitespace-nowrap text-imesul-red ${heroIntroClassName}`} style={heroIntroStyle(340)}>MATERIAL CERTO</span>
              <span className={`block ${heroIntroClassName}`} style={heroIntroStyle(460)}>PARA SUA OBRA.</span>
            </h1>
            <p className={`mt-4 max-w-[520px] text-[0.98rem] leading-7 text-imesul-steel-light/88 sm:text-base ${heroIntroClassName}`} style={heroIntroStyle(620)}>
              Tubos, metalons, perfis, chapas, telhas e acessórios com qualidade
              garantida, entrega rápida e o suporte técnico de quem entende do assunto.
            </p>
            <p className={`mt-2 max-w-[520px] text-[0.98rem] font-semibold leading-7 text-imesul-steel-light/88 sm:text-base ${heroIntroClassName}`} style={heroIntroStyle(760)}>
              Mais de 45 anos fornecendo soluções em aço para construção,
              serralheria, indústria e campo.
            </p>

            <div className="mt-6 grid max-w-[880px] gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
              {trustItems.map((item, index) => {
                const isGlowing = heroTrustGlowIndex === index && !heroReduceMotion;

                return (
                <div
                  key={item.title}
                  className={`relative flex min-w-0 items-start gap-3 py-1 transition-[filter] duration-500 motion-reduce:transition-none ${
                    isGlowing ? "drop-shadow-[0_0_18px_rgba(212,43,43,0.16)]" : ""
                  } ${heroIntroClassName}`}
                  style={heroIntroStyle(900 + index * 90)}
                >
                  <span
                    className={`relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-imesul-red/50 bg-transparent text-imesul-red transition-[box-shadow,color,border-color] duration-500 motion-reduce:transition-none ${
                      isGlowing
                        ? "border-imesul-red/80 text-white shadow-[0_0_18px_rgba(212,43,43,0.36)]"
                        : ""
                    }`}
                  >
                    <item.icon size={17} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="relative min-w-0">
                    <strong
                      className={`block font-condensed text-[14px] font-semibold uppercase leading-none tracking-[0.075em] text-white transition-[text-shadow,color] duration-500 motion-reduce:transition-none sm:text-[15px] ${
                        isGlowing
                          ? "text-white [text-shadow:0_0_14px_rgba(255,255,255,0.26),0_0_18px_rgba(212,43,43,0.18)]"
                          : ""
                      }`}
                    >
                      {item.title}
                    </strong>
                    <span className="mt-1 block text-[13px] leading-4 text-imesul-steel-light/72">
                      {item.description}
                    </span>
                  </span>
                </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 self-center sm:grid-cols-2 lg:max-w-[560px] lg:justify-self-center">
            <button
              type="button"
              data-testid="start-project-path"
              onClick={() => {
                trackInteraction({ type: "click", label: "Tenho um projeto", section: "Hero", detail: "Card Preciso de ajuda" });
                scrollToFlow("project-path");
              }}
              className={`group relative flex min-h-[218px] cursor-pointer flex-col overflow-hidden rounded-[7px] border border-imesul-red/40 bg-[linear-gradient(145deg,rgba(212,43,43,0.13),rgba(7,16,29,0.78)_62%)] p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-md transition-[opacity,transform,border-color,background-color,box-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-imesul-red/75 hover:bg-[linear-gradient(145deg,rgba(212,43,43,0.18),rgba(7,16,29,0.86)_62%)] hover:shadow-[0_22px_60px_rgba(212,43,43,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none sm:p-6 ${heroIntroReady || heroReduceMotion ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`} style={heroIntroStyle(1280)}
            >
              <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(212,43,43,0.2),transparent_34%)]" />
              <span className="relative flex h-9 w-9 items-center justify-center rounded-[6px] border border-imesul-red/45 bg-imesul-red text-white shadow-[0_8px_22px_rgba(212,43,43,0.22)]">
                <Building2 size={18} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="relative mt-5 font-mono text-[9px] tracking-[0.24em] text-imesul-red">
                PRECISO DE
              </span>
              <strong className="relative mt-1 font-display text-[1.68rem] font-normal leading-[0.96] text-imesul-red sm:text-[1.82rem]">
                AJUDA PARA ESCOLHER
              </strong>
              <span className="relative mt-3 max-w-[220px] text-[13px] leading-5 text-imesul-steel-light/74">
                Conte com nossa equipe técnica para indicar os materiais ideais para seu projeto.
              </span>
              <span className="relative mt-auto flex items-center gap-2 pt-5 font-condensed text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                FALAR COM ESPECIALISTA
                <ArrowDownRight
                  size={16}
                  className="transition-transform duration-300 group-hover:translate-x-1 group-hover:translate-y-1"
                  aria-hidden="true"
                />
              </span>
            </button>

            <button
              type="button"
              data-testid="start-material-path"
              onClick={() => {
                trackInteraction({ type: "click", label: "Já sei o material", section: "Hero", detail: "Card Já sei o que preciso" });
                scrollToFlow("material-path");
              }}
              className={`group relative flex min-h-[218px] cursor-pointer flex-col overflow-hidden rounded-[7px] border border-white/[0.12] bg-[linear-gradient(145deg,rgba(31,66,108,0.22),rgba(7,16,29,0.76)_62%)] p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.2)] backdrop-blur-md transition-[opacity,transform,border-color,background-color,box-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-imesul-steel/50 hover:bg-[linear-gradient(145deg,rgba(31,66,108,0.28),rgba(7,16,29,0.84)_62%)] hover:shadow-[0_22px_60px_rgba(30,76,128,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-steel focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none sm:p-6 ${heroIntroReady || heroReduceMotion ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`} style={heroIntroStyle(1400)}
            >
              <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(42,92,151,0.18),transparent_34%)]" />
              <span className="relative flex h-9 w-9 items-center justify-center rounded-[6px] border border-white/[0.14] bg-[#1f5fb0]/55 text-white">
                <PackageSearch size={18} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="relative mt-5 font-mono text-[9px] tracking-[0.24em] text-imesul-steel">
                JÁ SEI
              </span>
              <strong className="relative mt-1 font-display text-[1.78rem] font-normal leading-[0.96] text-white sm:text-[1.95rem]">
                O QUE PRECISO
              </strong>
              <span className="relative mt-3 max-w-[220px] text-[13px] leading-5 text-imesul-steel-light/74">
                Encontre rapidamente o material ideal navegando pelas categorias e produtos.
              </span>
              <span className="relative mt-auto flex items-center gap-2 pt-5 font-condensed text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                IR PARA MATERIAIS
                <ArrowDownRight
                  size={16}
                  className="transition-transform duration-300 group-hover:translate-x-1 group-hover:translate-y-1"
                  aria-hidden="true"
                />
              </span>
            </button>
          </div>
        </div>
      </section>

      <section
        id="project-path"
        className="relative z-10 scroll-mt-0 border-b border-white/[0.08] bg-[#071321]/70"
      >
        <div className="mx-auto max-w-[1480px] px-6 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <header data-scroll-reveal className="grid gap-5 lg:grid-cols-[0.86fr_1.14fr] lg:items-end">
            <div>
              <h2 className="font-display text-[clamp(3.1rem,5vw,5.8rem)] leading-[0.9] text-white">
                Encontre soluções para o seu projeto
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-relaxed text-imesul-steel-light/75 sm:text-lg">
              Seja qual for o seu desafio, temos os materiais e o suporte certo
              para tornar seu projeto mais rápido, seguro e eficiente.
            </p>
          </header>

          <div className="mt-12 grid auto-rows-fr grid-cols-1 gap-5 sm:grid-cols-2 lg:mt-14 xl:grid-cols-5">
            {projectShowcaseCards.map((card, index) => {
              const project = projects.find((item) => item.id === card.projectId);
              const isSelected = card.projectId === recommendedProject?.projectId;

              return (
                <button
                  key={card.projectId}
                  type="button"
                  data-scroll-reveal
                  data-testid={`project-${card.projectId}`}
                  style={{ "--reveal-delay": `${index * 70}ms` }}
                  aria-pressed={isSelected}
                  onClick={() => showRecommendedMaterials(card)}
                  className={`group relative flex min-h-[360px] cursor-pointer flex-col overflow-hidden rounded-[8px] border bg-[#071321] text-left shadow-[0_22px_70px_rgba(0,0,0,0.22)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue ${
                    isSelected
                      ? "border-imesul-red shadow-[0_26px_80px_rgba(212,43,43,0.18)]"
                      : "border-white/[0.1] hover:-translate-y-1 hover:border-imesul-red/45"
                  }`}
                >
                  <span className="relative block h-44 overflow-hidden bg-[#0b192b]">
                    <Image
                      src={card.image}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 20vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                    />
                    <span className="absolute inset-0 bg-gradient-to-t from-[#071321] via-[#071321]/18 to-transparent" />
                    {isSelected && (
                      <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-imesul-red text-white">
                        <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="flex flex-1 flex-col p-5">
                    <strong className="font-condensed text-[1.55rem] font-semibold leading-none text-white">
                      {card.title}
                    </strong>
                    <span className="mt-3 text-sm leading-6 text-imesul-steel-light/68">
                      {card.description}
                    </span>
                    <span className="mt-auto flex items-center gap-2 pt-6 font-condensed text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                      VER MATERIAIS
                      <ArrowRight size={14} aria-hidden="true" />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {selectedProject && (
            <div className="mt-10">
              <ProjectQuoteFlow
                key={selectedProject.id}
                project={selectedProject}
                originUnit={originUnit}
                isLoggedIn={isUserVisuallyLoggedIn}
              />
            </div>
          )}
        </div>
      </section>

      <section
        id="material-path"
        className="relative z-10 scroll-mt-0 bg-[#091727]/58"
      >
        <div className="mx-auto max-w-[1480px] px-6 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <header data-scroll-reveal className="grid gap-5 lg:grid-cols-[0.86fr_1.14fr] lg:items-end">
            <div>
              <h2 className="font-display text-[clamp(3.1rem,5vw,5.8rem)] leading-[0.9] text-white">
                Navegue pelos materiais
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-relaxed text-imesul-steel-light/75 sm:text-lg">
              Uma linha completa em aço para atender todas as etapas da sua obra
              ou fabricação.
            </p>
          </header>

          <div data-scroll-reveal style={{ "--reveal-delay": "90ms" }}>
            <ProductCatalog
              selectedCategoryId={selectedCategoryId}
              selectedProductId={selectedProductId}
              recommendedProjectTitle={recommendedProject?.title}
              recommendedCategoryIds={recommendedProject?.categoryIds || []}
              onSelectCategory={selectCategory}
              onSelectProduct={selectProduct}
            />
          </div>

          {selectedProduct && (
            <div className="mt-10">
              <MaterialQuoteFlow
                key={selectedProduct.id}
                product={selectedProduct}
                originUnit={originUnit}
                isLoggedIn={isUserVisuallyLoggedIn}
              />
            </div>
          )}
        </div>
      </section>

      <SalesGuidanceSection />
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={() => setAuthVisualActive(true)}
        onAdminAuthenticated={() => {
          setAdminVisualActive(true);
          setAdminDashboardOpen(true);
        }}
      />
      <AdminDashboard
        open={adminDashboardOpen}
        onClose={() => setAdminDashboardOpen(false)}
        onLogout={() => {
          setAdminDashboardOpen(false);
          setAdminVisualActive(false);
          setAuthVisualActive(false);
          endAdminSession();
        }}
      />
    </main>
  );
}
