"use client";

// Tela principal da area de vendas.
// Conecta hero, busca, carrossel, catalogo, orcamento, login e painel admin.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  ArrowDownRight,
  ArrowRight,
  Building2,
  Check,
  Headphones,
  Layers3,
  Menu,
  MapPin,
  MessageCircle,
  PackageSearch,
  Search,
  ShieldCheck,
  X,
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
import ProductShowcaseCarousel from "./ProductShowcaseCarousel";
import SalesGuidanceSection from "./SalesGuidanceSection";
import SalesTrustStrip from "./SalesTrustStrip";

// Carrega o efeito 3D somente no cliente para deixar o bundle inicial mais leve.
const SteelScrollObject = dynamic(() => import("./SteelScrollObject"), {
  ssr: false,
});

const salesUnits = {
  dourados: "Dourados",
  "campo-grande": "Campo Grande",
};

const institutionalUrl =
  process.env.NEXT_PUBLIC_INSTITUTIONAL_URL || "https://imesul-site.vercel.app/";

const sellerMessage =
  "Olá, vim pela Área de Vendas da IMESUL e quero falar com um vendedor.";

const navLinkClassName =
  "group/nav relative inline-flex origin-center items-center py-2 text-slate-800 transition-[color,transform] duration-300 hover:text-imesul-red active:scale-[0.96] motion-reduce:transform-none motion-reduce:transition-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-imesul-red after:transition-transform after:duration-300 hover:after:scale-x-100 motion-reduce:after:transition-none";

// Termos extras ajudam a busca sem alterar o cadastro oficial de produtos.
const searchAliases = {
  "telhas-metalicas": ["telha", "telhas", "telhas metalicas", "telhas metálicas", "telhado", "telhados", "cobertura", "coberturas", "terca", "terças", "cumeeira"],
  "tubos-metalicos": ["tubo", "tubos", "metalon", "metalons", "ferro", "aço", "metal", "estrutura", "portão", "serralheria"],
  laminados: ["barra", "barras", "vergalhao", "vergalhão", "ferro", "aço", "metal", "cantoneira", "cantoneiras"],
  chapas: ["chapa", "chapas", "piso", "corte", "dobra", "fechamento", "metal", "aço"],
  "chapas-frisadas-lambris": ["chapa", "chapas", "frisada", "frisadas", "meia cana", "lambril", "lambris", "portão", "fachada", "fechamento"],
  "perfis-estruturais": ["perfil", "perfis", "perfil u", "cantoneira", "cantoneiras", "estrutura", "galpão", "cobertura", "ferro", "aço"],
  "perfis-serralheria": ["perfil", "perfis", "serralheria", "portão", "portões", "porta", "portas", "janela", "janelas", "esquadria", "esquadrias"],
  "acessorios-serralheria": ["acessorio", "acessório", "acessorios", "acessórios", "fixador", "fixadores", "parafuso", "parafusos", "roldana", "roldanas", "trilho", "trilhos", "guia", "guias", "fechadura", "fechaduras", "fecho", "fechos", "dobradiça", "dobradiças", "portão", "serralheria"],
  "thinner-fixadores": ["thinner", "solvente", "solventes", "diluição", "limpeza", "pintura", "acabamento", "preparação"],
  "tintas-solventes-consumiveis": ["tinta", "tintas", "primer", "primers", "galvanizante", "galvanizantes", "consumível", "consumíveis", "disco", "discos", "corte", "solda", "eletrodo", "eletrodos", "acabamento", "proteção"],
};

