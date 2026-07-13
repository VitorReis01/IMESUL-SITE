// Destino comercial compartilhado pela navegacao, showroom e CTA final.
export const salesSiteUrl =
  process.env.NEXT_PUBLIC_SALES_SITE_URL || "https://grupoimesul.com.br";

// Cada produto exige ID estavel, textos, variacoes, uso, imagem e ordem visual.
// ProductScrollExperience consome todos os campos nos layouts mobile e desktop.
export const products = [
  {
    id: "tubos-metalicos",
    name: "Tubos Metálicos",
    subtitle: "Versatilidade para estruturas e fabricação",
    description:
      "Soluções para projetos que exigem resistência, precisão dimensional e acabamento consistente.",
    variations: ["Redondos", "Quadrados", "Retangulares", "Industriais"],
    principalUse: "Estruturas metálicas, serralheria, portões e aplicações industriais.",
    image: "/products/tubos-removebg-preview.webp",
    number: "01",
    tag: "SHOWROOM",
  },
  {
    id: "perfis-estruturais",
    name: "Perfis Estruturais",
    subtitle: "Resistência para projetos de maior escala",
    description:
      "Perfis conformados para compor estruturas confiáveis em obras comerciais, industriais e rurais.",
    variations: ["Perfil U simples", "U enrijecido", "Perfis conformados", "Sob consulta"],
    principalUse: "Coberturas, galpões, reforços, suportes e estruturas metálicas.",
    image: "/products/perfis.webp",
    number: "02",
    tag: "SHOWROOM",
  },
  {
    id: "telhas-metalicas",
    name: "Telhas Metálicas",
    subtitle: "Coberturas eficientes para diferentes escalas",
    description:
      "Telhas para coberturas com montagem ágil, boa durabilidade e acabamento uniforme.",
    variations: ["Trapezoidais", "Onduladas", "Galvanizadas", "Cumeeiras"],
    principalUse: "Coberturas residenciais, comerciais, industriais e rurais.",
    image: "/products/telhas.webp",
    number: "03",
    tag: "SHOWROOM",
  },
  {
    id: "chapas",
    name: "Chapas",
    subtitle: "Base versátil para corte, dobra e fabricação",
    description:
      "Chapas para diferentes níveis de exigência, do acabamento de peças à fabricação de componentes robustos.",
    variations: ["Finas a frio", "Finas a quente", "Grossas", "Chapas de piso"],
    principalUse: "Fechamentos, bases, dobra, corte, reforço e fabricação industrial.",
    image: "/products/chapas.webp",
    number: "04",
    tag: "SHOWROOM",
  },
  {
    id: "laminados",
    name: "Laminados",
    subtitle: "Matéria-prima para fabricar e reforçar",
    description:
      "Formatos essenciais para fabricação, montagem e manutenção de peças em projetos de todos os portes.",
    variations: ["Cantoneiras", "Barras chatas", "Barras redondas", "Barras quadradas"],
    principalUse: "Suportes, travamentos, reforços, grades e componentes metálicos.",
    image: "/products/cantoneiras.webp",
    number: "05",
    tag: "SHOWROOM",
  },
  {
    id: "perfis-serralheria",
    name: "Perfis para Serralheria",
    subtitle: "Perfis prontos para transformar projetos em peças",
    description:
      "Uma linha selecionada para facilitar a fabricação e entregar resultado limpo, funcional e durável.",
    variations: ["Portões", "Portas de aço", "Esquadrias", "Perfis tubulares"],
    principalUse: "Portões, grades, janelas, portas e projetos sob medida.",
    image: "/products/metalon.webp",
    number: "06",
    tag: "SHOWROOM",
  },
  {
    id: "acessorios-serralheria",
    name: "Acessórios para Serralheria",
    subtitle:
      "Roldanas, guias, fechaduras e ferragens para portões, esquadrias e estruturas metálicas.",
    description:
      "Componentes para dar movimento, segurança e acabamento às soluções produzidas em serralheria.",
    variations: [
      "Roldanas e Guias",
      "Fechaduras",
      "Ferragens",
      "Itens de Montagem",
    ],
    principalUse:
      "Montagem, movimentação, travamento e acabamento de soluções para serralheria.",
    image: "/products/acessorios-serralheria-showroom.webp",
    number: "07",
    tag: "SHOWROOM",
  },
  {
    id: "tintas-solventes-consumiveis",
    name: "Tintas, Solventes, Solda e Corte",
    subtitle: "Preparação, proteção e acabamento do aço",
    description:
      "Produtos para preparação, soldagem, corte e acabamento de estruturas metálicas.",
    variations: [
      "Tintas industriais",
      "Solventes e thinner",
      "Eletrodos de solda",
      "Discos de corte",
    ],
    principalUse: "Preparação, proteção anticorrosiva, acabamento e manutenção.",
    image: "/products/tintas-solventes-solda-corte.webp",
    number: "08",
    tag: "SHOWROOM",
  },
];

