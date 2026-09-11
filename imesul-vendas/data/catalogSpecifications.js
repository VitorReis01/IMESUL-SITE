// Tabelas tecnicas do catalogo, atualizadas a partir da lista da vendedora
// (PDF BRN30055CB0C945_078224.pdf, 7 paginas, levantamento comercial atual - fonte de verdade
// para medida/espessura-chapa/comprimento).
// ProductOptionSelector usa estes dados para montar as combinacoes validas de cada produto.
//
// PESO: por decisao comercial (o peso passou a ser informado pelo vendedor durante o
// atendimento, nao mais publicado no site), este arquivo NAO guarda mais peso/kg em nenhuma
// combinacao - nem os valores antigos, nem os "PESO UN" do PDF novo. O helper "weightedRows" que
// existia para isso foi removido (ficaria sem nenhum uso depois desta correcao); toda combinacao
// agora usa "confirmedRows", que so aceita medida + espessura (chapa/fracao) + comprimento
// opcional, nunca peso.
//
// Remove repeticoes sem descartar zero, que pode ser um valor tecnico valido.
const unique = (values) => [...new Set(values.filter((value) => value !== undefined && value !== null))];

// Deriva listas de selecao a partir das variacoes extraidas do catalogo.
const buildSpecs = (
  rows,
  {
    comprimentos = [],
    unidadeMedida = "mm",
    paginaFonte,
    dadosCompletos = true,
    observacao = "",
    observacoesTecnicas = [],
  } = {}
) => ({
  medidas: unique(rows.map((row) => row.medida)),
  espessuras: unique(rows.map((row) => row.espessura)),
  comprimentos: unique([
    ...comprimentos,
    ...rows.map((row) => row.comprimento),
  ]),
  variacoes: rows,
  unidadeMedida,
  paginaFonte,
  dadosCompletos,
  observacao,
  observacoesTecnicas,
});

// Mantem combinacoes confirmadas (medida + espessura/chapa + comprimento opcional) sem inventar
// peso ou qualquer dado nao presente na lista da vendedora. Cada linha e tratada como indivisivel
// - nunca cruza medida de uma linha com espessura de outra.
const confirmedRows = (rows) =>
  rows.map(([medida, espessura, comprimento]) => ({
    medida,
    ...(espessura !== null && espessura !== undefined ? { espessura } : {}),
    ...(comprimento !== null && comprimento !== undefined ? { comprimento } : {}),
  }));

// Marca produtos sem leitura confiavel para manter o preenchimento livre.
const incompleteSpecs = (paginaFonte, observacao) => ({
  medidas: [],
  espessuras: [],
  comprimentos: [],
  variacoes: [],
  paginaFonte,
  dadosCompletos: false,
  observacao,
  observacoesTecnicas: [],
});