const productSearchAliases = {
  "tubo-retangular": ["metalon", "metalons", "tubo", "tubos", "portão", "serralheria", "estrutura"],
  "tubo-quadrado": ["metalon", "metalons", "tubo", "tubos", "portão", "serralheria", "estrutura"],
  "tubo-redondo": ["tubo", "tubos", "corrimão", "estrutura", "suporte"],
  "perfil-u-enrijecido": ["perfil", "perfil u", "u enrijecido", "estrutura", "galpão", "cobertura"],
  "perfil-u-simples": ["perfil", "perfil u", "u simples", "estrutura", "travamento", "cobertura"],
  "telha-trapezoidal-40": ["telha", "telhado", "cobertura", "trapezoidal", "telha 40", "tp40"],
  "telha-trapezoidal-25": ["telha", "telhado", "cobertura", "trapezoidal", "telha 25", "tp25"],
  "telha-ondulada": ["telha", "telhado", "cobertura", "ondulada"],
  cumeeiras: ["telha", "telhado", "cobertura", "acabamento", "cumeeira"],
  "cantoneiras-abas-iguais": ["cantoneira", "cantoneiras", "perfil", "perfis", "reforço"],
  "barras-chatas": ["barra", "barras", "ferro chato", "barra chata"],
  "barras-quadradas": ["barra", "barras", "barra quadrada", "ferro quadrado"],
  "barras-redondas": ["barra", "barras", "barra redonda", "ferro redondo"],
  "chapas-planas": ["chapa", "chapas", "lisa", "plana", "corte", "dobra"],
  "chapas-grossas": ["chapa", "chapas", "grossa", "corte", "estrutura"],
  "chapas-finas-frio": ["chapa", "chapas", "fina", "frio", "dobras"],
  "chapas-finas-quente": ["chapa", "chapas", "fina", "quente", "dobras"],
  "chapas-piso": ["chapa", "chapas", "piso", "xadrez"],
  "chapas-frisadas-u": ["chapa", "chapas", "frisada", "frisadas", "portão", "fechamento"],
  "chapa-meia-cana-1090": ["chapa", "chapas", "meia cana", "portão", "fechamento"],
  "chapa-meia-cana-545": ["chapa", "chapas", "meia cana", "portão", "fechamento"],
  lambris: ["lambril", "lambris", "chapa", "fachada", "fechamento"],
  "perfis-portoes-elevacao": ["perfil", "perfis", "portão", "portões", "elevação", "basculante"],
  "perfis-portas-aco": ["perfil", "perfis", "porta", "portas", "aço", "esquadria"],
  "perfis-janelas-aco": ["perfil", "perfis", "janela", "janelas", "aço", "esquadria"],
  roldanas: ["roldana", "roldanas", "portão", "deslizante"],
  trilhos: ["trilho", "trilhos", "guia", "guias", "portão", "deslizante"],
  fechos: ["fecho", "fechos", "trava", "travas", "portão"],
  dobradicas: ["dobradiça", "dobradiças", "portão", "porta"],
  guias: ["guia", "guias", "trilho", "trilhos", "portão"],
  parafusos: ["parafuso", "parafusos", "fixador", "fixadores", "montagem"],
  fechaduras: ["fechadura", "fechaduras", "portão", "porta", "segurança"],
  solventes: ["solvente", "solventes", "thinner", "limpeza", "diluição"],
  thinner: ["thinner", "solvente", "solventes", "limpeza", "diluição", "pintura"],
};