// Diferenciais exibidos por WhyChoose; o nome do icone deve existir no mapa local.
export const benefits = [
  {
    icon: "warehouse",
    title: "Grande Estoque",
    description: "Linha ampla pronta para atender obras, indústrias e serralherias com agilidade.",
    number: "01",
  },
  {
    icon: "shield",
    title: "Qualidade Garantida",
    description: "Materiais selecionados para quem precisa de resistência, acabamento e confiança.",
    number: "02",
  },
  {
    icon: "truck",
    title: "Entrega Rápida",
    description: "Logística para Campo Grande, Dourados e região com foco em continuidade da obra.",
    number: "03",
  },
  {
    icon: "headset",
    title: "Atendimento Técnico",
    description: "Equipe preparada para orientar a melhor solução em aço para cada aplicação.",
    number: "04",
  },
];

// Enderecos oficiais usados pelo rodape e pela pagina interna de links.
export const officialUnits = [
  {
    id: "dourados-matriz",
    name: "Dourados — Matriz",
    address: "Rua Pedro Rigotti, 258 – Jardim São Pedro, Dourados/MS",
    phone: "(67) 3427-5700",
    phoneHref: "tel:+556734275700",
    mapsHref: "https://maps.app.goo.gl/vse5FAdajRYdK2HA9",
  },
  {
    id: "dourados-fabrica",
    name: "Dourados — Loja de Fábrica",
    address: "Av. Marcelino Pires, 10.155 – Dourados/MS",
    phone: "(67) 3411-5700",
    phoneHref: "tel:+556734115700",
    mapsHref: "https://maps.app.goo.gl/mQS2dtnM3ZWVFUnP7",
  },
  {
    id: "campo-grande",
    name: "Campo Grande",
    address: "Av. Cel. Antonino, 1692 – Vila Lucinda, Campo Grande/MS",
    phone: "(67) 3312-5600",
    phoneHref: "tel:+556733125600",
    mapsHref: "https://maps.app.goo.gl/raaCtPNwUQMGVEQi6",
  },
];

// Perfis oficiais usados pela pagina /links, separados por unidade.
export const officialSocialLinks = {
  dourados: {
    facebook: "https://web.facebook.com/imesuldouradosms?_rdc=1&_rdr#",
    instagram: "https://www.instagram.com/imesul_dourados",
  },
  campoGrande: {
    facebook: "https://web.facebook.com/imesulcampograndems?_rdc=1&_rdr#",
    instagram: "https://www.instagram.com/imesul_campogrande",
  },
};

// Links internos usam ancora ou rota; destinos externos abrem em outra aba.
export const navLinks = [
  { label: "INÍCIO", href: "/" },
  { label: "DIFERENCIAIS", href: "/#diferenciais" },
  {
    label: "CATÁLOGO",
    href: "/catalogo/catalogo-imesul.pdf",
    external: true,
  },
  { label: "DOURADOS", href: "/#dourados" },
  {
    label: "CAMPO GRANDE",
    href: process.env.NEXT_PUBLIC_SALES_SITE_URL || salesSiteUrl,
    external: true,
  },
  { label: "LINKS", href: "/links" },
];

// Mensagem curta usada apenas pelo CTA institucional, sem dados de formulario.
export const whatsapp = {
  number: "556733125600",
  message: "Olá! Quero falar com a IMESUL para orçar.",
};