// Fonte unica de medidas, espessuras e comprimentos publicados no fluxo.
// Nao adicione valores que nao estejam confirmados na lista comercial atual.
export const catalogSpecifications = {
  tubosMetalicos: {
    // TUBO RET (lista da vendedora, paginas 2-3) - chapa em numero de bitola (#XX), como o
    // proprio catalogo nomeia; nunca convertido para milimetro (nao ha conversao declarada na
    // lista). "16x30" (medida antiga) nao consta mais - removida.
    retangular: buildSpecs(
      confirmedRows([
        ["20x30", "#16"], ["20x30", "#18"], ["20x30", "#20"], ["20x30", "#22"],
        ["20x40", "#18"], ["20x40", "#20"],
        ["20x50", "#18"], ["20x50", "#20"],
        ["30x40", "#18"], ["30x40", "#20"],
        ["30x50", "#14"], ["30x50", "#16"], ["30x50", "#18"], ["30x50", "#20"],
        ["30x70", "#18"],
        ["40x60", "#14"], ["40x60", "#16"], ["40x60", "#18"],
        ["40x80", "#14"], ["40x80", "#16"], ["40x80", "#18"],
        ["40x100", "#14"], ["40x100", "#16"],
        ["50x150", "#16"],
      ]),
      { paginaFonte: "lista-vendedora-p2-p3", observacao: "Chapa em numero de bitola (#XX), como consta na lista comercial atual. Peso informado pelo vendedor durante o atendimento." }
    ),
    // TUBO QUAD (paginas 1-2).
    quadrado: buildSpecs(
      confirmedRows([
        ["15x15", "#18"], ["15x15", "#20"], ["15x15", "#22"],
        ["20x20", "#18"], ["20x20", "#20"], ["20x20", "#22"],
        ["30x30", "#18"], ["30x30", "#20"],
        ["40x40", "#14"], ["40x40", "#16"], ["40x40", "#18"], ["40x40", "#20"],
        ["50x50", "#14"], ["50x50", "#16"], ["50x50", "#18"],
        ["60x60", "#14"], ["60x60", "#16"], ["60x60", "#18"],
        ["80x80", "#14"], ["80x80", "#16"], ["80x80", "#18"],
        ["100x100", "#14"], ["100x100", "#16"],
      ]),
      { paginaFonte: "lista-vendedora-p1-p2", observacao: "Chapa em numero de bitola (#XX), como consta na lista comercial atual. Peso informado pelo vendedor durante o atendimento." }
    ),
    // TUBO RED (pagina 2). "1 3/4"" (medida antiga) nao consta mais na lista - removida.
    redondo: buildSpecs(
      confirmedRows([
        ['5/8"', "#18"], ['5/8"', "#20"],
        ['3/4"', "#18"], ['3/4"', "#20"],
        ['7/8"', "#18"], ['7/8"', "#20"],
        ['1"', "#14"], ['1"', "#16"], ['1"', "#18"], ['1"', "#20"],
        ['1.1/4"', "#14"], ['1.1/4"', "#16"], ['1.1/4"', "#18"], ['1.1/4"', "#20"],
        ['1.1/2"', "#14"], ['1.1/2"', "#16"], ['1.1/2"', "#18"], ['1.1/2"', "#20"],
        ['2"', "#14"], ['2"', "#16"], ['2"', "#18"], ['2"', "#20"],
        ['2.1/2"', "#14"], ['2.1/2"', "#16"], ['2.1/2"', "#18"],
        ['3"', "#14"], ['3"', "#16"], ['3"', "#18"],
        ['4"', "#14"], ['4"', "#16"],
      ]),
      { paginaFonte: "lista-vendedora-p2", unidadeMedida: "polegadas", observacao: "Chapa em numero de bitola (#XX), como consta na lista comercial atual. Peso informado pelo vendedor durante o atendimento." }
    ),
  },

  perfisEstruturais: {
    // PERFIL U ENRIJ (pagina 1) - familias e chapas exatamente como na lista da vendedora.
    // 200x75 tem duas variacoes distintas de aba (20 e 25), cada uma com uma unica chapa
    // confirmada - nao cruzar (200x75x20 so existe em #13; 200x75x25 so existe em #14).
    uEnrijecido: buildSpecs(
      confirmedRows([
        ["50x25x13", "#13"], ["50x25x13", "#14"],
        ["75x40x20", "#12"], ["75x40x20", "#13"], ["75x40x20", "#14"],
        ["100x40x20", "#12"], ["100x40x20", "#13"], ["100x40x20", "#14"],
        ["127x50x20", "#11"], ["127x50x20", "#12"], ["127x50x20", "#13"], ["127x50x20", "#14"],
        ["150x50x20", "#11"], ["150x50x20", "#12"], ["150x50x20", "#13"], ["150x50x20", "#14"],
        ["200x75x20", "#13"],
        ["200x75x25", "#14"],
      ]),
      { paginaFonte: "lista-vendedora-p1", observacao: "Chapa em numero de bitola (#XX), como consta na lista comercial atual. Peso informado pelo vendedor durante o atendimento." }
    ),
    // PERFIL U SIMPLES (pagina 1).
    uSimples: buildSpecs(
      confirmedRows([
        ["50x25", "#13"], ["50x25", "#14"],
        ["68x30", "#14"],
        ["75x40", "#12"], ["75x40", "#13"], ["75x40", "#14"],
        ["92x30", "#14"],
        ["100x40", "#11"], ["100x40", "#12"], ["100x40", "#13"], ["100x40", "#14"],
        ["120x40", "#13"], ["120x40", "#14"],
        ["127x50", "#11"], ["127x50", "#12"], ["127x50", "#13"], ["127x50", "#14"],
        ["150x50", "#11"], ["150x50", "#12"], ["150x50", "#13"], ["150x50", "#14"],
      ]),
      { paginaFonte: "lista-vendedora-p1", observacao: "Chapa em numero de bitola (#XX), como consta na lista comercial atual. Peso informado pelo vendedor durante o atendimento." }
    ),
  },

  // Telhas Metalicas nao faz parte desta correcao - mantido sem alteracao.
  telhasMetalicas: {
    material: "Aço galvalume",
    trapezoidal40: buildSpecs(
      confirmedRows([["1080 mm", 0.43], ["1080 mm", 0.5]]),
      { paginaFonte: 6, observacoesTecnicas: ["Passo 200 mm", "Mesa 35 mm", "Altura 30 mm"] }
    ),
    trapezoidal25: buildSpecs(
      confirmedRows([["1080 mm", 0.43], ["1080 mm", 0.5]]),
      { paginaFonte: 6, observacoesTecnicas: ["Passo 180 mm", "Mesa 22 mm", "Altura 25 mm"] }
    ),
    ondulada: buildSpecs(
      confirmedRows([["1100 mm", 0.43], ["1100 mm", 0.5]]),
      { paginaFonte: 6, observacoesTecnicas: ["Passo 75 mm", "Altura 15 mm"] }
    ),
    translucidas: buildSpecs(
      confirmedRows([
        ["Telha ondulada translúcida"],
        ["Telha Trap 40 translúcida"],
        ["Telha Trap 25 translúcida"],
      ]),
      {
        paginaFonte: "levantamento-fisico",
        dadosCompletos: false,
        observacao: "Modelos translúcidos confirmados no levantamento físico; medidas e chapas sob confirmação comercial.",
      }
    ),
    cumeeiras: incompleteSpecs(6, "O catálogo apresenta os modelos de cumeeira sem tabela de medidas."),
  },

  telasEBobininhas: {
    // Bobininha nao faz parte desta correcao - mantida sem alteracao.
    bobininha: buildSpecs(
      confirmedRows([["AZ-120", "Galvanizada - 30 m"]]),
      {
        paginaFonte: "levantamento-fisico",
        dadosCompletos: false,
        observacao: "Bobininha galvanizada AZ-120, origem Tianjin, com comprimento confirmado de 30 metros. Largura, espessura e diâmetro não foram confirmados.",
        observacoesTecnicas: ["Origem: Tianjin", "Revestimento: AZ-120", "Comprimento: 30 m", "Acabamento: galvanizada"],
      }
    ),
    // TELA ELETROSSOLDADA (pagina 7 da lista da vendedora) - todas as 11 combinacoes de
    // malha/fio/altura da pagina, sem inventar nenhuma medida adicional.
    telaEletrossoldada: buildSpecs(
      confirmedRows([
        ["25 x 25 mm", 2.1, 1000],
        ["25 x 25 mm", 2.1, 1500],
        ["25 x 25 mm", 2.1, 2000],
        ["35 x 35 mm", 2.1, 1000],
        ["35 x 35 mm", 2.1, 1500],
        ["35 x 35 mm", 2.1, 2000],
        ["50 x 50 mm", 2.1, 2000],
        ["75 x 50 mm", 2.1, 2000],
        ["150 x 50 mm", 2.3, 1800],
        ["150 x 50 mm", 2.5, 1500],
        ["150 x 50 mm", 2.5, 2000],
      ]),
      {
        paginaFonte: "lista-vendedora-p7",
        dadosCompletos: true,
        observacao: "Malha, fio (espessura) e altura (comprimento, em mm) conforme a página 7 da lista comercial atual. Tela vendida por metro.",
        observacoesTecnicas: ["Venda por metro (corte mínimo de 0,5 m)"],
      }
    ),
  },

  laminados: {
    // CANTONEIRAS (LAMINADOS - CANTONEIRAS, paginas 4-5) - revisado por completo, lista antiga
    // descartada. Formato do catalogo: chapa primeiro, aba (medida) depois - convertido aqui para
    // o padrao ja usado no site (medida = aba, espessura = chapa).
    cantoneirasAbasIguais: buildSpecs(
      confirmedRows([
        ['4"', '1/2"'], ['5"', '1/2"'],
        ['1.1/2"', '1/4"'], ['1.1/4"', '1/4"'], ['2.1/2"', '1/4"'], ['2"', '1/4"'], ['3"', '1/4"'],
        ['7/8"', '1/8"'], ['1/2"', '1/8"'], ['1.1/2"', '1/8"'], ['1.1/4"', '1/8"'], ['1"', '1/8"'], ['2"', '1/8"'], ['3/4"', '1/8"'], ['5/8"', '1/8"'],
        ['1"', '3/16"'], ['1.1/2"', '3/16"'], ['1.1/4"', '3/16"'], ['2.1/2"', '3/16"'], ['2"', '3/16"'], ['3"', '3/16"'],
        ['4"', '3/8"'], ['2"', '3/8"'], ['3"', '3/8"'], ['5"', '3/8"'],
        ['2.1/2"', '5/16"'], ['3"', '5/16"'],
      ]),
      { paginaFonte: "lista-vendedora-p4-p5", unidadeMedida: "polegadas", observacao: "Lista comercial atual (revisão completa). Peso informado pelo vendedor durante o atendimento." }
    ),
    // BARRAS CHATAS (paginas 4-5) - revisado por completo. A combinação 1/4" x 1 1/4" tem
    // comprimento de 6 m confirmado na lista ("6M"); as demais não declaram comprimento.
    barrasChatas: buildSpecs(
      confirmedRows([
        ['1.1/2"', '1/2"'], ['2.1/2"', '1/2"'], ['2"', '1/2"'], ['3"', '1/2"'], ['4"', '1/2"'],
        ['1.1/2"', '1/4"'], ['1.1/4"', '1/4"', 6000], ['1"', '1/4"'], ['2.1/2"', '1/4"'], ['2"', '1/4"'], ['3"', '1/4"'], ['4"', '1/4"'],
        ['1.1/2"', '1/8"'], ['1.1/4"', '1/8"'], ['1"', '1/8"'], ['1/2"', '1/8"'], ['3/4"', '1/8"'], ['3/8"', '1/8"'], ['5/8"', '1/8"'], ['7/8"', '1/8"'],
        ['1.1/2"', '3/16"'], ['1.1/4"', '3/16"'], ['1"', '3/16"'], ['1/2"', '3/16"'], ['2"', '3/16"'], ['5/8"', '3/16"'],
        ['1.1/2"', '3/8"'], ['2"', '3/8"'], ['2.1/2"', '3/8"'], ['3"', '3/8"'],
        ['2"', '5/16"'], ['3"', '5/16"'],
        ['2"', '5/8"'],
      ]),
      { paginaFonte: "lista-vendedora-p4-p5", unidadeMedida: "polegadas", observacao: "Lista comercial atual (revisão completa). Peso informado pelo vendedor durante o atendimento." }
    ),
    // BARRAS QUADRADAS (pagina 5) - lista atual tem somente estas 3 bitolas.
    barrasQuadradas: buildSpecs(
      confirmedRows([
        ['1/2"'], ['3/8"'], ['5/16"'],
      ]),
      { paginaFonte: "lista-vendedora-p5", unidadeMedida: "polegadas" }
    ),
    // BARRAS REDONDAS (pagina 5) - bitolas maiores que não constam mais na lista foram removidas.
    barrasRedondas: buildSpecs(
      confirmedRows([
        ['1/4"'], ['5/16"'], ['3/8"'], ['1/2"'], ['5/8"'], ['3/4"'], ['7/8"'], ['1"'], ['1.1/4"'], ['1.1/2"'],
      ]),
      { paginaFonte: "lista-vendedora-p5", unidadeMedida: "polegadas" }
    ),
  },

  chapas: {
    planas: {
      generica: incompleteSpecs(9, "Selecione uma família de chapa para acessar espessura específica."),
      // CHAPAS FF (pagina 3) - #16 a #22, dimensão 1200x3000.
      finaFrio: buildSpecs(
        confirmedRows([
          ["1200x3000", "#16"], ["1200x3000", "#18"], ["1200x3000", "#20"], ["1200x3000", "#22"],
        ]),
        { paginaFonte: "lista-vendedora-p3", observacao: "Chapa em numero de bitola (#XX), como consta na lista comercial atual." }
      ),
      // CHAPAS FQ (paginas 3-4) - #09 a #14 e frações 1/4"/1/2", dimensão 1200x3000.
      finaQuente: buildSpecs(
        confirmedRows([
          ["1200x3000", "#09"], ["1200x3000", "#10"], ["1200x3000", "#11"], ["1200x3000", "#12"], ["1200x3000", "#13"], ["1200x3000", "#14"],
          ["1200x3000", '1/4"'], ["1200x3000", '1/2"'],
        ]),
        { paginaFonte: "lista-vendedora-p3-p4", observacao: "Chapa em numero de bitola (#XX) ou fração de polegada, como consta na lista comercial atual." }
      ),
      // CHAPAS GROSSAS (pagina 4) - frações de polegada, dimensão 1200x3000.
      grossa: buildSpecs(
        confirmedRows([
          ["1200x3000", '3/16"'], ["1200x3000", '5/16"'], ["1200x3000", '3/8"'], ["1200x3000", '1/2"'],
        ]),
        { paginaFonte: "lista-vendedora-p4", observacao: "Chapa em fração de polegada, como consta na lista comercial atual." }
      ),
      // CHAPAS XADREZ (pagina 4) - Chapa Piso corresponde comercialmente a chapa xadrez.
      piso: buildSpecs(
        confirmedRows([
          ["1200x3000", "#12"], ["1200x3000", "#14"], ["1200x3000", '1/8"'], ["1200x3000", '3/16"'],
        ]),
        { paginaFonte: "lista-vendedora-p4", observacao: "Chapa Piso corresponde comercialmente a chapa xadrez." }
      ),
    },
    frisadasELambris: {
      // CHAPA FRISADA U (paginas 5-6) - todas #22; a lista nao declara uma largura para esta
      // familia (diferente da largura de 1095mm usada numa fonte anterior, nao reconfirmada aqui)
      // - o codigo U identifica o comprimento (U1800 = 1800mm etc).
      frisadaU: buildSpecs(
        confirmedRows([
          ["U1800", "#22", 1800],
          ["U2000", "#22", 2000],
          ["U2200", "#22", 2200],
          ["U2500", "#22", 2500],
          ["U3000", "#22", 3000],
        ]),
        { paginaFonte: "lista-vendedora-p5-p6", observacao: "Chapa em numero de bitola (#XX), como consta na lista comercial atual." }
      ),
      // CHAPA MEIA CANA 1090 (pagina 6).
      meiaCana1090: buildSpecs(
        confirmedRows([
          ["1090 mm", "#20", 1800],
          ["1090 mm", "#20", 2000],
          ["1090 mm", "#20", 2200],
          ["1090 mm", "#20", 2500],
          ["1090 mm", "#20", 3000],
        ]),
        { paginaFonte: "lista-vendedora-p6" }
      ),
      // CHAPA MEIA CANA 545 (pagina 6) - a lista não inclui a variação 1800mm para esta largura.
      meiaCana545: buildSpecs(
        confirmedRows([
          ["545 mm", "#20", 2000],
          ["545 mm", "#20", 2200],
          ["545 mm", "#20", 2500],
          ["545 mm", "#20", 3000],
        ]),
        { paginaFonte: "lista-vendedora-p6" }
      ),
      lambris: incompleteSpecs(10),
    },
  },

  perfisSerralheria: {
    portoesElevacao: incompleteSpecs(11, "A página apresenta aplicações visuais, sem tabela técnica."),
    portasAco: incompleteSpecs(11, "A página apresenta aplicações visuais, sem tabela técnica."),
    janelasAco: incompleteSpecs(11, "A página apresenta aplicações visuais, sem tabela técnica."),
    // BATENTE PORTA (pagina 6) - todas as combinações são chapa #18, incluindo 120x27 (estava
    // faltando na tabela anterior).
    batentesPorta: buildSpecs(
      confirmedRows([
        ["120x27", "chapa #18"],
        ["120x32", "chapa #18"],
        ["120x42", "chapa #18"],
        ["130x27", "chapa #18"],
        ["130x32", "chapa #18"],
        ["130x42", "chapa #18"],
        ["140x27", "chapa #18"],
        ["140x32", "chapa #18"],
        ["140x42", "chapa #18"],
      ]),
      { paginaFonte: "lista-vendedora-p6" }
    ),
    // COLUNA LATERAL/SUPERIOR (pagina 6) - "LAT 170 #14" (tabela anterior) não consta na lista
    // atual e foi removida; SUP 150 #18 estava faltando e foi adicionada.
    colunas: buildSpecs(
      [
        { medida: "Coluna LAT 150", espessura: "chapa #16", image: "/catalog-products/atualizadas/coluna-lateral.webp" },
        { medida: "Coluna LAT 150", espessura: "chapa #18", image: "/catalog-products/atualizadas/coluna-lateral.webp" },
        { medida: "Coluna LAT 170", espessura: "chapa #16", image: "/catalog-products/atualizadas/coluna-lateral.webp" },
        { medida: "Coluna LAT 170", espessura: "chapa #18", image: "/catalog-products/atualizadas/coluna-lateral.webp" },
        { medida: "Coluna SUP 150", espessura: "chapa #18", image: "/catalog-products/atualizadas/coluna-superior.webp" },
        { medida: "Coluna SUP 170", espessura: "chapa #18", image: "/catalog-products/atualizadas/coluna-superior.webp" },
      ],
      { paginaFonte: "lista-vendedora-p6" }
    ),
    // TAMPAS DE COLUNA (pagina 6) - estruturado com as 4 combinações + a variação adicional de
    // chapa #16 na tampa lateral 170, todas presentes na lista atual.
    tampas: buildSpecs(
      [
        { medida: "Tampa COL. LAT. 150", espessura: "chapa #18", image: "/catalog-products/atualizadas/tampa-coluna-lateral-170.webp" },
        { medida: "Tampa COL. LAT. 170", espessura: "chapa #16", image: "/catalog-products/atualizadas/tampa-coluna-lateral-170.webp" },
        { medida: "Tampa COL. LAT. 170", espessura: "chapa #18", image: "/catalog-products/atualizadas/tampa-coluna-lateral-170.webp" },
        { medida: "Tampa COL. SUP. 150", espessura: "chapa #18" },
        { medida: "Tampa COL. SUP. 170", espessura: "chapa #18" },
      ],
      { paginaFonte: "lista-vendedora-p6" }
    ),
    // CARTOLAS (pagina 6) - as 4 combinações confirmadas da lista atual (320x23x20 e 500x20x30,
    // cada uma em #18 e #20). Combinações antigas incorretas (ex.: "Cartola 520x30") removidas.
    cartolas: buildSpecs(
      confirmedRows([
        ["320x23x20", "chapa #18"],
        ["320x23x20", "chapa #20"],
        ["500x20x30", "chapa #18"],
        ["500x20x30", "chapa #20"],
      ]),
      { paginaFonte: "lista-vendedora-p6" }
    ),
    // Viga G nao faz parte desta correcao (nao consta na lista da vendedora) - mantido sem alteracao.
    vigaG: buildSpecs(
      confirmedRows([
        ["75 — 5 x 2,5"],
        ["75 — 5 x 7,5"],
        ["75 — 7,5 x 40 x 20", "chapa #13"],
        ["150 x 50 x 20", "chapa #12"],
      ]),
      {
        paginaFonte: "levantamento-fisico",
        dadosCompletos: false,
        observacao: "Nomenclatura preservada conforme levantamento físico; não convertida para Perfil U.",
      }
    ),
    // CAIXA DE PESO (pagina 6) - as duas caixas, fechada, 1200mm, chapa #18.
    caixaPeso: buildSpecs(
      confirmedRows([
        ["Caixa de Peso 120 fechada 1200mm", "chapa #18"],
        ["Caixa de Peso 140 fechada 1200mm", "chapa #18"],
      ]),
      { paginaFonte: "lista-vendedora-p6" }
    ),
    // TRILHOS / TIRAS (pagina 6) - produto "Trilhos" do catálogo cobre o trilho lateral e as
    // duas tiras da mesma seção da lista (antes usava a tabela genérica de acessórios, sem dados
    // reais).
    trilhos: buildSpecs(
      confirmedRows([
        ["Trilho Lateral", "#14"],
        ["Trilho Lateral", "#16"],
        ["Trilho Lateral", "#18"],
        ["Tira 50", "chapa #18"],
        ["Tira 100", "chapa #18"],
      ]),
      { paginaFonte: "lista-vendedora-p6" }
    ),
  },

  acessorios: incompleteSpecs(12),
  tintasSolventes: incompleteSpecs(12),
};

// Conta variacoes tecnicas sem somar o mesmo objeto mais de uma vez.
export function countCatalogVariations() {
  const visited = new Set();
  let count = 0;

  // Percorre a arvore porque as familias possuem niveis diferentes de agrupamento.
  const walk = (value) => {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value.variacoes)) count += value.variacoes.length;
    Object.values(value).forEach(walk);
  };

  walk(catalogSpecifications);
  return count;
}