const relatedSearchTerms = {
  telhado: ["telha", "cobertura"],
  telhados: ["telha", "cobertura"],
  cobertura: ["telha", "telhado", "cumeeira"],
  coberturas: ["telha", "telhado", "cumeeira"],
  portao: ["portão", "perfis", "roldanas", "trilhos", "fechaduras", "acessorios"],
  portão: ["portao", "perfis", "roldanas", "trilhos", "fechaduras", "acessórios"],
  portoes: ["portão", "perfis", "roldanas", "trilhos", "fechaduras"],
  portões: ["portao", "perfis", "roldanas", "trilhos", "fechaduras"],
  serralheria: ["perfis", "acessórios", "tubos", "chapas"],
  ferro: ["aço", "tubo", "perfil", "chapa", "barra"],
  aco: ["aço", "tubo", "perfil", "chapa", "barra"],
  aço: ["aco", "tubo", "perfil", "chapa", "barra"],
  metal: ["tubo", "perfil", "chapa", "barra"],
  metalon: ["tubo", "tubos"],
  solvente: ["solventes", "thinner", "limpeza"],
  solventes: ["solvente", "thinner", "limpeza"],
};
const normalizeSearch = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const getSearchTokens = (value) =>
  normalizeSearch(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const expandSearchQuery = (value) => {
  const normalized = normalizeSearch(value.trim());
  const tokens = getSearchTokens(value);
  const relatedTerms = tokens.flatMap((token) => relatedSearchTerms[token] || []);

  return Array.from(new Set([normalized, ...tokens, ...relatedTerms.map(normalizeSearch)].filter(Boolean)));
};

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
    description: "Perfis, tubos e chapas usados em bases, reforços e montagens metálicas.",
    image: "/images/vendas/projetos/estruturas-metalicas.webp",
    recommendedCategoryIds: [
      "perfis-estruturais",
      "tubos-metalicos",
      "chapas",
      "laminados",
    ],
  },
  {
    projectId: "cobertura",
    title: "Coberturas e Telhados",
    description: "Telhas, perfis e fixadores para montar ou reformar coberturas.",
    image: "/images/vendas/projetos/cobertimento-e-telhados.webp",
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
    description: "Itens usados em portões, grades, esquadrias e serviços de acabamento.",
    image: "/images/vendas/projetos/serralheria-e-acabamentos.webp",
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
    description: "Chapas, tubos, perfis e acessórios para manutenção e reforços.",
    image: "/images/vendas/projetos/industria-e-manutencao.webp",
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
    description: "Produtos para barracões, cercas, currais e manutenção no campo.",
    image: "/images/vendas/projetos/linha-rural-e-campo.webp",
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
  const [highlightedProjectId, setHighlightedProjectId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [highlightedCategoryId, setHighlightedCategoryId] = useState(null);
  const [highlightedProductId, setHighlightedProductId] = useState(null);
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navbarHidden, setNavbarHidden] = useState(false);
  const searchRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const navbarHiddenRef = useRef(false);
  const carouselScrollTimeoutRef = useRef(null);
  const highlightTimeoutRef = useRef(null);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedProduct = getCatalogProduct(selectedProductId);
  const sellerWhatsAppUrl = createWhatsAppUrl(sellerMessage);

  const isUserVisuallyLoggedIn = authVisualActive || adminVisualActive;

  // Padroniza eventos comerciais antes de enviar para o analytics local.
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
      keywords: [product.name, product.description, ...(product.usage || []), ...(productSearchAliases[product.id] || [])],
    }));

    return [...categoryItems, ...productItems];
  }, []);

  const searchSuggestions = useMemo(() => {
    const queryTerms = expandSearchQuery(searchTerm);
    if (!queryTerms.length) return [];

    return searchItems
      .map((item) => {
        const haystack = item.keywords.map(normalizeSearch);
        const title = normalizeSearch(item.title);
        const directTitleMatch = queryTerms.some((query) => title === query || title.includes(query));
        const startsWithScore = queryTerms.some((query) =>
          haystack.some((value) => value.split(/\s+/).some((word) => word.startsWith(query)))
        );
        const includesScore = queryTerms.some((query) =>
          haystack.some((value) => value.includes(query))
        );

        if (!directTitleMatch && !startsWithScore && !includesScore) return null;
        return {
          ...item,
          score: directTitleMatch ? 0 : startsWithScore ? 1 : 2,
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        if (left.score !== right.score) return left.score - right.score;
        if (left.type !== right.type) return left.type === "product" ? -1 : 1;
        return left.title.localeCompare(right.title);
      })
      .slice(0, 6);
  }, [searchItems, searchTerm]);

  // Captura a unidade enviada pelo site institucional e mantém o dado no fluxo comercial.
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
      const resultCount = searchSuggestions.length;
      trackInteraction({
        type: "search",
        label: resultCount ? "Pesquisa realizada com resultado" : "Pesquisa sem resultado",
        section: "Busca do topo",
        detail: `${query} / ${resultCount} resultado${resultCount === 1 ? "" : "s"}`,
      });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [searchSuggestions.length, searchTerm, trackInteraction]);

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

  // Controla o menu mobile sem alterar a navegacao desktop nem a busca do topo.
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handlePointerDown = (event) => {
      if (!mobileMenuRef.current?.contains(event.target)) setMobileMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  // Esconde o topo branco no scroll usando rAF e atualizando estado apenas quando muda.
  useEffect(() => {
    let frameId = 0;

    const handleScroll = () => {
      if (frameId) return;

      frameId = window.requestAnimationFrame(() => {
        const nextHidden = window.scrollY > 56;
        if (navbarHiddenRef.current !== nextHidden) {
          navbarHiddenRef.current = nextHidden;
          setNavbarHidden(nextHidden);
        }
        frameId = 0;
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frameId) window.cancelAnimationFrame(frameId);
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

  // Revela os blocos abaixo da hero uma vez e mantém o conteúdo estável durante o scroll.
  useEffect(() => {
    document.body.classList.add("reveal-motion-ready");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      const revealElements = Array.from(document.querySelectorAll("[data-scroll-reveal]"));
      revealElements.forEach((element) => element.classList.add("is-visible"));
      return () => document.body.classList.remove("reveal-motion-ready");
    }

    let visibleCount = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          visibleCount += 1;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );

    const observedElements = new WeakSet();
    const observeRevealElements = (root = document) => {
      root.querySelectorAll("[data-scroll-reveal]").forEach((element) => {
        if (observedElements.has(element)) return;
        observedElements.add(element);
        observer.observe(element);
      });
    };

    observeRevealElements();
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          if (node.matches?.("[data-scroll-reveal]")) {
            if (!observedElements.has(node)) {
              observedElements.add(node);
              observer.observe(node);
            }
          }
          observeRevealElements(node);
        });
      });
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    // Fallback de producao: se o observer nao disparar, evita secoes invisiveis no site publicado.
    const visibilityFallback = window.setTimeout(() => {
      if (visibleCount > 0) return;
      document.querySelectorAll("[data-scroll-reveal]").forEach((element) => {
        element.classList.add("is-visible");
      });
    }, 2200);

    return () => {
      window.clearTimeout(visibilityFallback);
      document.body.classList.remove("reveal-motion-ready");
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, []);

  // Limpa timers de navegação acionados pelo carrossel quando a página desmonta.
  useEffect(() => () => {
    if (carouselScrollTimeoutRef.current) window.clearTimeout(carouselScrollTimeoutRef.current);
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
  }, []);

  // Aguarda a renderizacao do bloco escolhido antes de leva-lo para a viewport.
  const scrollToFlow = (id, attempt = 0) => {
    window.requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (!target && attempt < 8) {
        window.setTimeout(() => scrollToFlow(id, attempt + 1), 60);
        return;
      }

      target?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  // Mostra confirmacao visual curta quando uma categoria ou produto e escolhido.
  const triggerSelectionFeedback = ({ projectId = null, categoryId = null, productId = null }) => {
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    setHighlightedProjectId(projectId);
    setHighlightedCategoryId(categoryId);
    setHighlightedProductId(productId);
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedProjectId(null);
      setHighlightedCategoryId(null);
      setHighlightedProductId(null);
    }, 3200);
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
    triggerSelectionFeedback({ projectId });
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
    triggerSelectionFeedback({ projectId: card.projectId });
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
    triggerSelectionFeedback({ categoryId });

    // Clicar num card so e possivel com a grade de categorias ja visivel na tela, entao
    // nesse caso nunca rolamos a pagina: a troca fica so no estado/destaque selecionado.
    // So rolamos quando a selecao vem de fora da tela (ex.: sugestao da busca do topo),
    // caso em que a grade ainda nao esta visivel para o usuario.
    const anyCategoryCard = document.querySelector('[data-testid^="category-"]');
    const cardRect = anyCategoryCard?.getBoundingClientRect();
    const gridAlreadyVisible = Boolean(
      cardRect && cardRect.bottom > 0 && cardRect.top < window.innerHeight
    );

    if (!gridAlreadyVisible) {
      scrollToFlow("material-path");
    }
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
    if (product?.categoryId) {
      setSelectedCategoryId(product.categoryId);
    }
    setSelectedProductId(productId);
    setSelectedProjectId(null);
    setRecommendedProject(null);
    triggerSelectionFeedback({ categoryId: product?.categoryId || null, productId });
    scrollToFlow("material-quote-flow");
  };

  // O carrossel entrega categoria e produto validados para evitar clique sem destino.
  const selectCarouselProduct = (product) => {
    const target = product.target || {};
    const targetCategoryId = target.categoryId || product.categoryId;
    const exactProduct = target.productId ? getCatalogProduct(target.productId) : null;
    const category = catalogCategories.find((item) => item.id === targetCategoryId);

    if (!category) return;

    trackInteraction({
      type: "click",
      label: "Destino do carrossel",
      section: "Produtos do catálogo IMESUL",
      detail: `${category.name} / ${target.productName || product.name} / ${exactProduct ? "produto exato" : "fallback de categoria"}`,
    });
    setSelectedCategoryId(targetCategoryId);
    setSelectedProductId(exactProduct ? exactProduct.id : null);
    triggerSelectionFeedback({
      categoryId: targetCategoryId,
      productId: exactProduct ? exactProduct.id : null,
    });
    setSelectedProjectId(null);
    setRecommendedProject(null);
    scrollToFlow("material-path");
    if (carouselScrollTimeoutRef.current) window.clearTimeout(carouselScrollTimeoutRef.current);
    carouselScrollTimeoutRef.current = window.setTimeout(() => {
      scrollToFlow(exactProduct ? "material-quote-flow" : "catalog-products");
    }, 260);
  };

  // Usa a mesma selecao dos cards para levar a sugestao ate o fluxo correto.
  const selectSearchSuggestion = (suggestion) => {
    trackInteraction({
      type: "search",
      label: "Sugestão clicada",
      section: "Busca do topo",
      detail: `${searchTerm.trim()} -> ${suggestion.title} (${suggestion.type === "product" ? "produto" : "categoria"})`,
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
  const shouldHideNavbar = navbarHidden && !mobileMenuOpen && !heroReduceMotion;
  const mobileMenuLinkClassName =
    "flex min-h-12 items-center justify-between rounded-[7px] border border-white/[0.11] bg-[#0b1b2d] px-4 font-condensed text-[15px] font-bold uppercase tracking-[0.12em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors hover:border-imesul-red/55 hover:bg-[#10233a]";
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06101d]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(212,43,43,0.11),transparent_24%),radial-gradient(circle_at_88%_46%,rgba(42,92,151,0.14),transparent_30%),linear-gradient(180deg,#06101d_0%,#0a1727_48%,#06101d_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.055] [background-image:linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />

      <header
        ref={mobileMenuRef}
        className={`sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl transition-[opacity,transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none ${
          shouldHideNavbar ? "pointer-events-none -translate-y-full opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <div className="mx-auto flex h-[64px] max-w-[1480px] items-center justify-between gap-2 px-4 sm:gap-4 sm:px-8 lg:px-12">
          <span className="relative inline-flex max-h-[54px] shrink-0 items-center">
            <Image
              src="/images/logo-imesul-oficial.png"
              alt="IMESUL Distribuição"
              width={1600}
              height={477}
              priority
              className="relative h-auto max-h-[44px] w-[132px] object-contain sm:max-h-[48px] sm:w-[174px]"
            />
          </span>
          <nav
            className="hidden items-center gap-5 font-condensed text-[13px] font-semibold uppercase tracking-[0.12em] xl:flex"
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
              Catálogo
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
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div ref={searchRef} className="relative flex min-w-0">
              <label className="flex h-10 w-[min(42vw,180px)] items-center gap-2 rounded-[5px] border border-slate-200 bg-slate-50 px-2.5 text-slate-500 min-[390px]:w-[min(46vw,210px)] sm:w-[270px] sm:px-3">
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
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
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
                      Não encontramos esse item no catálogo. Tente buscar por tubo, chapa, telha, perfil, barra, parafuso ou acessório.
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
              className="group/login hidden h-10 items-center justify-center gap-2 rounded-[5px] border border-slate-200 bg-white px-3 font-condensed text-[12px] font-bold uppercase tracking-[0.13em] text-slate-800 transition-[background-color,border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-imesul-red/55 hover:bg-slate-50 hover:text-imesul-red hover:shadow-[0_10px_26px_rgba(15,23,42,0.08)] active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none xl:inline-flex sm:px-4"
            >
              <span className="hidden sm:inline">
                {adminVisualActive ? "Conta ativa" : authVisualActive ? "Conta ativa" : "Fazer login"}
              </span>
              <span className="sm:hidden">
                {adminVisualActive ? "Conta" : authVisualActive ? "Conta" : "Login"}
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
              className="group/seller hidden h-10 items-center justify-center gap-2 rounded-[5px] border border-imesul-red bg-imesul-red px-4 font-condensed text-[12px] font-bold uppercase tracking-[0.13em] text-white shadow-[0_0_0_rgba(37,211,102,0)] transition-[background-color,border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-[#25D366] hover:bg-[#25D366] hover:text-white hover:shadow-[0_0_24px_rgba(37,211,102,0.28),0_0_12px_rgba(255,255,255,0.10)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/25 active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none xl:inline-flex"
            >
              <MessageCircle
                size={15}
                strokeWidth={2}
                className="text-white transition-[filter,color,transform] duration-300 group-hover/seller:text-white group-hover/seller:drop-shadow-[0_0_8px_rgba(255,255,255,0.34)] group-active/seller:scale-110 motion-reduce:transform-none motion-reduce:transition-none"
                aria-hidden="true"
              />
              Falar com vendedor
            </a>
            <button
              type="button"
              aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-sales-menu"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border border-slate-200 bg-slate-50 text-slate-900 transition-colors hover:border-imesul-red/55 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red xl:hidden"
            >
              {mobileMenuOpen ? <X size={20} strokeWidth={2.2} aria-hidden="true" /> : <Menu size={22} strokeWidth={2.2} aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div
          className={`fixed inset-x-0 top-[64px] z-[120] h-[calc(100dvh-64px)] bg-[rgba(0,0,0,0.72)] transition-[opacity,visibility] duration-300 xl:hidden ${
            mobileMenuOpen ? "visible opacity-100" : "invisible opacity-0"
          }`}
          aria-hidden="true"
        />
        <div
          id="mobile-sales-menu"
          className={`fixed inset-x-0 top-[64px] z-[130] max-h-[calc(100dvh-64px)] overflow-y-auto border-b border-imesul-red/25 bg-[#050b14] px-4 pb-6 pt-4 shadow-[0_28px_90px_rgba(0,0,0,0.72)] transition-[opacity,transform,visibility] duration-300 xl:hidden ${
            mobileMenuOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-4 opacity-0"
          }`}
        >
          <nav className="mx-auto grid max-w-[520px] gap-2 rounded-[10px] border border-white/[0.08] bg-[#071321] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" aria-label="Menu mobile">
            <a
              href="#project-path"
              onClick={() => {
                trackInteraction({ type: "click", label: "Projetos", section: "Navbar mobile" });
                closeMobileMenu();
              }}
              className={mobileMenuLinkClassName}
            >
              Projetos
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a
              href="#material-path"
              onClick={() => {
                trackInteraction({ type: "click", label: "Materiais", section: "Navbar mobile" });
                closeMobileMenu();
              }}
              className={mobileMenuLinkClassName}
            >
              Materiais
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a
              href="/catalogo/catalogo-imesul.pdf"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackInteraction({ type: "click", label: "Catálogo", section: "Navbar mobile", detail: "PDF catálogo IMESUL" });
                closeMobileMenu();
              }}
              className={mobileMenuLinkClassName}
            >
              Catálogo
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a
              href={institutionalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackInteraction({ type: "click", label: "Sobre a Imesul", section: "Navbar mobile", detail: institutionalUrl });
                closeMobileMenu();
              }}
              className={mobileMenuLinkClassName}
            >
              Sobre a Imesul
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a
              href={sellerWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackInteraction({ type: "whatsapp", label: "Contato/WhatsApp", section: "Navbar mobile", detail: "Contato" });
                closeMobileMenu();
              }}
              className={mobileMenuLinkClassName}
            >
              Contato
              <MessageCircle size={16} aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => {
                closeMobileMenu();
                if (adminVisualActive) {
                  setAdminDashboardOpen(true);
                  return;
                }
                setAuthModalOpen(true);
              }}
              className={mobileMenuLinkClassName}
            >
              Fazer Login
              {isUserVisuallyLoggedIn ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#25D366] text-[#04110a]">
                  <Check size={13} strokeWidth={3} aria-hidden="true" />
                </span>
              ) : (
                <ArrowRight size={16} aria-hidden="true" />
              )}
            </button>
            <a
              href={sellerWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackInteraction({ type: "whatsapp", label: "Falar com vendedor", section: "Navbar mobile", detail: "Botão menu mobile" });
                closeMobileMenu();
              }}
              className="mt-1 flex min-h-12 items-center justify-center gap-2 rounded-[7px] border border-[#25D366]/50 bg-[#25D366] px-4 font-condensed text-[15px] font-bold uppercase tracking-[0.12em] text-white shadow-[0_16px_42px_rgba(37,211,102,0.22)]"
            >
              <MessageCircle size={17} aria-hidden="true" />
              Falar com vendedor
            </a>
          </nav>
        </div>
      </header>

      <section className="relative z-10 overflow-hidden border-b border-white/[0.08]">
        {!heroReduceMotion && (
          <video
            className="pointer-events-none absolute inset-0 hidden h-full w-full object-cover motion-safe:block motion-reduce:hidden"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
          >
            <source src="/videos/fundo-animado-hero.webm" type="video/webm" />
            <source src="/videos/fundo-animado-hero.mp4" type="video/mp4" />
          </video>
        )}
        <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(5,11,20,0.9)_0%,rgba(5,11,20,0.68)_44%,rgba(5,11,20,0.55)_100%)] motion-safe:block motion-reduce:hidden" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(212,43,43,0.14),transparent_28%),radial-gradient(circle_at_78%_32%,rgba(42,92,151,0.15),transparent_36%),linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.46))]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#06101d] via-[#06101d]/52 to-transparent" />

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-64px)] max-w-[1480px] items-center gap-8 px-6 py-10 sm:px-8 sm:py-12 lg:grid-cols-[0.93fr_1.07fr] lg:px-12 lg:py-12">
          <div className="max-w-[660px] text-left">
            <div className={`flex max-w-[560px] items-center gap-4 ${heroIntroClassName}`} style={heroIntroStyle(80)}>
              <span className="font-mono text-[10px] tracking-[0.4em] text-imesul-red">
                IMESUL VENDAS
              </span>
              <span className="h-px w-14 bg-imesul-red" />
            </div>

            <h1 className="mt-4 max-w-[640px] text-balance font-display text-[clamp(2.55rem,4.75vw,5.35rem)] leading-[0.9] tracking-[0.02em] text-white drop-shadow-[0_18px_55px_rgba(0,0,0,0.45)]">
              <span className={`block ${heroIntroClassName}`} style={heroIntroStyle(220)}>ENCONTRE O</span>
              <span className={`block whitespace-nowrap text-imesul-red ${heroIntroClassName}`} style={heroIntroStyle(340)}>MATERIAL CERTO</span>
              <span className={`block ${heroIntroClassName}`} style={heroIntroStyle(460)}>PARA SUA OBRA.</span>
            </h1>
            <p className={`mt-5 max-w-[560px] text-[0.98rem] leading-7 text-imesul-steel-light/88 sm:text-base lg:text-justify ${heroIntroClassName}`} style={heroIntroStyle(620)}>
              Tubos, metalons, perfis, chapas, telhas e acessórios com qualidade
              garantida, entrega rápida e o suporte técnico de quem entende do assunto.
            </p>
            <p className={`mt-3 max-w-[560px] text-[0.98rem] font-semibold leading-7 text-imesul-steel-light/88 sm:text-base lg:text-justify ${heroIntroClassName}`} style={heroIntroStyle(760)}>
              Mais de 45 anos fornecendo materiais em aço para construção,
              serralheria, indústria e campo.
            </p>

            <div className="mt-7 grid max-w-[640px] gap-x-5 gap-y-4 sm:grid-cols-2 xl:max-w-[760px] xl:grid-cols-4">
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
              className={`premium-soft-sheen group relative flex min-h-[218px] cursor-pointer flex-col overflow-hidden rounded-[7px] border border-imesul-red/40 bg-[linear-gradient(145deg,rgba(212,43,43,0.12),rgba(7,16,29,0.78)_62%)] p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.2)] backdrop-blur-md transition-[opacity,transform,border-color,background-color,box-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform hover:-translate-y-0.5 hover:scale-[1.01] hover:border-imesul-red/65 hover:bg-[linear-gradient(145deg,rgba(212,43,43,0.15),rgba(7,16,29,0.84)_62%)] hover:shadow-[0_20px_58px_rgba(212,43,43,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none sm:p-6 ${heroIntroReady || heroReduceMotion ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`} style={heroIntroStyle(1280)}
            >
              <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(212,43,43,0.13),transparent_36%)]" />
              <span className="relative flex h-9 w-9 items-center justify-center rounded-[6px] border border-imesul-red/45 bg-imesul-red text-white shadow-[0_8px_22px_rgba(212,43,43,0.22)]">
                <Building2 size={18} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="relative mt-5 font-mono text-[11px] font-semibold tracking-[0.18em] text-imesul-red sm:text-[12px]">
                PRECISO DE
              </span>
              <strong className="relative mt-1 font-display text-[1.68rem] font-normal leading-[0.96] text-imesul-red sm:text-[1.82rem]">
                AJUDA PARA ESCOLHER
              </strong>
              <span className="relative mt-3 max-w-[220px] text-[13px] leading-5 text-imesul-steel-light/74">
                Conte com nossa equipe técnica para indicar materiais para seu projeto.
              </span>
              <span className="relative mt-auto flex items-center gap-2 pt-5 font-condensed text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                FALAR COM A EQUIPE
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
              className={`premium-soft-sheen group relative flex min-h-[218px] cursor-pointer flex-col overflow-hidden rounded-[7px] border border-white/[0.12] bg-[linear-gradient(145deg,rgba(31,66,108,0.20),rgba(7,16,29,0.76)_62%)] p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.19)] backdrop-blur-md transition-[opacity,transform,border-color,background-color,box-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform hover:-translate-y-0.5 hover:scale-[1.01] hover:border-imesul-steel/45 hover:bg-[linear-gradient(145deg,rgba(31,66,108,0.24),rgba(7,16,29,0.82)_62%)] hover:shadow-[0_20px_58px_rgba(30,76,128,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-steel focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none sm:p-6 ${heroIntroReady || heroReduceMotion ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`} style={heroIntroStyle(1400)}
            >
              <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(42,92,151,0.12),transparent_36%)]" />
              <span className="relative flex h-9 w-9 items-center justify-center rounded-[6px] border border-white/[0.14] bg-[#1f5fb0]/55 text-white">
                <PackageSearch size={18} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="relative mt-5 font-mono text-[11px] font-semibold tracking-[0.18em] text-imesul-steel sm:text-[12px]">
                JÁ SEI
              </span>
              <strong className="relative mt-1 font-display text-[1.78rem] font-normal leading-[0.96] text-white sm:text-[1.95rem]">
                O QUE PRECISO
              </strong>
              <span className="relative mt-3 max-w-[220px] text-[13px] leading-5 text-imesul-steel-light/74">
                Encontre rapidamente materiais por categoria e produto.
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

      <SteelScrollObject />

      <section
        id="project-path"
        className="relative scroll-mt-0 border-b border-white/[0.08] bg-[#071321]/70"
      >
        <div className="relative z-20 mx-auto max-w-[1480px] px-6 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <header data-scroll-reveal className="grid gap-5 lg:grid-cols-[0.86fr_1.14fr] lg:items-end">
            <div>
              <h2 className="font-display text-[clamp(3.1rem,5vw,5.8rem)] leading-[0.9] text-white">
                Encontre materiais para o seu projeto
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
              const isHighlighted = card.projectId === highlightedProjectId;

              return (
                <button
                  key={card.projectId}
                  type="button"
                  data-scroll-reveal
                  data-testid={`project-${card.projectId}`}
                  style={{ "--reveal-delay": `${index * 70}ms` }}
                  aria-pressed={isSelected}
                  aria-label={`Ver materiais indicados para ${card.title}`}
                  onClick={() => showRecommendedMaterials(card)}
                  className={`group relative flex min-h-[360px] cursor-pointer flex-col overflow-hidden rounded-[8px] border bg-[#071321] text-left shadow-[0_20px_62px_rgba(0,0,0,0.2)] transition-all duration-300 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-imesul-red focus-visible:ring-offset-2 focus-visible:ring-offset-imesul-blue ${
                    isSelected
                      ? "border-[#f0c776]/80 shadow-[0_22px_66px_rgba(240,199,118,0.12)]"
                      : "border-white/[0.1] hover:-translate-y-0.5 hover:border-imesul-red/42 hover:shadow-[0_22px_68px_rgba(212,43,43,0.09),inset_0_1px_0_rgba(255,255,255,0.045)]"
                  } ${isHighlighted ? "selection-feedback-pulse ring-2 ring-[#f0c776]/70 ring-offset-2 ring-offset-[#071321]" : ""}`}
                >
                  <span className="relative block h-44 overflow-hidden bg-[#0b192b]">
                    <Image
                      src={card.image}
                      alt={card.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 20vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
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
                      <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
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

      <ProductShowcaseCarousel
        onSelectProduct={selectCarouselProduct}
        onTrackInteraction={trackInteraction}
      />

      <section
        id="material-path"
        className="relative scroll-mt-0 bg-[#091727]/58"
      >
        <div className="relative z-20 mx-auto max-w-[1480px] px-6 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
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
              highlightedCategoryId={highlightedCategoryId}
              highlightedProductId={highlightedProductId}
              recommendedProjectTitle={recommendedProject?.title}
              recommendedCategoryIds={recommendedProject?.categoryIds || []}
              onSelectCategory={selectCategory}
              onSelectProduct={selectProduct}
            />
          </div>

          {selectedProduct && (
            <div className={`mt-10 rounded-[10px] ${highlightedProductId === selectedProduct.id ? "selection-feedback-pulse" : ""}`}>
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

      <SalesTrustStrip />
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


